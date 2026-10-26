import 'server-only';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Clinic, Doctor } from './types';

/**
 * Public website data — read with the anonymous key only, so visitors see exactly what the
 * database allows for anyone (clinics, doctors, schedules, prices — never patient data).
 */
export function anonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const DOCTOR_COLS = 'id, clinic_id, full_name_ar, full_name_en, title, gender, specialty_ar, specialty_en, bio_ar, bio_en, photo_url, languages, qualifications, years_experience, consultation_fee, follow_up_fee, slot_minutes, accepts_online, show_public, is_active';
export type PublicDoctor = Omit<Doctor, 'scfhs_no' | 'profile_id'> & { rating?: { avg: number; n: number } | null };

export const getPublicClinics = cache(async (): Promise<Clinic[]> => {
  try {
    const { data } = await anonClient().from('clinics').select('id, code, name_ar, name_en, description_ar, description_en, icon, image_url, location_ar, location_en, sort, is_active').order('sort');
    return (data ?? []) as Clinic[];
  } catch { return []; }
});

export const getPublicDoctors = cache(async (): Promise<PublicDoctor[]> => {
  try {
    const sb = anonClient();
    const [{ data }, { data: rt }] = await Promise.all([sb.from('doctors').select(DOCTOR_COLS).order('full_name_ar'), sb.rpc('doctor_ratings')]);
    const ratings = new Map(((rt ?? []) as { doctor_id: string; avg_score: number; ratings: number }[]).map((r) => [r.doctor_id, { avg: Number(r.avg_score), n: r.ratings }]));
    return ((data ?? []) as PublicDoctor[]).map((x) => ({ ...x, rating: ratings.get(x.id) ?? null }));
  } catch { return []; }
});

export async function getDoctorSchedule(doctorId: string) {
  const { data } = await anonClient().from('doctor_schedules').select('weekday, start_time, end_time').eq('doctor_id', doctorId).order('start_time');
  return (data ?? []) as { weekday: number; start_time: string; end_time: string }[];
}

export const getPublicServices = cache(async () => {
  const { data } = await anonClient().from('services').select('id, code, name_ar, name_en, kind, clinic_id, price').eq('is_active', true).order('kind').order('name_ar');
  return (data ?? []) as { id: string; code: string; name_ar: string; name_en: string | null; kind: string; clinic_id: string | null; price: number }[];
});

export const getPublicInsurers = cache(async () => {
  const { data } = await anonClient().from('insurance_companies').select('id, name_ar, name_en').eq('is_active', true).order('name_ar');
  return (data ?? []) as { id: string; name_ar: string; name_en: string | null }[];
});

export type PublicOpening = { id: string; title: string; department: string | null; location: string; employment: 'full_time' | 'part_time' | 'contract' | 'training'; description: string | null; requirements: string | null };

export async function getOpenings(): Promise<PublicOpening[]> {
  try {
    const { data } = await anonClient().from('job_openings')
      .select('id, title, department, location, employment, description, requirements').eq('is_open', true).order('created_at');
    return (data ?? []) as PublicOpening[];
  } catch {
    return [];
  }
}

/** Google Maps embed (no API key) from coordinates or an address */
export function mapEmbed(q: string | null | undefined) {
  return q ? `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed` : null;
}
export function mapLink(q: string | null | undefined) {
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}
