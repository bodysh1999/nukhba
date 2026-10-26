import 'server-only';
import { cache } from 'react';
import { createClient } from './supabase/server';
import type { Clinic, Doctor, Insurer, Service } from './types';

export const getClinics = cache(async (activeOnly = true): Promise<Clinic[]> => {
  const supabase = await createClient();
  let q = supabase.from('clinics').select('*').order('sort').order('name_ar');
  if (activeOnly) q = q.eq('is_active', true);
  const { data } = await q;
  return (data ?? []) as Clinic[];
});

export const getDoctors = cache(async (activeOnly = true): Promise<Doctor[]> => {
  const supabase = await createClient();
  let q = supabase.from('doctors').select('*').order('full_name_ar');
  if (activeOnly) q = q.eq('is_active', true);
  const { data } = await q;
  return (data ?? []) as Doctor[];
});

export const getInsurers = cache(async (activeOnly = false): Promise<Insurer[]> => {
  const supabase = await createClient();
  let q = supabase.from('insurance_companies').select('*').order('name_ar');
  if (activeOnly) q = q.eq('is_active', true);
  const { data } = await q;
  return (data ?? []) as Insurer[];
});

export const getServices = cache(async (activeOnly = true): Promise<Service[]> => {
  const supabase = await createClient();
  let q = supabase.from('services').select('*').order('kind').order('name_ar');
  if (activeOnly) q = q.eq('is_active', true);
  const { data } = await q;
  return (data ?? []) as Service[];
});

/** today's date in Riyadh as YYYY-MM-DD and the UTC bounds of that day */
export function riyadhDay(offset = 0) {
  const day = new Date(Date.now() + 3 * 3600e3 + offset * 86400e3).toISOString().slice(0, 10);
  return { day, from: `${day}T00:00:00+03:00`, to: `${day}T23:59:59.999+03:00` };
}
export function dayBounds(day: string) {
  return { from: `${day}T00:00:00+03:00`, to: `${day}T23:59:59.999+03:00` };
}

/** Lightweight, serialisable data the booking wizard needs */
export async function bookingData() {
  const [clinics, doctors] = await Promise.all([getClinics(), getDoctors()]);
  return {
    clinics: clinics.map((c) => ({ id: c.id, name_ar: c.name_ar, name_en: c.name_en, icon: c.icon, location_ar: c.location_ar, location_en: c.location_en })),
    doctors: doctors.filter((d) => clinics.some((c) => c.id === d.clinic_id)).map((d) => ({
      id: d.id, clinic_id: d.clinic_id, full_name_ar: d.full_name_ar, full_name_en: d.full_name_en, title: d.title, gender: d.gender,
      specialty_ar: d.specialty_ar, specialty_en: d.specialty_en, photo_url: d.photo_url, consultation_fee: Number(d.consultation_fee),
      follow_up_fee: Number(d.follow_up_fee), accepts_online: d.accepts_online,
    })),
  };
}
export type BookingData = Awaited<ReturnType<typeof bookingData>>;
