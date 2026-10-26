import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Patient } from '@/lib/types';

/** Name, mobile (any format), national ID or file number */
export async function searchPatients(q: string, limit = 30, offset = 0): Promise<Patient[]> {
  const supabase = await createClient();
  let query = supabase.from('patients').select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  const term = q.trim().replace(/[,()%*]/g, ' ').trim();
  if (term) {
    const digits = term.replace(/\D/g, '');
    const parts = [`full_name.ilike.%${term}%`, `full_name_en.ilike.%${term}%`, `file_no.ilike.%${term}%`];
    if (digits.length >= 4) {
      const local = digits.replace(/^966/, '0');
      parts.push(`phone.ilike.%${local.slice(-9)}%`, `national_id.ilike.%${digits}%`);
    }
    query = query.or(parts.join(','));
  }
  const { data } = await query;
  return (data ?? []) as Patient[];
}
