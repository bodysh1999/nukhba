import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Patient } from '@/lib/types';

/** The patient file linked to the signed-in account (RLS returns only their own) */
export const getMyPatient = cache(async (): Promise<(Patient & { insurance_companies: { name_ar: string; name_en: string | null } | null }) | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('patients').select('*, insurance_companies(name_ar, name_en)').eq('profile_id', user.id).maybeSingle();
  return (data as Patient & { insurance_companies: { name_ar: string; name_en: string | null } | null }) ?? null;
});
