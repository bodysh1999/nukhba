-- =====================================================================
--  الموقع العام: العيادات والأطباء والأسعار وشركات التأمين للزوار،
--  طلب حجز من الزائر (بدون حساب) ← صندوق الاستقبال، والتوظيف
-- =====================================================================

-- ---------------------------------------------------------------------
-- What visitors may read (no patient data ever)
-- ---------------------------------------------------------------------
grant select (id, code, name_ar, name_en, description_ar, description_en, icon, image_url, location_ar, location_en, sort, is_active)
  on public.clinics to anon;
grant select (id, clinic_id, full_name_ar, full_name_en, title, gender, specialty_ar, specialty_en, bio_ar, bio_en, photo_url,
              languages, qualifications, years_experience, consultation_fee, follow_up_fee, slot_minutes, accepts_online, show_public, is_active)
  on public.doctors to anon;
grant select (id, doctor_id, weekday, start_time, end_time) on public.doctor_schedules to anon;
grant select (id, code, name_ar, name_en, kind, clinic_id, price, is_active) on public.services to anon;
grant select (id, name_ar, name_en, is_active) on public.insurance_companies to anon;

create policy clinics_public   on public.clinics  for select to anon using (is_active);
create policy doctors_public   on public.doctors  for select to anon using (is_active and show_public);
create policy schedules_public on public.doctor_schedules for select to anon
  using (exists (select 1 from public.doctors d where d.id = doctor_id and d.is_active and d.show_public));
create policy services_public  on public.services for select to anon using (is_active);
create policy insurers_public  on public.insurance_companies for select to anon using (is_active);

-- rating summary per doctor for the website (no comments, no names)
create or replace function public.doctor_ratings()
returns table (doctor_id uuid, avg_score numeric, ratings int)
language sql stable security definer set search_path = public as $$
  select doctor_id, round(avg(score)::numeric, 1), count(*)::int from public.appointment_ratings group by doctor_id
$$;
grant execute on function public.doctor_ratings() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Booking requests from visitors → reception
-- ---------------------------------------------------------------------
create sequence public.booking_request_seq start 1001;

create table public.booking_requests (
  id              uuid primary key default gen_random_uuid(),
  ref_no          text not null unique default ('BR-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.booking_request_seq')::text, 5, '0')),
  full_name       text not null,
  phone           text not null,
  email           text,
  clinic_id       uuid references public.clinics (id) on delete set null,
  doctor_id       uuid references public.doctors (id) on delete set null,
  preferred_date  date,
  preferred_time  text check (preferred_time is null or preferred_time in ('morning', 'afternoon', 'evening', 'any')),
  insurance_name  text,
  message         text,
  status          text not null default 'new' check (status in ('new', 'contacted', 'booked', 'cancelled')),
  appointment_id  uuid references public.appointments (id) on delete set null,
  handled_by      uuid references public.profiles (id) on delete set null,
  internal_notes  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.booking_requests (status, created_at desc);
create trigger trg_booking_requests_touch before update on public.booking_requests for each row execute function public.touch_updated_at();

create or replace function public.submit_booking_request(
  p_name text, p_phone text, p_clinic uuid default null, p_doctor uuid default null,
  p_date date default null, p_time text default null, p_email text default null, p_insurance text default null, p_message text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_phone text := public.normalize_phone(p_phone); v_ref text; v_clinic uuid := p_clinic;
begin
  if length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'NAME_REQUIRED' using errcode = 'P0001'; end if;
  if v_phone !~ '^(\+?966|0)?5[0-9]{8}$' then raise exception 'INVALID_PHONE' using errcode = 'P0001'; end if;
  if coalesce(p_email, '') <> '' and p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'INVALID_EMAIL' using errcode = 'P0001'; end if;
  if p_date is not null and p_date < public.riyadh_date() then raise exception 'DATE_IN_PAST' using errcode = 'P0001'; end if;
  if p_time is not null and p_time not in ('morning', 'afternoon', 'evening', 'any') then raise exception 'INVALID_INPUT' using errcode = 'P0001'; end if;
  if p_doctor is not null then
    select clinic_id into v_clinic from public.doctors where id = p_doctor and is_active and show_public;
    if v_clinic is null then raise exception 'DOCTOR_UNAVAILABLE' using errcode = 'P0001'; end if;
  end if;
  if v_clinic is null then raise exception 'CLINIC_REQUIRED' using errcode = 'P0001'; end if;
  if (select count(*) from public.booking_requests where phone = v_phone and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = 'P0001';
  end if;
  insert into public.booking_requests (full_name, phone, email, clinic_id, doctor_id, preferred_date, preferred_time, insurance_name, message)
  values (left(btrim(p_name), 120), v_phone, nullif(lower(btrim(p_email)), ''), v_clinic, p_doctor, p_date, p_time,
          left(nullif(btrim(p_insurance), ''), 80), left(nullif(btrim(p_message), ''), 1000))
  returning ref_no into v_ref;
  perform public.notify_role(array['admin', 'reception'], 'booking_request_new',
    jsonb_build_object('ref_no', v_ref, 'name', left(btrim(p_name), 60), 'link', '/reception/requests'));
  return v_ref;
end $$;

-- reception links a request to the appointment it booked (or closes it)
create or replace function public.handle_booking_request(p_id uuid, p_status text, p_appointment uuid default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_status not in ('new', 'contacted', 'booked', 'cancelled') then raise exception 'INVALID_INPUT' using errcode = 'P0001'; end if;
  if p_status = 'booked' and p_appointment is null then raise exception 'APPOINTMENT_REQUIRED' using errcode = 'P0001'; end if;
  update public.booking_requests set status = p_status, appointment_id = coalesce(p_appointment, appointment_id),
    handled_by = auth.uid(), internal_notes = coalesce(nullif(btrim(p_note), ''), internal_notes)
  where id = p_id;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
end $$;

alter table public.booking_requests enable row level security;
revoke all on public.booking_requests from anon;
revoke insert, update, delete on public.booking_requests from authenticated;
create policy booking_requests_read on public.booking_requests for select to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------
-- Careers → HR
-- ---------------------------------------------------------------------
create table public.job_openings (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  department   text,
  location     text not null default 'جدة',
  employment   text not null default 'full_time' check (employment in ('full_time', 'part_time', 'contract', 'training')),
  description  text,
  requirements text,
  is_open      boolean not null default true,
  created_at   timestamptz not null default now()
);

create sequence public.application_ref_seq start 1001;

create table public.job_applications (
  id               uuid primary key default gen_random_uuid(),
  ref_no           text not null unique default ('HR-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.application_ref_seq')::text, 5, '0')),
  kind             text not null check (kind in ('job', 'training')),
  opening_id       uuid references public.job_openings (id) on delete set null,
  full_name        text not null,
  phone            text not null,
  email            text not null,
  city             text,
  education        text,
  major            text,
  university       text,
  experience_years int check (experience_years is null or experience_years between 0 and 60),
  linkedin_url     text,
  cv_path          text,
  cover_note       text,
  training_from    date,
  training_to      date,
  status           text not null default 'new'
                   check (status in ('new', 'screening', 'interview', 'offer', 'hired', 'accepted', 'rejected', 'archived')),
  internal_notes   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.job_applications (status, created_at desc);
create trigger trg_applications_touch before update on public.job_applications for each row execute function public.touch_updated_at();

create or replace function public.submit_application(
  p_kind text, p_name text, p_phone text, p_email text,
  p_opening uuid default null, p_city text default null, p_education text default null, p_major text default null,
  p_university text default null, p_experience int default null, p_linkedin text default null, p_cv_path text default null,
  p_note text default null, p_training_from date default null, p_training_to date default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_phone text := public.normalize_phone(p_phone); v_ref text;
begin
  if p_kind not in ('job', 'training') then raise exception 'INVALID_KIND' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'NAME_REQUIRED' using errcode = 'P0001'; end if;
  if v_phone !~ '^(\+?966|0)?5[0-9]{8}$' then raise exception 'INVALID_PHONE' using errcode = 'P0001'; end if;
  if coalesce(p_email, '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'INVALID_EMAIL' using errcode = 'P0001'; end if;
  if p_cv_path is not null and p_cv_path !~ '^applications/[0-9a-f-]{36}\.(pdf|doc|docx)$' then raise exception 'INVALID_FILE' using errcode = 'P0001'; end if;
  if p_opening is not null and not exists (select 1 from public.job_openings where id = p_opening and is_open) then
    raise exception 'OPENING_CLOSED' using errcode = 'P0001';
  end if;
  if (select count(*) from public.job_applications where lower(email) = lower(btrim(p_email)) and created_at > now() - interval '1 day') >= 3 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = 'P0001';
  end if;
  insert into public.job_applications (kind, opening_id, full_name, phone, email, city, education, major, university,
    experience_years, linkedin_url, cv_path, cover_note, training_from, training_to)
  values (p_kind, p_opening, left(btrim(p_name), 120), v_phone, lower(btrim(p_email)), left(nullif(btrim(p_city), ''), 60),
    left(nullif(btrim(p_education), ''), 60), left(nullif(btrim(p_major), ''), 120), left(nullif(btrim(p_university), ''), 120),
    p_experience, left(nullif(btrim(p_linkedin), ''), 300), p_cv_path, left(nullif(btrim(p_note), ''), 2000),
    case when p_kind = 'training' then p_training_from end, case when p_kind = 'training' then p_training_to end)
  returning ref_no into v_ref;
  perform public.notify_role(array['admin', 'hr'], 'application_new',
    jsonb_build_object('ref_no', v_ref, 'kind', p_kind, 'name', left(btrim(p_name), 60), 'link', '/hr'));
  return v_ref;
end $$;

alter table public.job_openings     enable row level security;
alter table public.job_applications enable row level security;
revoke all on public.job_applications from anon;
revoke insert, delete, update on public.job_applications from authenticated;
grant update (status, internal_notes) on public.job_applications to authenticated;
create policy applications_read   on public.job_applications for select to authenticated using (public.is_hr());
create policy applications_update on public.job_applications for update to authenticated using (public.is_hr()) with check (public.is_hr());

revoke all on public.job_openings from anon;
grant select on public.job_openings to anon;
create policy openings_public on public.job_openings for select to anon using (is_open);
create policy openings_staff  on public.job_openings for select to authenticated using (is_open or public.is_hr());
create policy openings_write  on public.job_openings for all to authenticated using (public.is_hr()) with check (public.is_hr());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cvs', 'cvs', false, 5242880,
        array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;
create policy "cvs upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'cvs' and name ~ '^applications/[0-9a-f-]{36}\.(pdf|doc|docx)$');
create policy "cvs read" on storage.objects for select to authenticated using (bucket_id = 'cvs' and public.is_hr());

insert into public.job_openings (title, department, location, employment, description, requirements) values
  ('ممرض / ممرضة', 'التمريض', 'جدة', 'full_time',
   'تقديم الرعاية التمريضية في العيادات الخارجية، أخذ العلامات الحيوية وتجهيز المرضى للكشف.',
   'بكالوريوس أو دبلوم تمريض · تصنيف ساري من الهيئة السعودية للتخصصات الصحية · خبرة سنتين'),
  ('موظف / موظفة استقبال', 'الاستقبال', 'جدة', 'full_time',
   'استقبال المرضى وحجز المواعيد والتحقق من التأمين وتحصيل الرسوم.',
   'دبلوم فأعلى · إجادة الحاسب · مهارات تواصل ممتازة · يفضّل خبرة في المجال الطبي');

revoke execute on function public.handle_booking_request(uuid, text, uuid, text) from public, anon;
grant execute on function public.handle_booking_request(uuid, text, uuid, text) to authenticated;
grant execute on function public.submit_booking_request(text, text, uuid, uuid, date, text, text, text, text) to anon, authenticated;
grant execute on function public.submit_application(text, text, text, text, uuid, text, text, text, text, int, text, text, text, date, date) to anon, authenticated;
