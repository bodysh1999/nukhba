import { Search } from 'lucide-react';
import { getI18n } from '@/lib/session';
import { ActionFormButton } from './submit';
import { Avatar, PatientLine } from '@/components/clinic-ui';
import { Card, EmptyState, Input, PageHeader, buttonClass } from '@/components/ui';
import { searchPatients } from '@/app/reception/patients/search';

export default async function NewInvoice({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const { d } = await getI18n();
  const rows = sp.q ? await searchPatients(sp.q, 15) : [];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={d.cl.bill.walkIn} subtitle={d.cl.bill.choosePatient} />
      <Card className="p-5">
        <form className="flex gap-2" action="/billing/new">
          <div className="relative flex-1"><Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-450" /><Input name="q" defaultValue={sp.q} placeholder={d.cl.desk.findPatient} className="ps-10" autoFocus /></div>
          <button className={buttonClass('primary')}>{d.common.search}</button>
        </form>
        {sp.q && (rows.length === 0 ? <EmptyState title={d.cl.desk.noMatch} /> : (
          <ul className="mt-4 divide-y divide-sand-100 rounded-xl border border-sand-200">
            {rows.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={p.full_name} gender={p.gender} size="sm" />
                <div className="min-w-0 flex-1"><div className="truncate font-medium">{p.full_name}</div><PatientLine p={p} d={d} /></div>
                <ActionFormButton patientId={p.id} label={d.cl.bill.newInvoice} />
              </li>
            ))}
          </ul>
        ))}
      </Card>
    </div>
  );
}
