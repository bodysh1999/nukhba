import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import { getDict } from './i18n';
import type { CompanySettings, Locale, Profile, Role } from './types';

export const DEFAULT_SETTINGS: CompanySettings = {
  name_ar: 'مجمع نُخبة الطبي',
  name_en: 'Nukhba Medical Complex',
  tagline_ar: 'رعاية طبية متكاملة بمعايير عالمية',
  tagline_en: 'Complete medical care to international standards',
  logo_url: null,
  primary_color: '#0E4D5A',
  accent_color: '#B8873F',
  support_phone: '920000000',
  support_email: 'care@nukhba-clinic.demo',
  whatsapp: '966500000000',
  website_url: null,
  instagram_url: null,
  snapchat_url: null,
  tiktok_url: null,
  address_ar: 'جدة — حي الروضة، طريق الأمير سلطان',
  address_en: 'Jeddah — Al Rawdah, Prince Sultan Rd',
  map_query: '21.5637,39.1500',
  working_hours_ar: 'السبت – الخميس: 9 صباحًا – 11 مساءً',
  working_hours_en: 'Sat – Thu: 9 AM – 11 PM',
  vat_rate: 15,
  cancel_window_hours: 3,
  booking_days_ahead: 30,
  notify_channels: [],
};

export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get('locale')?.value;
  return c === 'en' ? 'en' : 'ar';
});

export const getI18n = cache(async () => {
  const locale = await getLocale();
  return { locale, d: getDict(locale) };
});

export const getSettings = cache(async (): Promise<CompanySettings> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('company_settings').select('*').eq('id', 1).maybeSingle();
    return { ...DEFAULT_SETTINGS, ...(data ?? {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return (data as Profile) ?? null;
});

export function homeFor(role: Role): string {
  switch (role) {
    case 'patient': return '/patient';
    case 'doctor': return '/doctor';
    case 'reception': return '/reception';
    case 'accountant': return '/billing';
    case 'hr': return '/hr/employees';
    case 'employee': return '/me';
    default: return '/admin';
  }
}

/** Server-side guard: the UI is never the only line of defence (RLS is), but pages also refuse wrong roles. */
export async function requireRole(roles: Role[]): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!profile.is_active) redirect('/login?disabled=1');
  if (!roles.includes(profile.role)) redirect(homeFor(profile.role));
  return profile;
}
