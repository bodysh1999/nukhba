import { getI18n, requireRole } from '@/lib/session';
import { getInsurers } from '@/lib/clinic-data';
import { Creator } from '@/components/forms-kit';
import { Badge, Card, PageHeader } from '@/components/ui';
import { InsurerForm } from '../billing-client';

export const metadata = { title: 'شركات التأمين' };

export default async function InsurersPage() {
  await requireRole(['admin', 'accountant']);
  const [{ d, locale }, insurers] = await Promise.all([getI18n(), getInsurers()]);
  const b = d.cl.bill;
  return (
    <div>
      <PageHeader title={b.insurers} />
      <div className="mb-6"><Creator label={b.addInsurer}>{() => <InsurerForm />}</Creator></div>
      <div className="space-y-3">
        {insurers.map((i) => (
          <details key={i.id} className="group rounded-2xl border border-sand-200 bg-white shadow-card">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span className="font-semibold">{locale === 'ar' ? i.name_ar : i.name_en ?? i.name_ar}</span>
              {i.code && <span className="font-mono text-xs text-stone-450">{i.code}</span>}
              <Badge className="bg-teal-50 text-teal-800 ring-teal-200">{b.coverage.replace(' %', '')}: {i.coverage_percent}%</Badge>
              {i.max_copay && <Badge className="bg-sand-100 text-ink/70 ring-sand-200">{b.maxCopay}: {i.max_copay}</Badge>}
              {i.requires_approval && <Badge className="bg-amber-50 text-amber-800 ring-amber-200">{b.requiresApproval}</Badge>}
              {!i.is_active && <Badge className="bg-stone-100 text-stone-600 ring-stone-200">{d.common.inactive}</Badge>}
              <span className="ms-auto text-sm text-brand">{d.common.edit}</span>
            </summary>
            <div className="border-t border-sand-100 p-5"><InsurerForm insurer={i} /></div>
          </details>
        ))}
      </div>
    </div>
  );
}
