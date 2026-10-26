-- =====================================================================
--  الفوترة والتحصيل والتأمين
--  • فاتورة لكل موعد تُنشأ تلقائيًا عند تسجيل الحضور (رسوم الكشف/المراجعة)
--  • التحاليل والأشعة التي يطلبها الطبيب تُضاف تلقائيًا لفاتورة الموعد
--  • توزيع المبلغ بين شركة التأمين والمريض (نسبة التغطية + حد أقصى للتحمل)
--  • ضريبة القيمة المضافة على غير السعوديين فقط (الخدمات الصحية الخاصة للمواطن معفاة/صفرية)
-- =====================================================================

create sequence public.invoice_seq start 10001;
create sequence public.receipt_seq start 10001;

create table public.invoices (
  id                     uuid primary key default gen_random_uuid(),
  inv_no                 text not null unique default ('INV-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.invoice_seq')::text, 5, '0')),
  patient_id             uuid not null references public.patients (id) on delete restrict,
  appointment_id         uuid unique references public.appointments (id) on delete set null,
  status                 text not null default 'draft' check (status in ('draft', 'issued', 'partially_paid', 'paid', 'cancelled')),
  payer                  text not null default 'self' check (payer in ('self', 'insurance')),
  insurance_company_id   uuid references public.insurance_companies (id) on delete set null,
  coverage_percent       numeric(5,2) not null default 0 check (coverage_percent between 0 and 100),
  max_copay              numeric(10,2),
  approval_no            text,
  subtotal               numeric(12,2) not null default 0,
  discount               numeric(12,2) not null default 0 check (discount >= 0),
  net_amount             numeric(12,2) not null default 0,
  vat_rate               numeric(5,2) not null default 0,
  vat_amount             numeric(12,2) not null default 0,
  total                  numeric(12,2) not null default 0,
  insurance_amount       numeric(12,2) not null default 0,
  patient_amount         numeric(12,2) not null default 0,
  paid_amount            numeric(12,2) not null default 0,
  claim_status           text not null default 'none'
                         check (claim_status in ('none', 'pending', 'submitted', 'approved', 'partially_approved', 'rejected', 'paid')),
  claim_submitted_at     timestamptz,
  claim_approved_amount  numeric(12,2),
  claim_paid_at          timestamptz,
  claim_note             text,
  notes                  text,
  issued_at              timestamptz,
  cancelled_at           timestamptz,
  cancel_reason          text,
  created_by             uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index on public.invoices (patient_id, created_at desc);
create index on public.invoices (status);
create index on public.invoices (claim_status) where payer = 'insurance';
create trigger trg_invoices_touch before update on public.invoices for each row execute function public.touch_updated_at();

create table public.invoice_items (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references public.invoices (id) on delete cascade,
  service_id    uuid references public.services (id) on delete set null,
  lab_order_id  uuid unique references public.lab_orders (id) on delete set null,
  description   text not null,
  qty           numeric(8,2) not null default 1 check (qty > 0),
  unit_price    numeric(12,2) not null check (unit_price >= 0),
  line_total    numeric(12,2) generated always as (round(qty * unit_price, 2)) stored,
  created_at    timestamptz not null default now()
);
create index on public.invoice_items (invoice_id);

create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  receipt_no   text not null unique default ('RC-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.receipt_seq')::text, 5, '0')),
  invoice_id   uuid not null references public.invoices (id) on delete restrict,
  amount       numeric(12,2) not null check (amount > 0),
  method       text not null check (method in ('cash', 'mada', 'card', 'apple_pay', 'transfer')),
  reference    text,
  received_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  received_at  timestamptz not null default now(),
  voided_at    timestamptz,
  void_reason  text
);
create index on public.payments (invoice_id);
create index on public.payments (received_at);

-- ---------------------------------------------------------------------
-- Totals
-- ---------------------------------------------------------------------
create or replace function public._recalc_invoice(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare i public.invoices; v_sub numeric; v_net numeric; v_ins numeric; v_pat numeric; v_vat numeric; v_pvat numeric; v_paid numeric; v_status text;
begin
  select * into i from public.invoices where id = p_id for update;
  if i.id is null then return; end if;
  select coalesce(sum(line_total), 0) into v_sub from public.invoice_items where invoice_id = p_id;
  select coalesce(sum(amount), 0) into v_paid from public.payments where invoice_id = p_id and voided_at is null;
  v_net := v_sub - least(i.discount, v_sub);
  if i.payer = 'insurance' then
    v_ins := round(v_net * i.coverage_percent / 100, 2);
    v_pat := v_net - v_ins;
    if i.max_copay is not null and v_pat > i.max_copay then v_pat := i.max_copay; v_ins := v_net - v_pat; end if;
  else
    v_ins := 0; v_pat := v_net;
  end if;
  v_vat  := round(v_net * i.vat_rate / 100, 2);
  v_pvat := round(v_pat * i.vat_rate / 100, 2);
  v_status := case
    when i.status in ('draft', 'cancelled') then i.status
    when v_paid >= v_pat + v_pvat then 'paid'
    when v_paid > 0 then 'partially_paid'
    else 'issued' end;
  update public.invoices set subtotal = v_sub, discount = least(i.discount, v_sub), net_amount = v_net, vat_amount = v_vat,
    total = v_net + v_vat, insurance_amount = v_ins + (v_vat - v_pvat), patient_amount = v_pat + v_pvat, paid_amount = v_paid,
    status = v_status,
    claim_status = case when i.payer = 'insurance' and i.claim_status = 'none' and v_status not in ('draft', 'cancelled') then 'pending'
                        when i.payer = 'self' then 'none' else i.claim_status end
  where id = p_id;
end $$;

create or replace function public._items_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._recalc_invoice(coalesce(new.invoice_id, old.invoice_id));
  return null;
end $$;
create trigger trg_items_recalc after insert or update or delete on public.invoice_items
  for each row execute function public._items_changed();

-- payer, coverage and VAT come from the patient's file at the time the invoice opens
create or replace function public._new_invoice(p_patient uuid, p_appointment uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare p record; v_id uuid; v_ins boolean;
begin
  select pt.*, ic.coverage_percent as cov, ic.max_copay as cap, ic.is_active as ins_active
    into p from public.patients pt left join public.insurance_companies ic on ic.id = pt.insurance_company_id
  where pt.id = p_patient;
  v_ins := p.insurance_company_id is not null and coalesce(p.ins_active, false)
           and (p.insurance_expiry is null or p.insurance_expiry >= public.riyadh_date());
  insert into public.invoices (patient_id, appointment_id, payer, insurance_company_id, coverage_percent, max_copay, vat_rate)
  values (p_patient, p_appointment,
          case when v_ins then 'insurance' else 'self' end,
          case when v_ins then p.insurance_company_id end,
          case when v_ins then p.cov else 0 end,
          case when v_ins then p.cap end,
          case when p.is_saudi then 0 else (select vat_rate from public.company_settings where id = 1) end)
  returning id into v_id;
  return v_id;
end $$;

-- arrival → invoice with the consultation / follow-up fee
create or replace function public._appointment_billing()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_inv uuid; d record;
begin
  if new.status = 'checked_in' and old.status is distinct from 'checked_in' then
    if not exists (select 1 from public.invoices where appointment_id = new.id) then
      v_inv := public._new_invoice(new.patient_id, new.id);
      select * into d from public.doctors where id = new.doctor_id;
      insert into public.invoice_items (invoice_id, description, unit_price)
      values (v_inv,
              case when new.visit_type = 'follow_up' then 'مراجعة — ' else 'كشف — ' end || d.full_name_ar,
              case when new.visit_type = 'follow_up' then d.follow_up_fee else d.consultation_fee end);
    end if;
  elsif new.status in ('cancelled', 'no_show') and old.status is distinct from new.status then
    update public.invoices set status = 'cancelled', cancelled_at = now(), cancel_reason = 'إلغاء الموعد'
    where appointment_id = new.id and paid_amount = 0 and status in ('draft', 'issued');
  end if;
  return new;
end $$;
create trigger trg_appointment_billing after update of status on public.appointments
  for each row execute function public._appointment_billing();

-- tests ordered by the doctor → billed on the same visit
create or replace function public._test_billing()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_appt uuid; v_inv uuid; v_price numeric; v_paid numeric;
begin
  if tg_op = 'INSERT' then
    select appointment_id into v_appt from public.visits where id = new.visit_id;
    select id into v_inv from public.invoices where appointment_id = v_appt and status <> 'cancelled';
    if v_inv is null then
      if exists (select 1 from public.invoices where appointment_id = v_appt) then return new; end if;  -- cancelled visit invoice
      v_inv := public._new_invoice(new.patient_id, v_appt);
    end if;
    select price into v_price from public.services where id = new.service_id;
    if new.service_id is not null then
      insert into public.invoice_items (invoice_id, service_id, lab_order_id, description, unit_price)
      values (v_inv, new.service_id, new.id, new.test_name, coalesce(v_price, 0));
    end if;
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    select i.paid_amount into v_paid from public.invoice_items it join public.invoices i on i.id = it.invoice_id where it.lab_order_id = new.id;
    if coalesce(v_paid, 0) = 0 then delete from public.invoice_items where lab_order_id = new.id; end if;
  end if;
  return new;
end $$;
create trigger trg_test_billing after insert or update of status on public.lab_orders
  for each row execute function public._test_billing();

-- ---------------------------------------------------------------------
-- Billing actions
-- ---------------------------------------------------------------------
create or replace function public.create_invoice(p_patient uuid)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not public.is_billing() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.patients where id = p_patient) then raise exception 'PATIENT_REQUIRED' using errcode = 'P0001'; end if;
  return public._new_invoice(p_patient, null);
end $$;

create or replace function public._editable_invoice(p_id uuid)
returns public.invoices language plpgsql security definer set search_path = public as $$
declare i public.invoices;
begin
  if not public.is_billing() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into i from public.invoices where id = p_id;
  if i.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if i.status = 'cancelled' then raise exception 'INVOICE_CLOSED' using errcode = 'P0001'; end if;
  return i;
end $$;

create or replace function public.add_invoice_item(p_invoice uuid, p_service uuid default null, p_description text default null,
  p_qty numeric default 1, p_price numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare i public.invoices; s public.services;
begin
  i := public._editable_invoice(p_invoice);
  if p_service is not null then
    select * into s from public.services where id = p_service and is_active;
    if s.id is null then raise exception 'INVALID_INPUT' using errcode = 'P0001'; end if;
  elsif coalesce(btrim(p_description), '') = '' or p_price is null then
    raise exception 'REQUIRED' using errcode = 'P0001';
  end if;
  -- only finance may set a price different from the price list
  if p_price is not null and s.id is not null and p_price <> s.price and not public.is_finance() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if s.id is null and not public.is_finance() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  insert into public.invoice_items (invoice_id, service_id, description, qty, unit_price)
  values (p_invoice, s.id, coalesce(nullif(btrim(p_description), ''), s.name_ar), greatest(coalesce(p_qty, 1), 0.01),
          coalesce(p_price, s.price));
end $$;

create or replace function public.remove_invoice_item(p_item uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_inv uuid; i public.invoices;
begin
  select invoice_id into v_inv from public.invoice_items where id = p_item;
  if v_inv is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  i := public._editable_invoice(v_inv);
  if i.paid_amount > 0 then raise exception 'INVOICE_HAS_PAYMENTS' using errcode = 'P0001'; end if;
  delete from public.invoice_items where id = p_item;
end $$;

create or replace function public.set_invoice_terms(p_invoice uuid, p_payer text, p_discount numeric, p_approval_no text default null, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare i public.invoices; p record;
begin
  i := public._editable_invoice(p_invoice);
  if p_payer not in ('self', 'insurance') then raise exception 'INVALID_INPUT' using errcode = 'P0001'; end if;
  if coalesce(p_discount, 0) < 0 then raise exception 'INVALID_INPUT' using errcode = 'P0001'; end if;
  -- discounts need finance; reception may only keep the current discount
  if coalesce(p_discount, 0) <> i.discount and not public.is_finance() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if i.paid_amount > 0 and (p_payer <> i.payer or coalesce(p_discount, 0) <> i.discount) then raise exception 'INVOICE_HAS_PAYMENTS' using errcode = 'P0001'; end if;
  if p_payer = 'insurance' then
    select pt.insurance_company_id, ic.coverage_percent, ic.max_copay, ic.is_active, pt.insurance_expiry, ic.requires_approval into p
    from public.patients pt join public.insurance_companies ic on ic.id = pt.insurance_company_id where pt.id = i.patient_id;
    if p.insurance_company_id is null or not p.is_active then raise exception 'NO_INSURANCE' using errcode = 'P0001'; end if;
    if p.insurance_expiry is not null and p.insurance_expiry < public.riyadh_date() then raise exception 'INSURANCE_EXPIRED' using errcode = 'P0001'; end if;
    update public.invoices set payer = 'insurance', insurance_company_id = p.insurance_company_id,
      coverage_percent = p.coverage_percent, max_copay = p.max_copay where id = p_invoice;
  else
    update public.invoices set payer = 'self', insurance_company_id = null, coverage_percent = 0, max_copay = null, claim_status = 'none'
    where id = p_invoice;
  end if;
  update public.invoices set discount = coalesce(p_discount, 0), approval_no = left(nullif(btrim(p_approval_no), ''), 60),
    notes = left(nullif(btrim(p_notes), ''), 1000) where id = p_invoice;
  perform public._recalc_invoice(p_invoice);
end $$;

create or replace function public.issue_invoice(p_invoice uuid)
returns void language plpgsql security definer set search_path = public as $$
declare i public.invoices; v_pat uuid;
begin
  i := public._editable_invoice(p_invoice);
  if i.status <> 'draft' then return; end if;
  if not exists (select 1 from public.invoice_items where invoice_id = p_invoice) then raise exception 'INVOICE_EMPTY' using errcode = 'P0001'; end if;
  if i.payer = 'insurance' and coalesce(i.approval_no, '') = ''
     and (select requires_approval from public.insurance_companies where id = i.insurance_company_id) then
    raise exception 'APPROVAL_REQUIRED' using errcode = 'P0001';
  end if;
  update public.invoices set status = 'issued', issued_at = now() where id = p_invoice;
  perform public._recalc_invoice(p_invoice);
  select profile_id into v_pat from public.patients where id = i.patient_id and account_status = 'active';
  perform public.notify_user(v_pat, 'invoice_issued', i.appointment_id,
    jsonb_build_object('ref_no', i.inv_no, 'link', '/patient/invoices/' || p_invoice));
end $$;

create or replace function public.record_payment(p_invoice uuid, p_amount numeric, p_method text, p_reference text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare i public.invoices; v_id uuid;
begin
  i := public._editable_invoice(p_invoice);
  if i.status = 'draft' then perform public.issue_invoice(p_invoice); select * into i from public.invoices where id = p_invoice; end if;
  if p_method not in ('cash', 'mada', 'card', 'apple_pay', 'transfer') then raise exception 'INVALID_INPUT' using errcode = 'P0001'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'INVALID_PAYMENT_AMOUNT' using errcode = 'P0001'; end if;
  if p_amount > i.patient_amount - i.paid_amount + 0.001 then raise exception 'AMOUNT_EXCEEDS_BALANCE' using errcode = 'P0001'; end if;
  insert into public.payments (invoice_id, amount, method, reference) values (p_invoice, round(p_amount, 2), p_method, left(nullif(btrim(p_reference), ''), 80))
  returning id into v_id;
  perform public._recalc_invoice(p_invoice);
  return v_id;
end $$;

create or replace function public.void_payment(p_payment uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_inv uuid;
begin
  if not public.is_finance() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'NOTE_REQUIRED' using errcode = 'P0001'; end if;
  update public.payments set voided_at = now(), void_reason = left(btrim(p_reason), 300)
  where id = p_payment and voided_at is null returning invoice_id into v_inv;
  if v_inv is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  perform public._recalc_invoice(v_inv);
end $$;

create or replace function public.cancel_invoice(p_invoice uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare i public.invoices;
begin
  if not public.is_finance() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into i from public.invoices where id = p_invoice for update;
  if i.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if i.paid_amount > 0 then raise exception 'INVOICE_HAS_PAYMENTS' using errcode = 'P0001'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'NOTE_REQUIRED' using errcode = 'P0001'; end if;
  update public.invoices set status = 'cancelled', cancelled_at = now(), cancel_reason = left(btrim(p_reason), 300), claim_status = 'none'
  where id = p_invoice;
end $$;

create or replace function public.update_claim(p_invoice uuid, p_status text, p_approved numeric default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare i public.invoices;
begin
  if not public.is_finance() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into i from public.invoices where id = p_invoice for update;
  if i.id is null or i.payer <> 'insurance' or i.status in ('draft', 'cancelled') then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  if p_status not in ('pending', 'submitted', 'approved', 'partially_approved', 'rejected', 'paid') then raise exception 'INVALID_INPUT' using errcode = 'P0001'; end if;
  if p_status in ('partially_approved') and (p_approved is null or p_approved < 0 or p_approved > i.insurance_amount) then
    raise exception 'INVALID_PAYMENT_AMOUNT' using errcode = 'P0001';
  end if;
  if p_status = 'rejected' and coalesce(btrim(p_note), '') = '' then raise exception 'NOTE_REQUIRED' using errcode = 'P0001'; end if;
  update public.invoices set claim_status = p_status,
    claim_submitted_at = case when p_status = 'submitted' then coalesce(claim_submitted_at, now()) else claim_submitted_at end,
    claim_approved_amount = case when p_status = 'approved' then insurance_amount
                                 when p_status = 'partially_approved' then round(p_approved, 2)
                                 when p_status = 'rejected' then 0 else claim_approved_amount end,
    claim_paid_at = case when p_status = 'paid' then now() else claim_paid_at end,
    claim_note = coalesce(nullif(btrim(p_note), ''), claim_note)
  where id = p_invoice;
  insert into public.activity_logs (entity, entity_id, appointment_id, action, from_status, to_status, note)
  values ('invoice', p_invoice, i.appointment_id, 'claim_' || p_status, i.claim_status, p_status, nullif(btrim(p_note), ''));
end $$;

-- ---------------------------------------------------------------------
-- One row per appointment for lists (RLS of the underlying tables applies)
-- ---------------------------------------------------------------------
create or replace view public.appointment_overview with (security_invoker = true) as
select a.*,
       pt.file_no, pt.full_name as patient_name, pt.phone as patient_phone, pt.gender as patient_gender, pt.birth_date as patient_birth_date,
       pt.national_id as patient_national_id, pt.insurance_company_id,
       ic.name_ar as insurance_name_ar, ic.name_en as insurance_name_en,
       d.full_name_ar as doctor_name_ar, d.full_name_en as doctor_name_en, d.title as doctor_title, d.photo_url as doctor_photo,
       c.name_ar as clinic_name_ar, c.name_en as clinic_name_en, c.icon as clinic_icon, c.location_ar as clinic_location_ar, c.location_en as clinic_location_en,
       v.id as visit_id, v.status as visit_status,
       inv.id as invoice_id, inv.inv_no, inv.status as invoice_status, inv.patient_amount, inv.paid_amount, inv.payer,
       rt.score as rating_score,
       case when a.status = 'checked_in' then extract(epoch from (now() - a.checked_in_at)) / 60 end as waiting_minutes
from public.appointments a
join public.patients pt on pt.id = a.patient_id
join public.doctors d on d.id = a.doctor_id
join public.clinics c on c.id = a.clinic_id
left join public.insurance_companies ic on ic.id = pt.insurance_company_id
left join public.visits v on v.appointment_id = a.id
left join public.invoices inv on inv.appointment_id = a.id and inv.status <> 'cancelled'
left join public.appointment_ratings rt on rt.appointment_id = a.id;

-- ---------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------
revoke execute on function public._recalc_invoice(uuid), public._items_changed(), public._new_invoice(uuid, uuid),
  public._appointment_billing(), public._test_billing(), public._editable_invoice(uuid)
  from public, anon, authenticated;
revoke execute on function
  public.create_invoice(uuid), public.add_invoice_item(uuid, uuid, text, numeric, numeric), public.remove_invoice_item(uuid),
  public.set_invoice_terms(uuid, text, numeric, text, text), public.issue_invoice(uuid),
  public.record_payment(uuid, numeric, text, text), public.void_payment(uuid, text), public.cancel_invoice(uuid, text),
  public.update_claim(uuid, text, numeric, text)
  from public, anon;
grant execute on function
  public.create_invoice(uuid), public.add_invoice_item(uuid, uuid, text, numeric, numeric), public.remove_invoice_item(uuid),
  public.set_invoice_terms(uuid, text, numeric, text, text), public.issue_invoice(uuid),
  public.record_payment(uuid, numeric, text, text), public.void_payment(uuid, text), public.cancel_invoice(uuid, text),
  public.update_claim(uuid, text, numeric, text)
  to authenticated;
