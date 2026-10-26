import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Doctor } from '@/lib/types';

/** The doctor record linked to the signed-in account */
export const getMyDoctor = cache(async (): Promise<Doctor | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('doctors').select('*').eq('profile_id', user.id).maybeSingle();
  return (data as Doctor) ?? null;
});
