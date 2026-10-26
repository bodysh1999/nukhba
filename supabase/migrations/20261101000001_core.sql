-- =====================================================================
--  نظام مجمع نُخبة الطبي — الأساس: الأدوار والحسابات والإعدادات والإشعارات
--  Single medical center (not multi-tenant). Run the files in order.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------
create type public.app_role as enum ('admin', 'reception', 'doctor', 'accountant', 'hr', 'employee', 'patient');

create table public.roles (
  code        public.app_role primary key,
  name_ar     text not null,
  name_en     text not null,
  description text
);

insert into public.roles (code, name_ar, name_en, description) values
  ('admin',      'إدارة المجمع',     'Center Admin',   'إدارة كاملة للنظام والإعدادات والتقارير'),
  ('reception',  'الاستقبال',        'Reception',      'الحجوزات وتسجيل الحضور وملفات المرضى والتحصيل'),
  ('doctor',     'طبيب',             'Doctor',         'الكشف والسجل الطبي والوصفات والتحاليل والتقارير الطبية'),
  ('accountant', 'المحاسبة والتأمين', 'Billing & Claims', 'الفواتير والمدفوعات ومطالبات التأمين وقائمة الأسعار'),
  ('hr',         'الموارد البشرية',   'HR Officer',     'الموظفون والحضور والإجازات والرواتب والتوظيف'),
  ('employee',   'موظف',             'Employee',       'الخدمات الذاتية: الحضور والإجازات والطلبات'),
  ('patient',    'مريض',             'Patient',        'حجز المواعيد ومتابعة السجل الطبي والفواتير');

create table public.profiles (
  id                       uuid primary key references auth.users (id) on delete cascade,
  role                     public.app_role not null default 'patient' references public.roles (code),
  full_name                text not null default '',
  email                    text,
  phone                    text,
  locale                   text not null default 'ar' check (locale in ('ar', 'en')),
  is_active                boolean not null default true,
  notify_external          boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Center settings (singleton)
-- ---------------------------------------------------------------------
create table public.company_settings (
  id                    int primary key default 1 check (id = 1),
  name_ar               text not null default 'مجمع نُخبة الطبي',
  name_en               text not null default 'Nukhba Medical Complex',
  tagline_ar            text not null default 'رعاية طبية متكاملة بمعايير عالمية',
  tagline_en            text not null default 'Complete medical care to international standards',
  logo_url              text,
  primary_color         text not null default '#0E4D5A' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color          text not null default '#B8873F' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  support_phone         text default '920000000',
  support_email         text default 'care@nukhba-clinic.demo',
  whatsapp              text default '966500000000',
  website_url           text,
  instagram_url         text,
  snapchat_url          text,
  tiktok_url            text,
  x_url                 text,
  address_ar            text default 'جدة — حي الروضة، طريق الأمير سلطان',
  address_en            text default 'Jeddah — Al Rawdah, Prince Sultan Rd',
  map_query             text default '21.5637,39.1500',
  working_hours_ar      text default 'السبت – الخميس: 9 صباحًا – 11 مساءً',
  working_hours_en      text default 'Sat – Thu: 9 AM – 11 PM',
  cr_number             text default '4030000000',
  moh_license           text default '1400000000',
  vat_number            text default '300000000000003',
  vat_rate              numeric(5,2) not null default 15 check (vat_rate between 0 and 100),
  -- booking rules
  cancel_window_hours   int  not null default 3  check (cancel_window_hours between 0 and 72),
  booking_days_ahead    int  not null default 30 check (booking_days_ahead between 1 and 180),
  late_checkin_minutes  int  not null default 20 check (late_checkin_minutes between 0 and 240),
  -- notifications
  notify_channels       text[] not null default '{}',
  notify_roles          text[] not null default '{patient}',
  updated_at            timestamptz not null default now()
);
insert into public.company_settings (id) values (1);

-- ---------------------------------------------------------------------
-- Notifications & audit
-- ---------------------------------------------------------------------
create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  type            text not null,
  appointment_id  uuid,                       -- FK added once appointments exist
  payload         jsonb not null default '{}',
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

create table public.notification_outbox (
  id               uuid primary key default gen_random_uuid(),
  notification_id  uuid not null references public.notifications (id) on delete cascade,
  channel          text not null check (channel in ('whatsapp', 'sms', 'email')),
  status           text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts         int not null default 0,
  last_error       text,
  claimed_at       timestamptz,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);
create index notification_outbox_pending_idx on public.notification_outbox (created_at) where status in ('pending', 'sending');

create table public.activity_logs (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid,
  entity          text not null default 'appointment',
  entity_id       uuid,
  actor_id        uuid references public.profiles (id) on delete set null,
  actor_name      text,
  actor_role      public.app_role,
  action          text not null,
  from_status     text,
  to_status       text,
  note            text,
  meta            jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index on public.activity_logs (appointment_id, created_at);
create index on public.activity_logs (entity, entity_id, created_at);

-- ---------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policies can call them without recursion)
-- ---------------------------------------------------------------------
create or replace function public.auth_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() = 'admin', false)
$$;

-- front desk: bookings, check-in, patient files
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() in ('admin', 'reception'), false)
$$;

-- invoices & payments
create or replace function public.is_billing()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() in ('admin', 'reception', 'accountant'), false)
$$;

-- insurance claims, price list, financial reports
create or replace function public.is_finance()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() in ('admin', 'accountant'), false)
$$;

create or replace function public.is_hr()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role()::text in ('admin', 'hr'), false)
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

create trigger trg_profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger trg_settings_touch before update on public.company_settings for each row execute function public.touch_updated_at();

create or replace function public.normalize_phone(p text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(coalesce(p, ''), '[^0-9+]', '', 'g')
$$;

-- New auth user → profile. Role comes ONLY from app_metadata (set by the server), never from sign-up data.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, full_name, email, phone)
  values (
    new.id,
    coalesce((new.raw_app_meta_data ->> 'role')::public.app_role, 'patient'),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- who did it, as they were at the time
create or replace function public.stamp_actor()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text; v_role public.app_role;
begin
  select full_name, role into v_name, v_role from public.profiles where id = auth.uid();
  new.actor_id   := coalesce(new.actor_id, auth.uid());
  new.actor_name := coalesce(new.actor_name, v_name);
  new.actor_role := coalesce(new.actor_role, v_role);
  return new;
end $$;
create trigger trg_logs_actor before insert on public.activity_logs for each row execute function public.stamp_actor();

-- ---------------------------------------------------------------------
-- Notifications (internal — never callable by clients)
-- ---------------------------------------------------------------------
create or replace function public.notify_user(p_user uuid, p_type text, p_appointment uuid, p_payload jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_channel text; v_role text; v_ext boolean;
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, type, appointment_id, payload)
  values (p_user, p_type, p_appointment, coalesce(p_payload, '{}'))
  returning id into v_id;

  -- WhatsApp / SMS / email: only roles chosen in settings (default: patients) who did not opt out
  select role::text, notify_external into v_role, v_ext from public.profiles where id = p_user;
  if coalesce(v_ext, false) and v_role = any (coalesce((select notify_roles from public.company_settings where id = 1), '{}')) then
    for v_channel in select unnest(notify_channels) from public.company_settings where id = 1 loop
      insert into public.notification_outbox (notification_id, channel) values (v_id, v_channel);
    end loop;
  end if;
end $$;

create or replace function public.notify_role(p_roles text[], p_type text, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  for v_user in select id from public.profiles where role::text = any(p_roles) and is_active and id is distinct from auth.uid() loop
    perform public.notify_user(v_user, p_type, null, p_payload);
  end loop;
end $$;

create or replace function public.finish_outbox(p_id uuid, p_status text, p_error text default null)
returns void language sql security definer set search_path = public as $$
  update public.notification_outbox set
    status = case when p_status = 'failed' and attempts < 5 then 'pending' else p_status end,
    last_error = left(p_error, 500),
    sent_at = case when p_status = 'sent' then now() else sent_at end
  where id = p_id
$$;

revoke execute on function public.notify_user(uuid, text, uuid, jsonb), public.notify_role(text[], text, jsonb),
  public.finish_outbox(uuid, text, text), public.handle_new_auth_user(), public.stamp_actor(), public.touch_updated_at()
  from public, anon, authenticated;
grant execute on function public.finish_outbox(uuid, text, text) to service_role;
