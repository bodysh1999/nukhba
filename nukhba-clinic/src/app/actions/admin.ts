'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { act, must, numOrNull, str, strOrNull, UserError } from '@/lib/actions';
import { createLoginAccount } from '@/lib/accounts';
import { send, providerFor, type Channel } from '@/lib/notify/providers';
import type { ActionResult, Role } from '@/lib/types';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('FORBIDDEN');
  const { data } = await supabase.from('profiles').select('role,is_active').eq('id', user.id).single();
  if (data?.role !== 'admin' || !data.is_active) throw new Error('FORBIDDEN');
  return supabase;
}

async function setAccountActive(profileId: string, active: boolean) {
  const admin = createAdminClient();
  must(await admin.from('profiles').update({ is_active: active }).eq('id', profileId));
  await admin.auth.admin.updateUserById(profileId, { ban_duration: active ? 'none' : '876000h' });
}

const refresh = () => revalidatePath('/', 'layout');
const safeUrl = (v: string | null) => (v && /^https:\/\//i.test(v) ? v : null);

// ------------------------------------------------------------------ clinics
export async function saveClinic(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireAdmin();
    const code = str(fd, 'code').toLowerCase();
    if (!str(fd, 'name_ar') || !str(fd, 'name_en') || !/^[a-z0-9_-]{2,30}$/.test(code)) throw new UserError(d.errors.REQUIRED);
    const row = {
      code, name_ar: str(fd, 'name_ar'), name_en: str(fd, 'name_en'), description_ar: strOrNull(fd, 'description_ar'),
      description_en: strOrNull(fd, 'description_en'), icon: str(fd, 'icon') || 'stethoscope', image_url: safeUrl(strOrNull(fd, 'image_url')),
      location_ar: strOrNull(fd, 'location_ar'), location_en: strOrNull(fd, 'location_en'), sort: numOrNull(fd, 'sort') ?? 0,
      is_active: fd.has('is_active') ? fd.get('is_active') === 'on' : true,
    };
    const id = str(fd, 'id');
    must(id ? await supabase.from('clinics').update(row).eq('id', id) : await supabase.from('clinics').insert(row));
    refresh();
    return { ok: true };
  });
}

// ------------------------------------------------------------------ doctors
export async function saveDoctor(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireAdmin();
    if (!str(fd, 'full_name_ar') || !str(fd, 'clinic_id')) throw new UserError(d.errors.REQUIRED);
    const slot = numOrNull(fd, 'slot_minutes') ?? 20;
    const row = {
      clinic_id: str(fd, 'clinic_id'), full_name_ar: str(fd, 'full_name_ar'), full_name_en: strOrNull(fd, 'full_name_en'),
      title: ['consultant', 'specialist', 'resident', 'gp'].includes(str(fd, 'title')) ? str(fd, 'title') : 'specialist',
      gender: str(fd, 'gender') === 'female' ? 'female' : 'male',
      specialty_ar: strOrNull(fd, 'specialty_ar'), specialty_en: strOrNull(fd, 'specialty_en'),
      bio_ar: strOrNull(fd, 'bio_ar'), bio_en: strOrNull(fd, 'bio_en'), photo_url: safeUrl(strOrNull(fd, 'photo_url')),
      languages: str(fd, 'languages').split(/[,،\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 6),
      qualifications: strOrNull(fd, 'qualifications'), years_experience: numOrNull(fd, 'years_experience'), scfhs_no: strOrNull(fd, 'scfhs_no'),
      consultation_fee: numOrNull(fd, 'consultation_fee') ?? 0, follow_up_fee: numOrNull(fd, 'follow_up_fee') ?? 0,
      slot_minutes: Math.min(120, Math.max(5, slot)),
      accepts_online: fd.get('accepts_online') === 'on', show_public: fd.get('show_public') === 'on',
      is_active: fd.has('is_active') ? fd.get('is_active') === 'on' : true,
    };
    if (!row.languages.length) row.languages = ['ar'];
    const id = str(fd, 'id');
    if (id) {
      must(await supabase.from('doctors').update(row).eq('id', id));
      const { data: doc } = await supabase.from('doctors').select('profile_id').eq('id', id).single();
      if (doc?.profile_id) await setAccountActive(doc.profile_id, row.is_active);
      refresh();
      return { ok: true };
    }
    const { data, error } = await supabase.from('doctors').insert(row).select('id').single();
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, data: { id: data.id } };
  });
}

export async function addShift(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireAdmin();
    const days = fd.getAll('weekday').map(Number).filter((n) => n >= 0 && n <= 6);
    const start = str(fd, 'start_time'), end = str(fd, 'end_time');
    if (!days.length || !start || !end || end <= start) throw new UserError(d.errors.INVALID_INPUT);
    must(await supabase.from('doctor_schedules').upsert(days.map((w) => ({ doctor_id: str(fd, 'doctor_id'), weekday: w, start_time: start, end_time: end })),
      { onConflict: 'doctor_id,weekday,start_time' }));
    refresh();
    return { ok: true };
  });
}

export async function removeShift(id: string) {
  const supabase = await requireAdmin();
  await supabase.from('doctor_schedules').delete().eq('id', id);
  refresh();
}

/** Login for a doctor profile (service key, admin only) */
export async function createDoctorLogin(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireAdmin();
    const email = str(fd, 'email').toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new UserError(d.errors.INVALID_EMAIL);
    const { data: doc } = await supabase.from('doctors').select('id, full_name_ar, profile_id').eq('id', str(fd, 'doctor_id')).single();
    if (!doc) throw new UserError(d.errors.NOT_FOUND);
    if (doc.profile_id) throw new UserError(d.errors.DUPLICATE);
    const { userId, password } = await createLoginAccount(email, doc.full_name_ar, strOrNull(fd, 'phone'), 'doctor');
    must(await createAdminClient().from('doctors').update({ profile_id: userId }).eq('id', doc.id));
    refresh();
    return { ok: true, data: { email, password } };
  });
}

// ------------------------------------------------------------------ staff accounts
const STAFF: Role[] = ['admin', 'reception', 'accountant', 'hr', 'employee'];

export async function createStaff(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    await requireAdmin();
    const role = str(fd, 'role') as Role;
    const email = str(fd, 'email').toLowerCase();
    if (!email || !str(fd, 'full_name') || !STAFF.includes(role)) throw new UserError(d.errors.REQUIRED);
    const { password } = await createLoginAccount(email, str(fd, 'full_name'), strOrNull(fd, 'phone'), role);
    refresh();
    return { ok: true, data: { password, email } };
  });
}

export async function toggleStaff(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireAdmin();
    const id = str(fd, 'profile_id');
    const { data: { user } } = await supabase.auth.getUser();
    if (id === user?.id) throw new UserError(d.errors.FORBIDDEN); // can't lock yourself out
    await setAccountActive(id, str(fd, 'active') === 'true');
    refresh();
  });
}

// ------------------------------------------------------------------ settings
export async function updateSettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await requireAdmin();
    const hex = (v: string, fb: string) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : fb);
    const clamp = (v: number | null, lo: number, hi: number, fb: number) => (v === null ? fb : Math.min(hi, Math.max(lo, v)));
    must(await supabase.from('company_settings').update({
      name_ar: str(fd, 'name_ar'), name_en: str(fd, 'name_en'), tagline_ar: str(fd, 'tagline_ar'), tagline_en: str(fd, 'tagline_en'),
      primary_color: hex(str(fd, 'primary_color'), '#0E4D5A'), accent_color: hex(str(fd, 'accent_color'), '#B8873F'),
      support_phone: strOrNull(fd, 'support_phone'), support_email: strOrNull(fd, 'support_email'),
      whatsapp: strOrNull(fd, 'whatsapp')?.replace(/[^0-9]/g, '') || null, website_url: safeUrl(strOrNull(fd, 'website_url')),
      instagram_url: safeUrl(strOrNull(fd, 'instagram_url')), snapchat_url: safeUrl(strOrNull(fd, 'snapchat_url')),
      tiktok_url: safeUrl(strOrNull(fd, 'tiktok_url')), x_url: safeUrl(strOrNull(fd, 'x_url')),
      address_ar: strOrNull(fd, 'address_ar'), address_en: strOrNull(fd, 'address_en'), map_query: strOrNull(fd, 'map_query'),
      working_hours_ar: strOrNull(fd, 'working_hours_ar'), working_hours_en: strOrNull(fd, 'working_hours_en'),
      cr_number: strOrNull(fd, 'cr_number'), moh_license: strOrNull(fd, 'moh_license'), vat_number: strOrNull(fd, 'vat_number'),
      vat_rate: clamp(numOrNull(fd, 'vat_rate'), 0, 100, 15),
      cancel_window_hours: clamp(numOrNull(fd, 'cancel_window_hours'), 0, 72, 3),
      booking_days_ahead: clamp(numOrNull(fd, 'booking_days_ahead'), 1, 180, 30),
      late_checkin_minutes: clamp(numOrNull(fd, 'late_checkin_minutes'), 0, 240, 20),
      notify_channels: fd.getAll('notify_channels').map(String).filter((c) => ['whatsapp', 'sms', 'email'].includes(c)),
      notify_roles: fd.getAll('notify_roles').map(String).filter((c) => ['patient', 'doctor', 'reception', 'admin'].includes(c)),
    }).eq('id', 1));
    refresh();
  });
}

export async function uploadLogo(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await requireAdmin();
    const file = fd.get('logo');
    if (!(file instanceof File) || file.size === 0) throw new UserError(d.errors.REQUIRED);
    if (file.size > 1.8 * 1024 * 1024) throw new UserError(d.errors.FILE_TOO_LARGE);
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z]/g, '');
    const path = `logo-${Date.now()}.${ext}`;
    must(await supabase.storage.from('branding').upload(path, file, { contentType: file.type, upsert: true }));
    const { data } = supabase.storage.from('branding').getPublicUrl(path);
    must(await supabase.from('company_settings').update({ logo_url: data.publicUrl }).eq('id', 1));
    refresh();
  });
}

export async function sendTestMessage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    await requireAdmin();
    const channel = str(fd, 'channel') as Channel;
    const to = strOrNull(fd, 'to');
    if (!to || !['sms', 'whatsapp', 'email'].includes(channel)) throw new UserError(d.errors.REQUIRED);
    if (!providerFor(channel)) throw new UserError(d.portal.notConfigured);
    const s = await (await createClient()).from('company_settings').select('name_ar').eq('id', 1).single();
    const r = await send(channel, { to, text: `رسالة تجريبية من نظام ${s.data?.name_ar ?? ''} ✅`, subject: 'رسالة تجريبية' });
    if (!r.ok) throw new UserError(r.error);
    return { ok: true, message: d.portal.testSent };
  });
}
