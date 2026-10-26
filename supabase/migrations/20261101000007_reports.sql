-- =====================================================================
--  لوحة المؤشرات والتقارير
-- =====================================================================

-- today's operations + money at a glance (front desk sees the operational part, finance/admin the money)
create or replace function public.clinic_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_today date := public.riyadh_date(); r jsonb; v_fin boolean := public.is_finance();
begin
  if not public.is_billing() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select jsonb_build_object(
    'today_total',      count(*) filter (where status <> 'cancelled'),
    'today_waiting',    count(*) filter (where status = 'checked_in'),
    'today_in_room',    count(*) filter (where status = 'in_consultation'),
    'today_completed',  count(*) filter (where status = 'completed'),
    'today_upcoming',   count(*) filter (where status in ('booked', 'confirmed')),
    'today_no_show',    count(*) filter (where status = 'no_show'),
    'avg_wait_min',     round(avg(extract(epoch from (called_at - checked_in_at)) / 60) filter (where called_at is not null)::numeric, 0)
  ) into r
  from public.appointments where public.riyadh_date(starts_at) = v_today;

  r := r || jsonb_build_object(
    'week_booked', (select count(*) from public.appointments where status in ('booked', 'confirmed')
                      and public.riyadh_date(starts_at) between v_today + 1 and v_today + 7),
    'online_share_30', (select round(100.0 * count(*) filter (where source = 'online') / nullif(count(*), 0), 0)
                        from public.appointments where created_at > now() - interval '30 days'),
    'no_show_rate_30', (select round(100.0 * count(*) filter (where status = 'no_show')
                          / nullif(count(*) filter (where status in ('completed', 'no_show')), 0), 1)
                        from public.appointments where starts_at > now() - interval '30 days' and starts_at < now()),
    'rating_30', (select round(avg(score)::numeric, 2) from public.appointment_ratings where created_at > now() - interval '30 days'),
    'ratings_count_30', (select count(*) from public.appointment_ratings where created_at > now() - interval '30 days'),
    'new_patients_30', (select count(*) from public.patients where created_at > now() - interval '30 days'),
    'open_requests', (select count(*) from public.booking_requests where status in ('new', 'contacted')),
    'unpaid_count', (select count(*) from public.invoices where status in ('issued', 'partially_paid'))
  );
  if v_fin then
    r := r || jsonb_build_object(
      'collected_today', (select coalesce(sum(amount), 0) from public.payments where voided_at is null and public.riyadh_date(received_at) = v_today),
      'collected_month', (select coalesce(sum(amount), 0) from public.payments where voided_at is null
                            and date_trunc('month', received_at at time zone 'Asia/Riyadh') = date_trunc('month', now() at time zone 'Asia/Riyadh')),
      'billed_month', (select coalesce(sum(total), 0) from public.invoices where status not in ('draft', 'cancelled')
                            and date_trunc('month', created_at at time zone 'Asia/Riyadh') = date_trunc('month', now() at time zone 'Asia/Riyadh')),
      'claims_open_amount', (select coalesce(sum(insurance_amount), 0) from public.invoices
                               where payer = 'insurance' and status not in ('draft', 'cancelled') and claim_status in ('pending', 'submitted')),
      'claims_open_count', (select count(*) from public.invoices
                               where payer = 'insurance' and status not in ('draft', 'cancelled') and claim_status in ('pending', 'submitted')),
      'patient_balance', (select coalesce(sum(patient_amount - paid_amount), 0) from public.invoices where status in ('issued', 'partially_paid'))
    );
  end if;
  return r;
end $$;

-- the per-doctor load for today's board
create or replace function public.today_by_doctor()
returns table (doctor_id uuid, doctor_name_ar text, doctor_name_en text, clinic_name_ar text, clinic_name_en text,
               total int, waiting int, in_room int, done int, now_serving int)
language sql stable security definer set search_path = public as $$
  select d.id, d.full_name_ar, d.full_name_en, c.name_ar, c.name_en,
         count(a.id) filter (where a.status <> 'cancelled')::int,
         count(a.id) filter (where a.status = 'checked_in')::int,
         count(a.id) filter (where a.status = 'in_consultation')::int,
         count(a.id) filter (where a.status = 'completed')::int,
         max(a.queue_no) filter (where a.status = 'in_consultation')
  from public.doctors d join public.clinics c on c.id = d.clinic_id
  left join public.appointments a on a.doctor_id = d.id and public.riyadh_date(a.starts_at) = public.riyadh_date()
  where d.is_active and public.is_billing()
  group by d.id, d.full_name_ar, d.full_name_en, c.name_ar, c.name_en, c.sort
  having count(a.id) filter (where a.status <> 'cancelled') > 0
  order by c.sort, d.full_name_ar
$$;

-- waiting-room screen: who is being called now (no patient names — queue numbers only)
create or replace function public.queue_board()
returns table (clinic_ar text, clinic_en text, location_ar text, location_en text, doctor_ar text, doctor_en text,
               now_serving int, waiting int, called_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.name_ar, c.name_en, c.location_ar, c.location_en, d.full_name_ar, d.full_name_en,
         (select a.queue_no from public.appointments a where a.doctor_id = d.id and a.status = 'in_consultation'
            and public.riyadh_date(a.starts_at) = public.riyadh_date() order by a.called_at desc limit 1),
         (select count(*)::int from public.appointments a where a.doctor_id = d.id and a.status = 'checked_in'
            and public.riyadh_date(a.starts_at) = public.riyadh_date()),
         (select max(a.called_at) from public.appointments a where a.doctor_id = d.id
            and public.riyadh_date(a.starts_at) = public.riyadh_date())
  from public.doctors d join public.clinics c on c.id = d.clinic_id
  where d.is_active and public.auth_role() is not null and public.auth_role() <> 'patient'
    and exists (select 1 from public.appointments a where a.doctor_id = d.id and public.riyadh_date(a.starts_at) = public.riyadh_date()
                and a.status in ('checked_in', 'in_consultation', 'completed'))
  order by c.sort, d.full_name_ar
$$;

-- period report (admin / finance)
create or replace function public.report_summary(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_finance() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_to < p_from or p_to - p_from > 400 then raise exception 'INVALID_DATES' using errcode = 'P0001'; end if;

  with a as (select * from public.appointments where public.riyadh_date(starts_at) between p_from and p_to),
       i as (select * from public.invoices where status not in ('draft', 'cancelled') and public.riyadh_date(created_at) between p_from and p_to),
       p as (select * from public.payments where voided_at is null and public.riyadh_date(received_at) between p_from and p_to)
  select jsonb_build_object(
    'appointments', (select count(*) from a where status <> 'cancelled'),
    'completed', (select count(*) from a where status = 'completed'),
    'no_show', (select count(*) from a where status = 'no_show'),
    'cancelled', (select count(*) from a where status = 'cancelled'),
    'new_patients', (select count(*) from public.patients where public.riyadh_date(created_at) between p_from and p_to),
    'online', (select count(*) from a where source = 'online'),
    'avg_wait_min', (select round(avg(extract(epoch from (called_at - checked_in_at)) / 60)::numeric, 0) from a where called_at is not null),
    'billed', (select coalesce(sum(total), 0) from i),
    'vat', (select coalesce(sum(vat_amount), 0) from i),
    'discounts', (select coalesce(sum(discount), 0) from i),
    'insurance_billed', (select coalesce(sum(insurance_amount), 0) from i),
    'patient_billed', (select coalesce(sum(patient_amount), 0) from i),
    'collected', (select coalesce(sum(amount), 0) from p),
    'rating', (select round(avg(score)::numeric, 2) from public.appointment_ratings where public.riyadh_date(created_at) between p_from and p_to),
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status::text, count(*) n from a group by 1) s),
    'by_method', (select coalesce(jsonb_object_agg(method, total), '{}') from (select method, sum(amount) total from p group by 1) s),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', dd::date,
                 'appointments', (select count(*) from a where public.riyadh_date(a.starts_at) = dd::date and a.status <> 'cancelled'),
                 'collected', (select coalesce(sum(amount), 0) from p where public.riyadh_date(p.received_at) = dd::date)) order by dd), '[]')
              from generate_series(p_from, p_to, interval '1 day') dd),
    'by_clinic', (select coalesce(jsonb_agg(x order by (x ->> 'appointments')::int desc), '[]') from (
        select jsonb_build_object('name_ar', c.name_ar, 'name_en', c.name_en,
          'appointments', count(a.id) filter (where a.status <> 'cancelled'),
          'completed', count(a.id) filter (where a.status = 'completed'),
          'no_show', count(a.id) filter (where a.status = 'no_show'),
          'billed', coalesce((select sum(i.total) from i join public.appointments a2 on a2.id = i.appointment_id where a2.clinic_id = c.id), 0)) x
        from public.clinics c left join a on a.clinic_id = c.id group by c.id, c.name_ar, c.name_en) s),
    'by_doctor', (select coalesce(jsonb_agg(x order by (x ->> 'completed')::int desc), '[]') from (
        select jsonb_build_object('name_ar', d.full_name_ar, 'name_en', coalesce(d.full_name_en, d.full_name_ar),
          'clinic_ar', c.name_ar, 'clinic_en', c.name_en,
          'appointments', count(a.id) filter (where a.status <> 'cancelled'),
          'completed', count(a.id) filter (where a.status = 'completed'),
          'no_show', count(a.id) filter (where a.status = 'no_show'),
          'avg_wait', round(avg(extract(epoch from (a.called_at - a.checked_in_at)) / 60)::numeric, 0),
          'rating', (select round(avg(score)::numeric, 1) from public.appointment_ratings rt where rt.doctor_id = d.id
                       and public.riyadh_date(rt.created_at) between p_from and p_to),
          'billed', coalesce((select sum(i.total) from i join public.appointments a2 on a2.id = i.appointment_id where a2.doctor_id = d.id), 0)) x
        from public.doctors d join public.clinics c on c.id = d.clinic_id left join a on a.doctor_id = d.id
        group by d.id, d.full_name_ar, d.full_name_en, c.name_ar, c.name_en) s),
    'by_insurer', (select coalesce(jsonb_agg(x order by (x ->> 'amount')::numeric desc), '[]') from (
        select jsonb_build_object('name_ar', ic.name_ar, 'name_en', coalesce(ic.name_en, ic.name_ar),
          'invoices', count(*), 'amount', sum(i.insurance_amount),
          'approved', sum(coalesce(i.claim_approved_amount, 0)) filter (where i.claim_status in ('approved', 'partially_approved', 'paid')),
          'rejected', count(*) filter (where i.claim_status = 'rejected'),
          'open', sum(i.insurance_amount) filter (where i.claim_status in ('pending', 'submitted'))) x
        from i join public.insurance_companies ic on ic.id = i.insurance_company_id where i.payer = 'insurance'
        group by ic.id, ic.name_ar, ic.name_en) s),
    'top_diagnoses', (select coalesce(jsonb_agg(x), '[]') from (
        select jsonb_build_object('diagnosis', min(v.diagnosis), 'code', v.icd10_code, 'count', count(*)) x
        from public.visits v join a on a.id = v.appointment_id
        where v.status = 'signed' and v.icd10_code is not null
        group by v.icd10_code order by count(*) desc limit 10) s)
  ) into r;
  return r;
end $$;

revoke execute on function public.clinic_dashboard(), public.today_by_doctor(), public.queue_board(), public.report_summary(date, date)
  from public, anon;
grant execute on function public.clinic_dashboard(), public.today_by_doctor(), public.queue_board(), public.report_summary(date, date)
  to authenticated;
