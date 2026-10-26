import Link from 'next/link';
import { Search, ShieldPlus, UserPlus, UsersRound } from 'lucide-react';
import { getI18n } from '@/lib/session';
import { Avatar, PatientLine } from '@/components/clinic-ui';
import { Badge, Card, EmptyState, Input, LinkButton, PageHeader, buttonClass } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import { searchPatients } from './search';

export const metadata = { title: 'ملفات المرضى' };
const PAGE = 30;

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string; p?: string }> }) {
  const sp = await searchParams;
  const { d, locale } = await getI18n();
  const page = Math.max(0, Number(sp.p ?? 0) || 0);
  const rows = await searchPatients(sp.q ?? '', PAGE + 1, page * PAGE);
  const more = rows.length > PAGE;
  const list = rows.slice(0, PAGE);
  const link = (p: number) => `/reception/patients?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), p: String(p) })}`;
  return (
    <div>
      <PageHeader title={d.cl.desk.patients} actions={<LinkButton href="/reception/patients/new"><UserPlus className="h-4 w-4" />{d.cl.desk.newPatient}</LinkButton>} />
      <form className="mb-4 flex gap-2" action="/reception/patients">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-450" />
          <Input name="q" defaultValue={sp.q} placeholder={d.cl.desk.findPatient} className="ps-10" />
        </div>
        <button className={buttonClass('primary')}>{d.common.search}</button>
      </form>
      <Card className="overflow-hidden">
        {list.length === 0 ? <EmptyState icon={<UsersRound className="h-5 w-5" />} title={d.cl.desk.noMatch} /> : (
          <ul className="divide-y divide-sand-100">
            {list.map((p) => (
              <li key={p.id}>
                <Link href={`/reception/patients/${p.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-sand-50 sm:px-5">
                  <Avatar name={p.full_name} gender={p.gender} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{p.full_name}</span>
                      {p.insurance_company_id && <Badge className="bg-teal-50 text-teal-800 ring-teal-200"><ShieldPlus className="h-3 w-3" />{d.cl.f.insurance}</Badge>}
                      {p.account_status === 'active' && <Badge className="bg-sky-50 text-sky-800 ring-sky-200">{d.cl.f.account}</Badge>}
                    </div>
                    <PatientLine p={p} d={d} />
                  </div>
                  <div className="hidden text-end text-xs text-stone-450 sm:block">
                    <div dir="ltr">{p.phone}</div>
                    <div>{fmtDate(p.created_at, locale)}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {(page > 0 || more) && (
        <div className="mt-4 flex justify-center gap-2">
          {page > 0 && <LinkButton variant="outline" href={link(page - 1)}>{d.common.back}</LinkButton>}
          {more && <LinkButton variant="outline" href={link(page + 1)}>{d.nav.more}</LinkButton>}
        </div>
      )}
    </div>
  );
}
