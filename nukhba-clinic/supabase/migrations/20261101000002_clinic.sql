-- =====================================================================
--  العيادات والأطباء والمرضى والمواعيد والسجل الطبي
-- =====================================================================

-- ---------------------------------------------------------------------
-- Clinics (specialties) & doctors
-- ---------------------------------------------------------------------
create table public.clinics (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique check (code ~ '^[a-z0-9_-]{2,30}$'),
  name_ar         text not null,
  name_en         text not null,
  description_ar  text,
  description_en  text,
  icon            text not null default 'stethoscope',
  image_url       text,
  location_ar     text,              -- e.g. الدور الأول — جناح ب
  location_en     text,
  sort            int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create table public.doctors (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid unique references public.profiles (id) on delete set null,
  clinic_id         uuid not null references public.clinics (id) on delete restrict,
  full_name_ar      text not null,
  full_name_en      text,
  title             text not null default 'specialist' check (title in ('consultant', 'specialist', 'resident', 'gp')),
  gender            text not null default 'male' check (gender in ('male', 'female')),
  specialty_ar      text,             -- sub-specialty, e.g. تقويم الأسنان
  specialty_en      text,
  bio_ar            text,
  bio_en            text,
  photo_url         text,
  languages         text[] not null default '{ar}',
  qualifications    text,
  years_experience  int check (years_experience is null or years_experience between 0 and 70),
  scfhs_no          text,             -- رقم التصنيف المهني
  consultation_fee  numeric(10,2) not null default 0 check (consultation_fee >= 0),
  follow_up_fee     numeric(10,2) not null default 0 check (follow_up_fee >= 0),
  slot_minutes      int not null default 20 check (slot_minutes between 5 and 120),
  accepts_online    boolean not null default true,
  show_public       boolean not null default true,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);
create index on public.doctors (clinic_id);

-- weekly working hours (Riyadh local time). weekday: 0 = Sunday … 6 = Saturday
create table public.doctor_schedules (
  id          uuid primary key default gen_random_uuid(),
  doctor_id   uuid not null references public.doctors (id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),
  start_time  time not null,
  end_time    time not null,
  check (end_time > start_time),
  unique (doctor_id, weekday, start_time)
);

create table public.doctor_time_off (
  id          uuid primary key default gen_random_uuid(),
  doctor_id   uuid not null references public.doctors (id) on delete cascade,
  from_date   date not null,
  to_date     date not null,
  reason      text,
  created_at  timestamptz not null default now(),
  check (to_date >= from_date)
);
create index on public.doctor_time_off (doctor_id, from_date);

-- ---------------------------------------------------------------------
-- Insurance & price list
-- ---------------------------------------------------------------------
create table public.insurance_companies (
  id                 uuid primary key default gen_random_uuid(),
  code               text unique,
  name_ar            text not null,
  name_en            text,
  coverage_percent   numeric(5,2) not null default 80 check (coverage_percent between 0 and 100),  -- insurer's share
  max_copay          numeric(10,2) check (max_copay is null or max_copay >= 0),                 -- cap on patient share per invoice
  requires_approval  boolean not null default false,
  phone              text,
  email              text,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);

create table public.services (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name_ar     text not null,
  name_en     text,
  kind        text not null default 'procedure'
              check (kind in ('consultation', 'follow_up', 'procedure', 'lab', 'radiology', 'other')),
  clinic_id   uuid references public.clinics (id) on delete set null,
  price       numeric(10,2) not null default 0 check (price >= 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Patients
-- ---------------------------------------------------------------------
create sequence public.patient_file_seq start 100001;

create table public.patients (
  id                    uuid primary key default gen_random_uuid(),
  file_no               text not null unique default ('P' || nextval('public.patient_file_seq')),
  profile_id            uuid unique references public.profiles (id) on delete set null,
  full_name             text not null check (length(btrim(full_name)) >= 2),
  full_name_en          text,
  national_id           text unique check (national_id is null or national_id ~ '^[12][0-9]{9}$'),
  is_saudi              boolean not null default true,
  nationality           text,
  gender                text not null default 'male' check (gender in ('male', 'female')),
  birth_date            date check (birth_date is null or birth_date <= current_date),
  phone                 text not null,
  email                 text,
  city                  text default 'جدة',
  blood_type            text check (blood_type is null or blood_type in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  allergies             text,
  chronic_conditions    text,
  current_medications   text,
  insurance_company_id  uuid references public.insurance_companies (id) on delete set null,
  insurance_member_no   text,
  insurance_class       text,
  insurance_expiry      date,
  emergency_name        text,
  emergency_phone       text,
  account_status        text not null default 'none' check (account_status in ('none', 'active', 'disabled')),
  notes                 text,
  created_by            uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index on public.patients (phone);
create index on public.patients (lower(full_name));
create trigger trg_patients_touch before update on public.patients for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------
create type public.appointment_status as enum (
  'booked',           -- محجوز
  'confirmed',        -- مؤكد
  'checked_in',       -- حضر (في الانتظار)
  'in_consultation',  -- عند الطبيب
  'completed',        -- مكتمل
  'cancelled',        -- ملغي
  'no_show'           -- لم يحضر
);

create sequence public.appointment_ref_seq start 10001;

create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  ref_no           text not null unique
                   default ('AP-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.appointment_ref_seq')::text, 5, '0')),
  patient_id       uuid not null references public.patients (id) on delete restrict,
  doctor_id        uuid not null references public.doctors (id) on delete restrict,
  clinic_id        uuid not null references public.clinics (id) on delete restrict,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  visit_type       text not null default 'new' check (visit_type in ('new', 'follow_up')),
  source           text not null default 'reception' check (source in ('online', 'reception', 'phone', 'website')),
  status           public.appointment_status not null default 'booked',
  reason           text,
  cancel_reason    text,
  queue_no         int,
  confirmed_at     timestamptz,
  checked_in_at    timestamptz,
  called_at        timestamptz,
  completed_at     timestamptz,
  cancelled_at     timestamptz,
  reminder_sent_at timestamptz,
  created_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (ends_at > starts_at)
);
-- a doctor can't be double-booked
create unique index appointments_doctor_slot on public.appointments (doctor_id, starts_at)
  where status not in ('cancelled', 'no_show');
create index on public.appointments (patient_id, starts_at desc);
create index on public.appointments (starts_at);
create index on public.appointments (status);
create trigger trg_appointments_touch before update on public.appointments for each row execute function public.touch_updated_at();

alter table public.notifications add constraint notifications_appointment_fk
  foreign key (appointment_id) references public.appointments (id) on delete cascade;
alter table public.activity_logs add constraint activity_logs_appointment_fk
  foreign key (appointment_id) references public.appointments (id) on delete cascade;

-- ---------------------------------------------------------------------
-- Medical record
-- ---------------------------------------------------------------------
create table public.visits (
  id                 uuid primary key default gen_random_uuid(),
  appointment_id     uuid not null unique references public.appointments (id) on delete restrict,
  patient_id         uuid not null references public.patients (id) on delete restrict,
  doctor_id          uuid not null references public.doctors (id) on delete restrict,
  clinic_id          uuid not null references public.clinics (id) on delete restrict,
  bp_systolic        int check (bp_systolic is null or bp_systolic between 40 and 300),
  bp_diastolic       int check (bp_diastolic is null or bp_diastolic between 20 and 200),
  pulse              int check (pulse is null or pulse between 20 and 250),
  temperature        numeric(4,1) check (temperature is null or temperature between 30 and 45),
  resp_rate          int check (resp_rate is null or resp_rate between 4 and 80),
  spo2               int check (spo2 is null or spo2 between 50 and 100),
  weight_kg          numeric(5,1) check (weight_kg is null or weight_kg between 0.5 and 400),
  height_cm          numeric(5,1) check (height_cm is null or height_cm between 30 and 250),
  chief_complaint    text,
  history            text,
  examination        text,
  diagnosis          text,
  icd10_code         text,
  plan               text,
  patient_advice     text,      -- shown to the patient in the portal
  follow_up_in_days  int check (follow_up_in_days is null or follow_up_in_days between 1 and 365),
  status             text not null default 'open' check (status in ('open', 'signed')),
  signed_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on public.visits (patient_id, created_at desc);
create index on public.visits (doctor_id, created_at desc);
create trigger trg_visits_touch before update on public.visits for each row execute function public.touch_updated_at();

-- doctors' private notes — never shown to patients or non-clinical staff
create table public.visit_private_notes (
  visit_id    uuid primary key references public.visits (id) on delete cascade,
  body        text not null default '',
  updated_at  timestamptz not null default now()
);

create table public.prescription_items (
  id            uuid primary key default gen_random_uuid(),
  visit_id      uuid not null references public.visits (id) on delete cascade,
  drug_name     text not null check (length(btrim(drug_name)) >= 2),
  dose          text,
  frequency     text,
  duration      text,
  route         text default 'oral',
  instructions  text,
  created_at    timestamptz not null default now()
);
create index on public.prescription_items (visit_id);

create table public.lab_orders (
  id           uuid primary key default gen_random_uuid(),
  visit_id     uuid not null references public.visits (id) on delete cascade,
  patient_id   uuid not null references public.patients (id) on delete cascade,
  service_id   uuid references public.services (id) on delete set null,
  test_name    text not null,
  kind         text not null default 'lab' check (kind in ('lab', 'radiology')),
  status       text not null default 'ordered' check (status in ('ordered', 'collected', 'resulted', 'cancelled')),
  result_text  text,
  result_flag  text check (result_flag is null or result_flag in ('normal', 'abnormal', 'critical')),
  result_file  text,
  resulted_by  uuid references public.profiles (id) on delete set null,
  resulted_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index on public.lab_orders (patient_id, created_at desc);
create index on public.lab_orders (status);

create sequence public.medical_doc_seq start 1001;
create table public.medical_documents (
  id           uuid primary key default gen_random_uuid(),
  ref_no       text not null unique default ('MD-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.medical_doc_seq')::text, 5, '0')),
  visit_id     uuid not null references public.visits (id) on delete cascade,
  patient_id   uuid not null references public.patients (id) on delete cascade,
  doctor_id    uuid not null references public.doctors (id) on delete restrict,
  kind         text not null check (kind in ('sick_leave', 'medical_report', 'referral')),
  from_date    date,
  to_date      date,
  body         text,
  referral_to  text,
  verify_code  text not null unique default replace(gen_random_uuid()::text, '-', ''),
  issued_at    timestamptz not null default now(),
  revoked_at   timestamptz,
  check (kind <> 'sick_leave' or (from_date is not null and to_date is not null and to_date >= from_date))
);
create index on public.medical_documents (patient_id, issued_at desc);

create table public.appointment_ratings (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid not null unique references public.appointments (id) on delete cascade,
  patient_id      uuid not null references public.patients (id) on delete cascade,
  doctor_id       uuid not null references public.doctors (id) on delete cascade,
  score           smallint not null check (score between 1 and 5),
  comment         text check (comment is null or length(comment) <= 1000),
  created_at      timestamptz not null default now()
);

-- files: lab/radiology results, scanned reports. path: <patient_id>/<uuid>-<name>
create table public.patient_files (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients (id) on delete cascade,
  visit_id      uuid references public.visits (id) on delete set null,
  lab_order_id  uuid references public.lab_orders (id) on delete set null,
  storage_path  text not null unique,
  file_name     text not null,
  mime_type     text,
  size_bytes    bigint,
  uploaded_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);
create index on public.patient_files (patient_id);

-- ---------------------------------------------------------------------
-- Who am I
-- ---------------------------------------------------------------------
create or replace function public.my_patient_id()
returns uuid language sql stable security definer set search_path = public as $$
  select pt.id from public.patients pt join public.profiles p on p.id = pt.profile_id
  where pt.profile_id = auth.uid() and pt.account_status = 'active' and p.is_active
$$;

create or replace function public.my_doctor_id()
returns uuid language sql stable security definer set search_path = public as $$
  select d.id from public.doctors d join public.profiles p on p.id = d.profile_id
  where d.profile_id = auth.uid() and d.is_active and p.is_active and p.role = 'doctor'
$$;

-- clinical access: the patient, the center admin, and any doctor who has seen / will see this patient
create or replace function public.can_view_patient_clinical(p_patient uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or p_patient = public.my_patient_id()
      or exists (select 1 from public.appointments a
                 where a.patient_id = p_patient and a.doctor_id = public.my_doctor_id()
                   and a.status not in ('cancelled'))
$$;

-- demographic access (name, phone, insurance): front desk, billing, treating doctors, the patient
create or replace function public.can_view_patient(p_patient uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_billing() or public.can_view_patient_clinical(p_patient)
$$;

create or replace function public.can_view_appointment(p_appt uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_billing()
      or exists (select 1 from public.appointments a where a.id = p_appt
                 and (a.patient_id = public.my_patient_id() or a.doctor_id = public.my_doctor_id()))
$$;

create or replace function public.can_view_visit(p_visit uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.visits v where v.id = p_visit
                 and (public.can_view_patient_clinical(v.patient_id))
                 -- patients see a visit only after the doctor signs it
                 and (v.status = 'signed' or v.patient_id is distinct from public.my_patient_id()))
$$;

-- the doctor may still write this visit
create or replace function public.can_edit_visit(p_visit uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.visits v where v.id = p_visit and v.status = 'open'
                 and (v.doctor_id = public.my_doctor_id() or public.is_admin()))
$$;

create or replace function public.appointment_patient_profile(p_appt uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select pt.profile_id from public.appointments a join public.patients pt on pt.id = a.patient_id
  where a.id = p_appt and pt.account_status = 'active'
$$;

create or replace function public.appointment_doctor_profile(p_appt uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select d.profile_id from public.appointments a join public.doctors d on d.id = a.doctor_id where a.id = p_appt
$$;

-- the website's message sender (service role) claims a batch, sends, then reports back via finish_outbox
create or replace function public.claim_outbox(p_limit int default 20)
returns table (outbox_id uuid, channel text, type text, appointment_id uuid, payload jsonb,
               phone text, email text, full_name text, locale text, role text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with picked as (
    select x.id from public.notification_outbox x
    where (x.status = 'pending' or (x.status = 'sending' and x.claimed_at < now() - interval '10 minutes'))
      and x.attempts < 5 and x.created_at > now() - interval '3 days'
    order by x.created_at
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  ), upd as (
    update public.notification_outbox x set status = 'sending', claimed_at = now(), attempts = x.attempts + 1
    from picked where x.id = picked.id
    returning x.id, x.channel, x.notification_id
  )
  select upd.id, upd.channel, n.type, n.appointment_id, n.payload,
         coalesce(nullif(pr.phone, ''), pt.phone), coalesce(pr.email, pt.email), pr.full_name, pr.locale, pr.role::text
  from upd
  join public.notifications n on n.id = upd.notification_id
  join public.profiles pr on pr.id = n.user_id
  left join public.patients pt on pt.profile_id = pr.id;
end $$;

revoke execute on function public.claim_outbox(int), public.appointment_patient_profile(uuid), public.appointment_doctor_profile(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_outbox(int) to service_role;
