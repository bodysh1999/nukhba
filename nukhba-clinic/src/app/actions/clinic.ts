'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { act, must, str, strOrNull, UserError } from '@/lib/actions';
import { createLoginAccount } from '@/lib/accounts';
import { getI18n } from '@/lib/session';
import { translateError } from '@/lib/i18n';
import type { ActionResult } from '@/lib/types';

const refresh = () => revalidatePath('/', 'layout');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ------------------------------------------------------------------ booking (called from the booking wizard)
export async function bookAppointment(input: {
  doctor: string; starts_at: string; patient?: string | null; reason?: string | null; visit_type?: 'new' | 'follow_up'; source?: string | null;
}): Promise<{ ok?: boolean; id?: string; ref?: string; error?: string }> {
  const { d } = await getI18n();
  if (!UUID.test(input.doctor) || !input.starts_at) return { error: d.errors.REQUIRED };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('book_appointment', {
    p_doctor: input.doctor, p_starts_at: input.starts_at, p_patient: input.patient || null,
    p_reason: input.reason || null, p_visit_type: input.visit_type ?? 'new', p_source: input.source || null,
  });
  if (error) return { error: translateError(d, error.message) };
  const { data: a } = await supabase.from('appointments').select('ref_no').eq('id', data as string).maybeSingle();
  refresh();
  return { ok: true, id: data as string, ref: a?.ref_no };
}

export async function rescheduleAppointment(input: { id: string; starts_at: string; doctor?: string | null }): Promise<{ ok?: boolean; error?: string }> {
  const { d } = await getI18n();
  const supabase = await createClient();
  const { error } = await supabase.rpc('reschedule_appointment', { p_id: input.id, p_new_start: input.starts_at, p_doctor: input.doctor || null });
  if (error) return { error: translateError(d, error.message) };
  refresh();
  return { ok: true };
}

export async function cancelAppointment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await createClient();
    must(await supabase.rpc('cancel_appointment', { p_id: str(fd, 'id'), p_reason: strOrNull(fd, 'reason') }));
    refresh();
    return { ok: true, message: d.cl.appt.cancelled };
  });
}

export async function confirmAppointment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('confirm_appointment', { p_id: str(fd, 'id') }));
    refresh();
  });
}

export async function checkIn(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await createClient();
    const q = must(await supabase.rpc('check_in', { p_id: str(fd, 'id') }));
    refresh();
    return { ok: true, message: d.cl.desk.checkedIn.replace('{q}', String(q)) };
  });
}

export async function markNoShow(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('mark_no_show', { p_id: str(fd, 'id') }));
    refresh();
  });
}

export async function rateAppointment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const score = Number(str(fd, 'score'));
    if (!(score >= 1 && score <= 5)) throw new UserError(d.errors.REQUIRED);
    const supabase = await createClient();
    must(await supabase.rpc('rate_appointment', { p_id: str(fd, 'id'), p_score: score, p_comment: strOrNull(fd, 'comment') }));
    refresh();
    return { ok: true, message: d.cl.appt.thanks };
  });
}

// ------------------------------------------------------------------ patient files (front desk)
function patientFields(fd: FormData, d: Awaited<ReturnType<typeof getI18n>>['d']) {
  const nid = str(fd, 'national_id').replace(/\D/g, '');
  if (nid && !/^[12]\d{9}$/.test(nid)) throw new UserError(d.errors.INVALID_NATIONAL_ID);
  const phone = str(fd, 'phone').replace(/[^0-9+]/g, '');
  if (!/^(\+?966|0)?5\d{8}$/.test(phone)) throw new UserError(d.errors.INVALID_PHONE);
  const email = str(fd, 'email').toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new UserError(d.errors.INVALID_EMAIL);
  if (str(fd, 'full_name').length < 2) throw new UserError(d.errors.NAME_REQUIRED);
  return {
    full_name: str(fd, 'full_name'), full_name_en: strOrNull(fd, 'full_name_en'), national_id: nid || null,
    is_saudi: str(fd, 'is_saudi') !== 'false', nationality: strOrNull(fd, 'nationality'),
    gender: str(fd, 'gender') === 'female' ? 'female' : 'male', birth_date: strOrNull(fd, 'birth_date'),
    phone, email: email || null, city: strOrNull(fd, 'city'), blood_type: strOrNull(fd, 'blood_type'),
    allergies: strOrNull(fd, 'allergies'), chronic_conditions: strOrNull(fd, 'chronic_conditions'),
    insurance_company_id: strOrNull(fd, 'insurance_company_id'), insurance_member_no: strOrNull(fd, 'insurance_member_no'),
    insurance_class: strOrNull(fd, 'insurance_class'), insurance_expiry: strOrNull(fd, 'insurance_expiry'),
    emergency_name: strOrNull(fd, 'emergency_name'), emergency_phone: strOrNull(fd, 'emergency_phone'), notes: strOrNull(fd, 'notes'),
  };
}

export async function createPatient(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let id: string | null = null;
  const res = await act(async (d) => {
    const supabase = await createClient();
    const row = patientFields(fd, d);
    const { data, error } = await supabase.from('patients').insert(row).select('id').single();
    if (error) throw new UserError(error.message.includes('national_id') ? d.errors.NATIONAL_ID_EXISTS : translateError(d, error.message));
    id = data.id;
    refresh();
  });
  if (id && !res?.error) redirect(str(fd, 'then') === 'book' ? `/reception/book?patient=${id}` : `/reception/patients/${id}`);
  return res;
}

export async function updatePatient(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await createClient();
    const { error } = await supabase.from('patients').update(patientFields(fd, d)).eq('id', str(fd, 'id'));
    if (error) throw new UserError(error.message.includes('national_id') ? d.errors.NATIONAL_ID_EXISTS : translateError(d, error.message));
    refresh();
  });
}

/** Front desk opens a portal login for a patient file (service key, after checking the caller is front desk) */
export async function createPatientPortal(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await createClient();
    const { data: ok } = await supabase.rpc('is_staff');
    if (!ok) throw new UserError(d.errors.FORBIDDEN);
    const { data: p } = await supabase.from('patients').select('id, full_name, phone, email, profile_id').eq('id', str(fd, 'id')).single();
    if (!p) throw new UserError(d.errors.NOT_FOUND);
    if (!p.email) throw new UserError(d.errors.INVALID_EMAIL);
    const admin = createAdminClient();
    if (p.profile_id) {
      must(await admin.from('patients').update({ account_status: 'active' }).eq('id', p.id));
      must(await admin.from('profiles').update({ is_active: true }).eq('id', p.profile_id));
      await admin.auth.admin.updateUserById(p.profile_id, { ban_duration: 'none' });
      refresh();
      return { ok: true };
    }
    const { userId, password } = await createLoginAccount(p.email, p.full_name, p.phone, 'patient');
    must(await admin.from('patients').update({ profile_id: userId, account_status: 'active' }).eq('id', p.id));
    refresh();
    return { ok: true, data: { email: p.email, password } };
  });
}

export async function disablePatientPortal(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await createClient();
    const { data: ok } = await supabase.rpc('is_staff');
    if (!ok) throw new UserError(d.errors.FORBIDDEN);
    const { data: p } = await supabase.from('patients').select('id, profile_id').eq('id', str(fd, 'id')).single();
    if (!p?.profile_id) throw new UserError(d.errors.NOT_FOUND);
    const admin = createAdminClient();
    must(await admin.from('patients').update({ account_status: 'disabled' }).eq('id', p.id));
    must(await admin.from('profiles').update({ is_active: false }).eq('id', p.profile_id));
    await admin.auth.admin.updateUserById(p.profile_id, { ban_duration: '876000h' });
    refresh();
  });
}

// ------------------------------------------------------------------ website booking requests
export async function handleBookingRequest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('handle_booking_request', {
      p_id: str(fd, 'id'), p_status: str(fd, 'status'), p_appointment: strOrNull(fd, 'appointment_id'), p_note: strOrNull(fd, 'note'),
    }));
    refresh();
  });
}

// ------------------------------------------------------------------ doctor time off (front desk / admin)
export async function addTimeOff(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    if (!str(fd, 'from_date') || !str(fd, 'to_date') || str(fd, 'to_date') < str(fd, 'from_date')) throw new UserError(d.errors.INVALID_DATES);
    const supabase = await createClient();
    must(await supabase.from('doctor_time_off').insert({
      doctor_id: str(fd, 'doctor_id'), from_date: str(fd, 'from_date'), to_date: str(fd, 'to_date'), reason: strOrNull(fd, 'reason'),
    }));
    refresh();
    return { ok: true };
  });
}

export async function removeTimeOff(id: string) {
  const supabase = await createClient();
  await supabase.from('doctor_time_off').delete().eq('id', id);
  refresh();
}

// ------------------------------------------------------------------ patient self-service
export async function updateMyContact(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('update_my_contact', {
      p_phone: str(fd, 'phone'), p_email: str(fd, 'email'), p_city: str(fd, 'city'),
      p_emergency_name: str(fd, 'emergency_name'), p_emergency_phone: str(fd, 'emergency_phone'),
    }));
    refresh();
  });
}

/**
 * Public sign-up for patients. A new file is opened only when the national ID is new —
 * an existing file is never handed to whoever types its ID number (reception links it instead).
 */
export async function registerPatient(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    if (fd.get('consent') !== 'on') throw new UserError(d.privacy.consentRequired);
    const email = str(fd, 'email').toLowerCase();
    const password = str(fd, 'password');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new UserError(d.errors.INVALID_EMAIL);
    if (password.length < 8) throw new UserError(d.auth.tooShort);
    const row = patientFields(fd, d);
    if (!row.national_id) throw new UserError(d.errors.INVALID_NATIONAL_ID);
    if (!row.birth_date) throw new UserError(d.errors.REQUIRED);
    const admin = createAdminClient();
    const { data: existing } = await admin.from('patients').select('id').eq('national_id', row.national_id).maybeSingle();
    if (existing) throw new UserError(d.cl.site.idExists);
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      app_metadata: { role: 'patient' },
      user_metadata: { full_name: row.full_name, phone: row.phone },
    });
    if (error || !data.user) throw new UserError(/already|registered|exists/i.test(error?.message ?? '') ? d.errors.EMAIL_EXISTS : d.common.errorGeneric);
    const ins = await admin.from('patients').insert({
      full_name: row.full_name, national_id: row.national_id, is_saudi: row.is_saudi, gender: row.gender, birth_date: row.birth_date,
      phone: row.phone, email, profile_id: data.user.id, account_status: 'active', created_by: null,
    });
    if (ins.error) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw new UserError(ins.error.message.includes('national_id') ? d.cl.site.idExists : d.common.errorGeneric);
    }
    // sign the new patient in straight away
    const supabase = await createClient();
    await supabase.auth.signInWithPassword({ email, password });
    redirect(str(fd, 'next')?.startsWith('/') ? str(fd, 'next') : '/patient/book');
  });
}

// ------------------------------------------------------------------ visitors
export async function submitBookingRequest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    if (fd.get('consent') !== 'on') throw new UserError(d.privacy.consentRequired);
    if (str(fd, 'website')) return { ok: true, message: d.cl.site.requestSent.replace('{ref}', '—') }; // honeypot
    const supabase = await createClient();
    const ref = must(await supabase.rpc('submit_booking_request', {
      p_name: str(fd, 'full_name'), p_phone: str(fd, 'phone'), p_clinic: strOrNull(fd, 'clinic_id'), p_doctor: strOrNull(fd, 'doctor_id'),
      p_date: strOrNull(fd, 'preferred_date'), p_time: strOrNull(fd, 'preferred_time'), p_email: strOrNull(fd, 'email'),
      p_insurance: strOrNull(fd, 'insurance'), p_message: strOrNull(fd, 'message'),
    })) as string;
    await supabase.rpc('log_form_consent', { p_ref: ref, p_purposes: ['privacy_policy', 'service_request'] });
    return { ok: true, message: d.cl.site.requestSent.replace('{ref}', ref) };
  });
}

/** After booking from a website request, link the two (front desk) */
export async function linkBookingRequest(requestId: string, appointmentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('handle_booking_request', { p_id: requestId, p_status: 'booked', p_appointment: appointmentId, p_note: null });
  refresh();
  return error ? { error: error.message } : { ok: true };
}
