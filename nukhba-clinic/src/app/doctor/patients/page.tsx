import Link from 'next/link';
import { Search, UsersRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { Avatar, PatientLine } from '@/components/clinic-ui';
import { Card, EmptyState, Input, PageHeader, buttonClass } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import type { Patient } from '@/lib/types';
import { getMyDoctor } from '../data';

export const metadata = { title: 'مرضاي' };

export default async function MyPatients({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const [{ d, locale }, supabase, me] = await Promise.all([getI18n(), createClient(), getMyDoctor()]);
  if (!me) return <EmptyState title={d.errors.FORBIDDEN} />;
  // last visit per patient with this doctor
  const { data: appts } = await supabase.from('appointments').select('patient_id, starts_at').eq('doctor_id', me.id)
    .in('status', ['completed', 'in_consultation', 'checked_in']).order('starts_at', { ascending: false }).limit(1000);
  const last = new Map<string, string>();
  for (const a of appts ?? []) if (!last.has(a.patient_id)) last.set(a.patient_id, a.starts_at);
  const ids = [...last.keys()];
  let q = supabase.from('patients').select('*').in('id', ids.length ? ids.slice(0, 300) : ['00000000-0000-0000-0000-000000000000']);
  const term = (sp.q ?? '').trim().replace(/[,()%*]/g, ' ').trim();
  if (term) q = q.or(`full_name.ilike.%${term}%,file_no.ilike.%${term}%,phone.ilike.%${term}%`);
  const { data } = await q;
  const rows = ((data ?? []) as Patient[]).sort((a, b) => (last.get(b.id) ?? '').localeCompare(last.get(a.id) ?? ''));
  return (
    <div>
      <PageHeader title={d.cl.dr.patients} subtitle={`${ids.length}`} />
      <form className="mb-4 flex gap-2" action="/doctor/patients">
        <div className="relative flex-1"><Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-450" /><Input name="q" defaultValue={sp.q} placeholder={d.cl.desk.findPatient} className="ps-10" /></div>
        <button className={buttonClass('primary')}>{d.common.search}</button>
      </form>
      <Card>
        {rows.length === 0 ? <EmptyState icon={<UsersRound className="h-5 w-5" />} title={d.common.noData} /> : (
          <ul className="divide-y divide-sand-100">
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`/doctor/patients/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sand-50 sm:px-5">
                  <Avatar name={p.full_name} gender={p.gender} size="sm" />
                  <div className="min-w-0 flex-1"><div className="truncate font-medium">{p.full_name}</div><PatientLine p={p} d={d} /></div>
                  <span className="text-xs text-stone-450">{fmtDate(last.get(p.id), locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
