import Link from 'next/link';
import { Stethoscope, UsersRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { StaffCreateForm, ToggleActive } from './team-forms';

export const metadata = { title: 'فريق العمل' };

export default async function TeamPage() {
  const [{ d }, supabase] = await Promise.all([getI18n(), createClient()]);
  const { data: staff } = await supabase.from('profiles').select('id, full_name, email, phone, role, is_active')
    .in('role', ['admin', 'reception', 'accountant', 'hr', 'employee', 'doctor']).order('role').order('full_name');
  const rows = (staff ?? []) as { id: string; full_name: string; email: string | null; phone: string | null; role: 'admin' | 'reception' | 'accountant' | 'hr' | 'employee' | 'doctor'; is_active: boolean }[];
  return (
    <div className="space-y-6">
      <PageHeader title={d.cl.adm.team} actions={<LinkButton href="/admin/doctors" variant="outline"><Stethoscope className="h-4 w-4" />{d.cl.adm.doctors}</LinkButton>} />
      <Card className="p-5"><h3 className="mb-3 font-semibold">{d.cl.adm.addStaff}</h3><StaffCreateForm /></Card>
      <Card className="overflow-x-auto">
        <CardHeader title={d.cl.adm.staff} subtitle={`${rows.length}`} />
        {!rows.length ? <EmptyState icon={<UsersRound className="h-5 w-5" />} title={d.common.noData} /> : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-sand-50 text-xs text-stone-450"><tr>
              <th className="px-5 py-2.5 text-start font-medium">{d.common.name}</th><th className="px-5 py-2.5 text-start font-medium">{d.common.email}</th>
              <th className="px-5 py-2.5 text-start font-medium">{d.cl.adm.role}</th><th className="px-5 py-2.5 text-start font-medium">{d.common.status}</th><th />
            </tr></thead>
            <tbody className="divide-y divide-sand-100">
              {rows.map((s) => (
                <tr key={s.id} className={s.is_active ? '' : 'opacity-60'}>
                  <td className="px-5 py-3 font-medium">{s.full_name}<div className="text-xs text-stone-450" dir="ltr">{s.phone}</div></td>
                  <td className="px-5 py-3" dir="ltr">{s.email}</td>
                  <td className="px-5 py-3"><Badge className="bg-brand/10 text-brand ring-brand/20">{d.roles[s.role]}</Badge></td>
                  <td className="px-5 py-3">{s.is_active ? d.common.active : d.common.inactive}</td>
                  <td className="px-5 py-3 text-end">{s.role === 'doctor' ? <Link href="/admin/doctors" className="text-xs text-brand hover:underline">{d.cl.adm.doctors}</Link> : <ToggleActive id={s.id} active={s.is_active} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
