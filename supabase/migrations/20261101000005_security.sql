-- =====================================================================
--  الصلاحيات في قاعدة البيانات (Row Level Security)
--  • المريض لا يرى إلا ملفه ومواعيده وزياراته الموقّعة وفواتيره
--  • الطبيب يرى السجل الطبي لمن حجز أو كشف عنده فقط
--  • الاستقبال والمحاسبة لا يرون الملاحظات السريرية (التشخيص والوصفات والتحاليل)
--  • الملاحظات الخاصة للطبيب لا يراها أحد غيره
-- =====================================================================

revoke all on all tables in schema public from anon;
grant select on public.company_settings to anon;

do $$
declare t text;
begin
  foreach t in array array['roles', 'profiles', 'company_settings', 'notifications', 'notification_outbox', 'activity_logs',
    'clinics', 'doctors', 'doctor_schedules', 'doctor_time_off', 'insurance_companies', 'services', 'patients',
    'appointments', 'visits', 'visit_private_notes', 'prescription_items', 'lab_orders', 'medical_documents',
    'appointment_ratings', 'patient_files', 'invoices', 'invoice_items', 'payments']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- writes that must go through the workflow functions
revoke insert, update, delete on public.appointments, public.visit_private_notes, public.lab_orders, public.medical_documents,
  public.appointment_ratings, public.invoices, public.invoice_items, public.payments, public.activity_logs,
  public.notification_outbox, public.roles
  from authenticated;
revoke select on public.notification_outbox from authenticated;
revoke update on public.notifications from authenticated;
grant  update (read_at) on public.notifications to authenticated;
revoke insert, delete on public.notifications, public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant  update (full_name, phone, locale, notify_external) on public.profiles to authenticated;
revoke insert, delete on public.company_settings from authenticated;
-- visits: the doctor fills the clinical fields; status / links change only via functions
revoke insert, update, delete on public.visits from authenticated;
grant  update (bp_systolic, bp_diastolic, pulse, temperature, resp_rate, spo2, weight_kg, height_cm, chief_complaint, history,
               examination, diagnosis, icd10_code, plan, patient_advice, follow_up_in_days) on public.visits to authenticated;
grant usage on sequence public.patient_file_seq to authenticated;

-- ---------------------------------------------------------------------
-- Accounts & settings
-- ---------------------------------------------------------------------
create policy roles_read on public.roles for select to authenticated using (true);

create policy settings_read  on public.company_settings for select to anon, authenticated using (true);
create policy settings_admin on public.company_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin()
         -- staff see staff names (assignments, logs); front desk sees patients' accounts
         or (public.auth_role() <> 'patient' and role <> 'patient')
         or (public.is_staff() and role = 'patient'));
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy notifications_own_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy logs_read on public.activity_logs for select to authenticated
  using ((appointment_id is not null and public.auth_role() <> 'patient' and public.can_view_appointment(appointment_id))
         or (entity = 'invoice' and public.is_billing()));

-- ---------------------------------------------------------------------
-- Clinics, doctors, schedules, price list, insurers
-- ---------------------------------------------------------------------
create policy clinics_read  on public.clinics for select to authenticated using (true);
create policy clinics_admin on public.clinics for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy doctors_read  on public.doctors for select to authenticated using (true);
create policy doctors_admin on public.doctors for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy schedules_read  on public.doctor_schedules for select to authenticated using (true);
create policy schedules_admin on public.doctor_schedules for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy timeoff_read  on public.doctor_time_off for select to authenticated using (public.auth_role() <> 'patient');
create policy timeoff_write on public.doctor_time_off for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy services_read  on public.services for select to authenticated using (true);
create policy services_write on public.services for all to authenticated using (public.is_finance()) with check (public.is_finance());

create policy insurers_read  on public.insurance_companies for select to authenticated using (true);
create policy insurers_write on public.insurance_companies for all to authenticated using (public.is_finance()) with check (public.is_finance());

-- ---------------------------------------------------------------------
-- Patients
-- ---------------------------------------------------------------------
create policy patients_read on public.patients for select to authenticated using (public.can_view_patient(id));
create policy patients_insert on public.patients for insert to authenticated with check (public.is_staff());
create policy patients_update on public.patients for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy patients_delete on public.patients for delete to authenticated using (public.is_admin());

-- the patient-portal link and account status are set only by the server (service role)
create or replace function public.guard_patient_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and (new.profile_id is distinct from old.profile_id or new.account_status is distinct from old.account_status)
     and not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  -- clinical alerts in the file (allergies / chronic) may also be updated by the treating doctor via the visit screen
  return new;
end $$;
create trigger trg_guard_patient before update on public.patients for each row execute function public.guard_patient_update();

-- doctors can keep the allergy / chronic-condition alerts current for their patients
create or replace function public.update_patient_alerts(p_patient uuid, p_allergies text, p_chronic text, p_meds text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_staff() or (public.my_doctor_id() is not null and public.can_view_patient_clinical(p_patient))) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.patients set allergies = left(nullif(btrim(p_allergies), ''), 1000), chronic_conditions = left(nullif(btrim(p_chronic), ''), 1000),
    current_medications = left(nullif(btrim(p_meds), ''), 1000) where id = p_patient;
end $$;
revoke execute on function public.update_patient_alerts(uuid, text, text, text) from public, anon;
grant execute on function public.update_patient_alerts(uuid, text, text, text) to authenticated;
revoke execute on function public.guard_patient_update() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------
create policy appointments_read on public.appointments for select to authenticated
  using (public.is_billing() or patient_id = public.my_patient_id() or doctor_id = public.my_doctor_id());

create policy ratings_read on public.appointment_ratings for select to authenticated
  using (public.is_staff() or patient_id = public.my_patient_id() or doctor_id = public.my_doctor_id());

-- ---------------------------------------------------------------------
-- Medical record
-- ---------------------------------------------------------------------
create policy visits_read on public.visits for select to authenticated using (public.can_view_visit(id));
create policy visits_doctor_update on public.visits for update to authenticated
  using (public.can_edit_visit(id)) with check (public.can_edit_visit(id));

create policy private_notes_read on public.visit_private_notes for select to authenticated
  using (exists (select 1 from public.visits v where v.id = visit_id and (v.doctor_id = public.my_doctor_id())));

create policy rx_read on public.prescription_items for select to authenticated using (public.can_view_visit(visit_id));
create policy rx_insert on public.prescription_items for insert to authenticated with check (public.can_edit_visit(visit_id));
create policy rx_update on public.prescription_items for update to authenticated using (public.can_edit_visit(visit_id)) with check (public.can_edit_visit(visit_id));
create policy rx_delete on public.prescription_items for delete to authenticated using (public.can_edit_visit(visit_id));

-- patients see a test once its result is out
create policy tests_read on public.lab_orders for select to authenticated
  using (public.can_view_patient_clinical(patient_id)
         and (patient_id is distinct from public.my_patient_id() or status = 'resulted'));

create policy docs_read on public.medical_documents for select to authenticated
  using (public.can_view_patient_clinical(patient_id) and (revoked_at is null or public.auth_role() <> 'patient'));

create policy files_read on public.patient_files for select to authenticated using (public.can_view_patient_clinical(patient_id));
create policy files_insert on public.patient_files for insert to authenticated
  with check (uploaded_by = auth.uid() and (public.is_admin() or (public.my_doctor_id() is not null and public.can_view_patient_clinical(patient_id))));
create policy files_delete on public.patient_files for delete to authenticated using (uploaded_by = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- Billing
-- ---------------------------------------------------------------------
create policy invoices_read on public.invoices for select to authenticated
  using (public.is_billing() or (patient_id = public.my_patient_id() and status <> 'draft'));
create policy items_read on public.invoice_items for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id));    -- invoices RLS applies inside
create policy payments_read on public.payments for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id));

-- ---------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('medical', 'medical', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']),
  ('branding', 'branding', true, 5242880, array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.patient_id_from_path(p_name text)
returns uuid language plpgsql immutable set search_path = public as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end $$;

create policy "medical read" on storage.objects for select to authenticated
  using (bucket_id = 'medical' and public.can_view_patient_clinical(public.patient_id_from_path(name)));
create policy "medical upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'medical' and (public.is_admin()
              or (public.my_doctor_id() is not null and public.can_view_patient_clinical(public.patient_id_from_path(name)))));
create policy "medical delete" on storage.objects for delete to authenticated
  using (bucket_id = 'medical' and (owner_id = auth.uid()::text or public.is_admin()));

-- the logo is served from its public URL; only admins use the API on this bucket
create policy "branding admin read" on storage.objects for select to authenticated using (bucket_id = 'branding' and public.is_admin());
create policy "branding write"  on storage.objects for insert to authenticated with check (bucket_id = 'branding' and public.is_admin());
create policy "branding update" on storage.objects for update to authenticated using (bucket_id = 'branding' and public.is_admin());
create policy "branding delete" on storage.objects for delete to authenticated using (bucket_id = 'branding' and public.is_admin());

-- ---------------------------------------------------------------------
-- Helper functions: signed-out visitors never need them
-- ---------------------------------------------------------------------
revoke execute on function
  public.auth_role(), public.is_admin(), public.is_staff(), public.is_billing(), public.is_finance(), public.is_hr(),
  public.my_patient_id(), public.my_doctor_id(), public.can_view_patient_clinical(uuid), public.can_view_patient(uuid),
  public.can_view_appointment(uuid), public.can_view_visit(uuid), public.can_edit_visit(uuid)
from public, anon;
grant execute on function
  public.auth_role(), public.is_admin(), public.is_staff(), public.is_billing(), public.is_finance(), public.is_hr(),
  public.my_patient_id(), public.my_doctor_id(), public.can_view_patient_clinical(uuid), public.can_view_patient(uuid),
  public.can_view_appointment(uuid), public.can_view_visit(uuid), public.can_edit_visit(uuid)
to authenticated;
