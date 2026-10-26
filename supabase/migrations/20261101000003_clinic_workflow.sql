-- =====================================================================
--  دورة الموعد: المواعيد المتاحة ← الحجز ← التأكيد ← الحضور ← الكشف ← الإغلاق
--  كل تغيير في حالة الموعد يتم عبر دوال تتحقق من الدور ومن صحة الانتقال
-- =====================================================================

create or replace function public._log_appt(p_appt uuid, p_action text, p_from text, p_to text, p_note text default null, p_meta jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.activity_logs (appointment_id, entity, entity_id, action, from_status, to_status, note, meta)
  values (p_appt, 'appointment', p_appt, p_action, p_from, p_to, nullif(btrim(p_note), ''), coalesce(p_meta, '{}'))
$$;

create or replace function public.riyadh_date(p timestamptz default now())
returns date language sql stable set search_path = public as $$
  select (p at time zone 'Asia/Riyadh')::date
$$;

-- ---------------------------------------------------------------------
-- Free slots of a doctor on a day (also used by the public website — returns times only)
-- ---------------------------------------------------------------------
create or replace function public.available_slots(p_doctor uuid, p_date date)
returns table (starts_at timestamptz, ends_at timestamptz, is_free boolean)
language sql stable security definer set search_path = public as $$
  with d as (
    select d.id, d.slot_minutes from public.doctors d
    join public.clinics c on c.id = d.clinic_id
    where d.id = p_doctor and d.is_active and c.is_active
      and not exists (select 1 from public.doctor_time_off t where t.doctor_id = d.id and p_date between t.from_date and t.to_date)
      and p_date <= public.riyadh_date() + (select booking_days_ahead from public.company_settings where id = 1)
  ), g as (
    select gs as starts_at, gs + make_interval(mins => d.slot_minutes) as ends_at
    from d
    join public.doctor_schedules s on s.doctor_id = d.id and s.weekday = extract(dow from p_date)::int
    cross join lateral generate_series(
      (p_date + s.start_time) at time zone 'Asia/Riyadh',
      (p_date + s.end_time) at time zone 'Asia/Riyadh' - make_interval(mins => d.slot_minutes),
      make_interval(mins => d.slot_minutes)) gs
  )
  select distinct g.starts_at, g.ends_at,
         g.starts_at > now() and not exists (
           select 1 from public.appointments a
           where a.doctor_id = p_doctor and a.status not in ('cancelled', 'no_show')
             and a.starts_at < g.ends_at and a.ends_at > g.starts_at) as is_free
  from g order by g.starts_at
$$;

-- next days that still have a free slot (for the booking calendar)
create or replace function public.doctor_open_days(p_doctor uuid, p_days int default 14)
returns table (day date, free_slots int)
language sql stable security definer set search_path = public as $$
  select dd::date, (select count(*)::int from public.available_slots(p_doctor, dd::date) s where s.is_free)
  from generate_series(public.riyadh_date(), public.riyadh_date() + least(greatest(p_days, 1), 60) - 1, interval '1 day') dd
$$;

create or replace function public._slot_end(p_doctor uuid, p_starts_at timestamptz)
returns timestamptz language sql stable security definer set search_path = public as $$
  select s.ends_at from public.available_slots(p_doctor, public.riyadh_date(p_starts_at)) s
  where s.starts_at = p_starts_at and s.is_free
$$;

-- ---------------------------------------------------------------------
-- Booking
-- ---------------------------------------------------------------------
create or replace function public.book_appointment(
  p_doctor uuid, p_starts_at timestamptz, p_patient uuid default null,
  p_reason text default null, p_visit_type text default 'new', p_source text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_role text := public.auth_role()::text; v_patient uuid; v_end timestamptz; v_doc record; v_id uuid; v_ref text; v_source text;
begin
  select d.*, c.is_active as clinic_active into v_doc from public.doctors d join public.clinics c on c.id = d.clinic_id where d.id = p_doctor;
  if v_doc.id is null or not v_doc.is_active or not v_doc.clinic_active then raise exception 'DOCTOR_UNAVAILABLE' using errcode = 'P0001'; end if;
  if coalesce(p_visit_type, 'new') not in ('new', 'follow_up') then raise exception 'INVALID_INPUT' using errcode = 'P0001'; end if;

  if v_role = 'patient' then
    v_patient := public.my_patient_id();
    if v_patient is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
    if not v_doc.accepts_online then raise exception 'ONLINE_BOOKING_CLOSED' using errcode = 'P0001'; end if;
    if (select count(*) from public.appointments where patient_id = v_patient and starts_at > now()
          and status in ('booked', 'confirmed')) >= 3 then
      raise exception 'TOO_MANY_APPOINTMENTS' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.appointments where patient_id = v_patient and doctor_id = p_doctor and starts_at > now()
                 and status in ('booked', 'confirmed')) then
      raise exception 'ALREADY_BOOKED_WITH_DOCTOR' using errcode = 'P0001';
    end if;
    v_source := 'online';
  elsif public.is_staff() then
    if p_patient is null or not exists (select 1 from public.patients where id = p_patient) then raise exception 'PATIENT_REQUIRED' using errcode = 'P0001'; end if;
    v_patient := p_patient;
    v_source := case when p_source in ('reception', 'phone', 'website') then p_source else 'reception' end;
  else
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  v_end := public._slot_end(p_doctor, p_starts_at);
  if v_end is null then raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001'; end if;

  begin
    insert into public.appointments (patient_id, doctor_id, clinic_id, starts_at, ends_at, visit_type, source, reason)
    values (v_patient, p_doctor, v_doc.clinic_id, p_starts_at, v_end, coalesce(p_visit_type, 'new'), v_source,
            left(nullif(btrim(p_reason), ''), 500))
    returning id, ref_no into v_id, v_ref;
  exception when unique_violation then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end;

  perform public._log_appt(v_id, 'booked', null, 'booked', null, jsonb_build_object('source', v_source));
  if v_role = 'patient' then
    perform public.notify_role(array['reception'], 'online_booking',
      jsonb_build_object('ref_no', v_ref, 'when', p_starts_at, 'doctor', v_doc.full_name_ar, 'link', '/reception'));
  else
    perform public.notify_user(public.appointment_patient_profile(v_id), 'appointment_booked', v_id,
      jsonb_build_object('ref_no', v_ref, 'when', p_starts_at, 'doctor', v_doc.full_name_ar, 'link', '/patient/appointments/' || v_id));
  end if;
  -- same-day bookings: let the doctor know
  if public.riyadh_date(p_starts_at) = public.riyadh_date() then
    perform public.notify_user(v_doc.profile_id, 'appointment_today', v_id, jsonb_build_object('ref_no', v_ref, 'when', p_starts_at, 'link', '/doctor'));
  end if;
  return v_id;
end $$;

-- may the caller still change this appointment (cancel / reschedule)?
create or replace function public._can_change_appt(a public.appointments)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if public.is_staff() then return a.status in ('booked', 'confirmed', 'checked_in'); end if;
  if a.patient_id = public.my_patient_id() then
    if a.status not in ('booked', 'confirmed') then return false; end if;
    if a.starts_at - now() < make_interval(hours => (select cancel_window_hours from public.company_settings where id = 1)) then
      raise exception 'TOO_LATE_TO_CHANGE' using errcode = 'P0001';
    end if;
    return true;
  end if;
  raise exception 'FORBIDDEN' using errcode = '42501';
end $$;

create or replace function public.cancel_appointment(p_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a public.appointments;
begin
  select * into a from public.appointments where id = p_id for update;
  if a.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not public._can_change_appt(a) then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  if public.is_staff() and coalesce(btrim(p_reason), '') = '' then raise exception 'NOTE_REQUIRED' using errcode = 'P0001'; end if;
  update public.appointments set status = 'cancelled', cancelled_at = now(), cancel_reason = left(nullif(btrim(p_reason), ''), 500)
  where id = p_id;
  perform public._log_appt(p_id, 'cancelled', a.status::text, 'cancelled', p_reason);
  if public.is_staff() then
    perform public.notify_user(public.appointment_patient_profile(p_id), 'appointment_cancelled', p_id,
      jsonb_build_object('ref_no', a.ref_no, 'when', a.starts_at, 'note', p_reason, 'link', '/patient/appointments/' || p_id));
  else
    perform public.notify_role(array['reception'], 'appointment_cancelled_by_patient',
      jsonb_build_object('ref_no', a.ref_no, 'when', a.starts_at, 'link', '/reception'));
  end if;
  if public.riyadh_date(a.starts_at) = public.riyadh_date() then
    perform public.notify_user(public.appointment_doctor_profile(p_id), 'appointment_cancelled', p_id,
      jsonb_build_object('ref_no', a.ref_no, 'when', a.starts_at, 'link', '/doctor'));
  end if;
end $$;

create or replace function public.reschedule_appointment(p_id uuid, p_new_start timestamptz, p_doctor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare a public.appointments; v_doc uuid; v_end timestamptz; v_clinic uuid;
begin
  select * into a from public.appointments where id = p_id for update;
  if a.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not public._can_change_appt(a) or a.status = 'checked_in' then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  v_doc := coalesce(p_doctor, a.doctor_id);
  -- patients may move the time, not switch to a doctor in another clinic
  select clinic_id into v_clinic from public.doctors where id = v_doc;
  if not public.is_staff() and v_clinic is distinct from a.clinic_id then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  v_end := public._slot_end(v_doc, p_new_start);
  if v_end is null then raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001'; end if;
  begin
    update public.appointments set starts_at = p_new_start, ends_at = v_end, doctor_id = v_doc, clinic_id = v_clinic,
      status = 'booked', confirmed_at = null, reminder_sent_at = null
    where id = p_id;
  exception when unique_violation then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end;
  perform public._log_appt(p_id, 'rescheduled', a.status::text, 'booked', null,
    jsonb_build_object('from', a.starts_at, 'to', p_new_start, 'doctor_changed', v_doc <> a.doctor_id));
  if public.is_staff() then
    perform public.notify_user(public.appointment_patient_profile(p_id), 'appointment_rescheduled', p_id,
      jsonb_build_object('ref_no', a.ref_no, 'when', p_new_start, 'link', '/patient/appointments/' || p_id));
  else
    perform public.notify_role(array['reception'], 'appointment_rescheduled_by_patient',
      jsonb_build_object('ref_no', a.ref_no, 'when', p_new_start, 'link', '/reception'));
  end if;
end $$;

create or replace function public.confirm_appointment(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.appointments;
begin
  select * into a from public.appointments where id = p_id for update;
  if a.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not (public.is_staff() or a.patient_id = public.my_patient_id()) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if a.status <> 'booked' then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  update public.appointments set status = 'confirmed', confirmed_at = now() where id = p_id;
  perform public._log_appt(p_id, 'confirmed', 'booked', 'confirmed');
end $$;

-- ---------------------------------------------------------------------
-- Front desk: arrival & no-show
-- ---------------------------------------------------------------------
create or replace function public.check_in(p_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare a public.appointments; v_q int;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into a from public.appointments where id = p_id for update;
  if a.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if a.status not in ('booked', 'confirmed') then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  if public.riyadh_date(a.starts_at) <> public.riyadh_date() then raise exception 'NOT_TODAY' using errcode = 'P0001'; end if;
  select coalesce(max(queue_no), 0) + 1 into v_q from public.appointments
  where doctor_id = a.doctor_id and public.riyadh_date(starts_at) = public.riyadh_date() and queue_no is not null;
  update public.appointments set status = 'checked_in', checked_in_at = now(), queue_no = v_q,
    confirmed_at = coalesce(confirmed_at, now()) where id = p_id;
  perform public._log_appt(p_id, 'checked_in', a.status::text, 'checked_in', null, jsonb_build_object('queue_no', v_q));
  perform public.notify_user(public.appointment_doctor_profile(p_id), 'patient_arrived', p_id,
    jsonb_build_object('ref_no', a.ref_no, 'queue_no', v_q, 'link', '/doctor'));
  return v_q;
end $$;

create or replace function public.mark_no_show(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.appointments;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into a from public.appointments where id = p_id for update;
  if a.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if a.status not in ('booked', 'confirmed') then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  if a.starts_at > now() then raise exception 'NOT_YET' using errcode = 'P0001'; end if;
  update public.appointments set status = 'no_show' where id = p_id;
  perform public._log_appt(p_id, 'no_show', a.status::text, 'no_show');
end $$;

-- ---------------------------------------------------------------------
-- Doctor: consultation
-- ---------------------------------------------------------------------
create or replace function public.start_consultation(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare a public.appointments; v_visit uuid; v_doc record;
begin
  select * into a from public.appointments where id = p_id for update;
  if a.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not (a.doctor_id = public.my_doctor_id() or public.is_admin()) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if a.status = 'in_consultation' then
    select id into v_visit from public.visits where appointment_id = p_id;
    return v_visit;
  end if;
  if a.status <> 'checked_in' then raise exception 'PATIENT_NOT_ARRIVED' using errcode = 'P0001'; end if;
  update public.appointments set status = 'in_consultation', called_at = now() where id = p_id;
  insert into public.visits (appointment_id, patient_id, doctor_id, clinic_id)
  values (a.id, a.patient_id, a.doctor_id, a.clinic_id)
  on conflict (appointment_id) do update set status = 'open'
  returning id into v_visit;
  perform public._log_appt(p_id, 'called', 'checked_in', 'in_consultation');
  select d.full_name_ar, c.name_ar, c.location_ar into v_doc from public.doctors d join public.clinics c on c.id = d.clinic_id where d.id = a.doctor_id;
  perform public.notify_user(public.appointment_patient_profile(p_id), 'your_turn', p_id,
    jsonb_build_object('ref_no', a.ref_no, 'queue_no', a.queue_no, 'doctor', v_doc.full_name_ar, 'clinic', v_doc.name_ar,
                       'room', v_doc.location_ar, 'link', '/patient/appointments/' || p_id));
  return v_visit;
end $$;

create or replace function public.complete_visit(p_visit uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v public.visits; a public.appointments;
begin
  if not public.can_edit_visit(p_visit) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into v from public.visits where id = p_visit for update;
  if coalesce(btrim(v.diagnosis), '') = '' then raise exception 'DIAGNOSIS_REQUIRED' using errcode = 'P0001'; end if;
  update public.visits set status = 'signed', signed_at = now() where id = p_visit;
  select * into a from public.appointments where id = v.appointment_id for update;
  update public.appointments set status = 'completed', completed_at = now() where id = a.id;
  perform public._log_appt(a.id, 'completed', a.status::text, 'completed');
  perform public.notify_user(public.appointment_patient_profile(a.id), 'visit_completed', a.id,
    jsonb_build_object('ref_no', a.ref_no, 'follow_up_days', v.follow_up_in_days, 'link', '/patient/records/' || p_visit));
end $$;

-- reopen a signed visit for correction (same doctor, within 24h) — keeps an audit entry
create or replace function public.reopen_visit(p_visit uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.visits;
begin
  select * into v from public.visits where id = p_visit for update;
  if v.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not (v.doctor_id = public.my_doctor_id() or public.is_admin()) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v.status <> 'signed' or v.signed_at < now() - interval '24 hours' then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'NOTE_REQUIRED' using errcode = 'P0001'; end if;
  update public.visits set status = 'open', signed_at = null where id = p_visit;
  perform public._log_appt(v.appointment_id, 'visit_reopened', 'signed', 'open', p_reason);
end $$;

create or replace function public.save_private_note(p_visit uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.visits where id = p_visit and (doctor_id = public.my_doctor_id() or public.is_admin())) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.visit_private_notes (visit_id, body, updated_at) values (p_visit, left(coalesce(p_body, ''), 5000), now())
  on conflict (visit_id) do update set body = excluded.body, updated_at = now();
end $$;

-- ---------------------------------------------------------------------
-- Lab & radiology
-- ---------------------------------------------------------------------
create or replace function public.order_test(p_visit uuid, p_service uuid default null, p_test_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v public.visits; s public.services; v_id uuid;
begin
  if not public.can_edit_visit(p_visit) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into v from public.visits where id = p_visit;
  if p_service is not null then
    select * into s from public.services where id = p_service and is_active and kind in ('lab', 'radiology');
    if s.id is null then raise exception 'INVALID_INPUT' using errcode = 'P0001'; end if;
  elsif coalesce(btrim(p_test_name), '') = '' then
    raise exception 'REQUIRED' using errcode = 'P0001';
  end if;
  insert into public.lab_orders (visit_id, patient_id, service_id, test_name, kind)
  values (p_visit, v.patient_id, s.id, coalesce(s.name_ar, left(btrim(p_test_name), 200)), coalesce(s.kind, 'lab'))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.cancel_test(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o public.lab_orders;
begin
  select * into o from public.lab_orders where id = p_order for update;
  if o.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not public.can_edit_visit(o.visit_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if o.status <> 'ordered' then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  update public.lab_orders set status = 'cancelled' where id = p_order;
end $$;

create or replace function public.record_test_result(p_order uuid, p_text text, p_flag text default 'normal', p_file text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o public.lab_orders; v_doc uuid;
begin
  select * into o from public.lab_orders where id = p_order for update;
  if o.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not (public.is_admin() or (public.my_doctor_id() is not null and public.can_view_patient_clinical(o.patient_id))) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if o.status = 'cancelled' then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  if coalesce(btrim(p_text), '') = '' and p_file is null then raise exception 'REQUIRED' using errcode = 'P0001'; end if;
  if coalesce(p_flag, 'normal') not in ('normal', 'abnormal', 'critical') then raise exception 'INVALID_INPUT' using errcode = 'P0001'; end if;
  if p_file is not null and split_part(p_file, '/', 1) <> o.patient_id::text then raise exception 'INVALID_FILE' using errcode = 'P0001'; end if;
  update public.lab_orders set status = 'resulted', result_text = nullif(btrim(p_text), ''), result_flag = coalesce(p_flag, 'normal'),
    result_file = coalesce(p_file, result_file), resulted_by = auth.uid(), resulted_at = now()
  where id = p_order;
  perform public.notify_user((select pt.profile_id from public.patients pt where pt.id = o.patient_id and pt.account_status = 'active'),
    'test_result_ready', null, jsonb_build_object('title', o.test_name, 'link', '/patient/records?tab=results'));
  select d.profile_id into v_doc from public.visits v join public.doctors d on d.id = v.doctor_id where v.id = o.visit_id;
  if v_doc is distinct from auth.uid() then
    perform public.notify_user(v_doc, case when p_flag = 'critical' then 'test_result_critical' else 'test_result_doctor' end, null,
      jsonb_build_object('title', o.test_name, 'link', '/doctor/patients/' || o.patient_id));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Sick leave / medical report / referral (verifiable by QR)
-- ---------------------------------------------------------------------
create or replace function public.issue_medical_document(
  p_visit uuid, p_kind text, p_from date default null, p_to date default null, p_body text default null, p_referral_to text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v public.visits; v_id uuid; v_ref text;
begin
  select * into v from public.visits where id = p_visit;
  if v.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not (v.doctor_id = public.my_doctor_id() or public.is_admin()) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v.created_at < now() - interval '7 days' then raise exception 'TOO_LATE_TO_CHANGE' using errcode = 'P0001'; end if;
  if p_kind not in ('sick_leave', 'medical_report', 'referral') then raise exception 'INVALID_INPUT' using errcode = 'P0001'; end if;
  if p_kind = 'sick_leave' then
    if p_from is null or p_to is null or p_to < p_from then raise exception 'INVALID_DATES' using errcode = 'P0001'; end if;
    if p_to - p_from + 1 > 30 then raise exception 'SICK_LEAVE_TOO_LONG' using errcode = 'P0001'; end if;
    if p_from < public.riyadh_date(v.created_at) - 1 then raise exception 'INVALID_DATES' using errcode = 'P0001'; end if;
  elsif coalesce(btrim(p_body), '') = '' then
    raise exception 'REQUIRED' using errcode = 'P0001';
  end if;
  insert into public.medical_documents (visit_id, patient_id, doctor_id, kind, from_date, to_date, body, referral_to)
  values (p_visit, v.patient_id, v.doctor_id, p_kind,
          case when p_kind = 'sick_leave' then p_from end, case when p_kind = 'sick_leave' then p_to end,
          left(nullif(btrim(p_body), ''), 4000), left(nullif(btrim(p_referral_to), ''), 200))
  returning id, ref_no into v_id, v_ref;
  perform public._log_appt(v.appointment_id, 'document_issued', null, null, null, jsonb_build_object('kind', p_kind, 'ref_no', v_ref));
  perform public.notify_user((select profile_id from public.patients where id = v.patient_id and account_status = 'active'),
    'medical_document_issued', v.appointment_id, jsonb_build_object('ref_no', v_ref, 'kind', p_kind, 'link', '/patient/documents/' || v_id));
  return v_id;
end $$;

create or replace function public.revoke_medical_document(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.medical_documents set revoked_at = now()
  where id = p_id and revoked_at is null and (doctor_id = public.my_doctor_id() or public.is_admin());
  if not found then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
end $$;

-- public QR check: just enough to confirm the paper is genuine (name is masked)
create or replace function public.verify_medical_document(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ref_no', m.ref_no, 'kind', m.kind, 'issued_at', m.issued_at, 'revoked', m.revoked_at is not null,
    'from_date', m.from_date, 'to_date', m.to_date,
    'days', case when m.kind = 'sick_leave' then m.to_date - m.from_date + 1 end,
    'patient', split_part(btrim(p.full_name), ' ', 1) || ' ' || coalesce(nullif(left(split_part(btrim(p.full_name), ' ', 2), 1), '') || '.', ''),
    'national_id', case when p.national_id is null then null else repeat('•', 6) || right(p.national_id, 4) end,
    'doctor', d.full_name_ar, 'doctor_en', d.full_name_en, 'clinic', c.name_ar, 'clinic_en', c.name_en,
    'center', (select name_ar from public.company_settings where id = 1),
    'center_en', (select name_en from public.company_settings where id = 1))
  from public.medical_documents m
  join public.patients p on p.id = m.patient_id
  join public.doctors d on d.id = m.doctor_id
  join public.clinics c on c.id = d.clinic_id
  where m.verify_code = p_code and length(p_code) = 32
$$;

-- ---------------------------------------------------------------------
-- Patient: rating & own contact details
-- ---------------------------------------------------------------------
create or replace function public.rate_appointment(p_id uuid, p_score int, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a public.appointments;
begin
  select * into a from public.appointments where id = p_id;
  if a.id is null or a.patient_id is distinct from public.my_patient_id() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if a.status <> 'completed' then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  if p_score not between 1 and 5 then raise exception 'INVALID_INPUT' using errcode = 'P0001'; end if;
  insert into public.appointment_ratings (appointment_id, patient_id, doctor_id, score, comment)
  values (p_id, a.patient_id, a.doctor_id, p_score, left(nullif(btrim(p_comment), ''), 1000));
exception when unique_violation then
  raise exception 'ALREADY_RATED' using errcode = 'P0001';
end $$;

create or replace function public.update_my_contact(p_phone text, p_email text, p_city text, p_emergency_name text, p_emergency_phone text)
returns void language plpgsql security definer set search_path = public as $$
declare v_phone text := public.normalize_phone(p_phone);
begin
  if public.my_patient_id() is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_phone !~ '^(\+?966|0)?5[0-9]{8}$' then raise exception 'INVALID_PHONE' using errcode = 'P0001'; end if;
  if coalesce(p_email, '') <> '' and p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'INVALID_EMAIL' using errcode = 'P0001'; end if;
  update public.patients set phone = v_phone, email = nullif(lower(btrim(p_email)), ''), city = left(nullif(btrim(p_city), ''), 60),
    emergency_name = left(nullif(btrim(p_emergency_name), ''), 120), emergency_phone = nullif(public.normalize_phone(p_emergency_phone), '')
  where id = public.my_patient_id();
  update public.profiles set phone = v_phone where id = auth.uid();
end $$;

-- ---------------------------------------------------------------------
-- Daily: reminders for tomorrow + overdue no-shows (website cron / pg_cron)
-- ---------------------------------------------------------------------
create or replace function public.send_appointment_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select a.id, a.ref_no, a.starts_at, d.full_name_ar, c.name_ar as clinic from public.appointments a
    join public.doctors d on d.id = a.doctor_id join public.clinics c on c.id = a.clinic_id
    where a.status in ('booked', 'confirmed') and a.reminder_sent_at is null
      and public.riyadh_date(a.starts_at) = public.riyadh_date() + 1
  loop
    perform public.notify_user(public.appointment_patient_profile(r.id), 'appointment_reminder', r.id,
      jsonb_build_object('ref_no', r.ref_no, 'when', r.starts_at, 'doctor', r.full_name_ar, 'clinic', r.clinic,
                         'link', '/patient/appointments/' || r.id));
    update public.appointments set reminder_sent_at = now() where id = r.id;
    n := n + 1;
  end loop;
  -- yesterday's bookings nobody came to
  update public.appointments set status = 'no_show'
  where status in ('booked', 'confirmed') and public.riyadh_date(starts_at) < public.riyadh_date();
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------
revoke execute on function public._log_appt(uuid, text, text, text, text, jsonb), public._slot_end(uuid, timestamptz),
  public._can_change_appt(public.appointments), public.send_appointment_reminders()
  from public, anon, authenticated;
grant execute on function public.send_appointment_reminders() to service_role;

revoke execute on function
  public.book_appointment(uuid, timestamptz, uuid, text, text, text), public.cancel_appointment(uuid, text),
  public.reschedule_appointment(uuid, timestamptz, uuid), public.confirm_appointment(uuid),
  public.check_in(uuid), public.mark_no_show(uuid), public.start_consultation(uuid), public.complete_visit(uuid),
  public.reopen_visit(uuid, text), public.save_private_note(uuid, text),
  public.order_test(uuid, uuid, text), public.cancel_test(uuid), public.record_test_result(uuid, text, text, text),
  public.issue_medical_document(uuid, text, date, date, text, text), public.revoke_medical_document(uuid),
  public.rate_appointment(uuid, int, text), public.update_my_contact(text, text, text, text, text)
  from public, anon;
grant execute on function
  public.book_appointment(uuid, timestamptz, uuid, text, text, text), public.cancel_appointment(uuid, text),
  public.reschedule_appointment(uuid, timestamptz, uuid), public.confirm_appointment(uuid),
  public.check_in(uuid), public.mark_no_show(uuid), public.start_consultation(uuid), public.complete_visit(uuid),
  public.reopen_visit(uuid, text), public.save_private_note(uuid, text),
  public.order_test(uuid, uuid, text), public.cancel_test(uuid), public.record_test_result(uuid, text, text, text),
  public.issue_medical_document(uuid, text, date, date, text, text), public.revoke_medical_document(uuid),
  public.rate_appointment(uuid, int, text), public.update_my_contact(text, text, text, text, text)
  to authenticated;
-- the website shows free times and checks QR codes for visitors
grant execute on function public.available_slots(uuid, date), public.doctor_open_days(uuid, int),
  public.verify_medical_document(text), public.riyadh_date(timestamptz) to anon, authenticated;
