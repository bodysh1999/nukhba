import { getI18n, requireRole } from '@/lib/session';
import { getClinics, getServices } from '@/lib/clinic-data';
import { Creator } from '@/components/forms-kit';
import { Money } from '@/components/clinic-ui';
import { Badge, Card, PageHeader } from '@/components/ui';
import { ServiceForm } from '../billing-client';

export const metadata = { title: 'قائمة الأسعار' };

export default async function ServicesPage() {
  await requireRole(['admin', 'accountant']);
  const [{ d, locale }, services, clinics] = await Promise.all([getI18n(), getServices(false), getClinics(false)]);
  const b = d.cl.bill;
  const kinds = ['procedure', 'lab', 'radiology', 'other'] as const;
  return (
    <div>
      <PageHeader title={b.prices} subtitle={locale === 'ar' ? 'رسوم الكشف والمراجعة تُحدّد لكل طبيب من صفحة الأطباء' : 'Consultation fees are set per doctor on the doctors page'} />
      <div className="mb-6"><Creator label={b.addService}>{() => <ServiceForm clinics={clinics} />}</Creator></div>
      <div className="space-y-6">
        {kinds.map((k) => {
          const list = services.filter((s) => s.kind === k);
          if (!list.length) return null;
          return (
            <Card key={k}>
              <div className="border-b border-sand-100 px-5 py-3 font-semibold">{d.cl.serviceKind[k]} <span className="text-sm font-normal text-stone-450">· {list.length}</span></div>
              <ul className="divide-y divide-sand-100">
                {list.map((s) => (
                  <li key={s.id}>
                    <details>
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 text-sm [&::-webkit-details-marker]:hidden">
                        <span className="w-24 font-mono text-xs text-stone-450" dir="ltr">{s.code}</span>
                        <span className="min-w-0 flex-1 truncate">{locale === 'ar' ? s.name_ar : s.name_en ?? s.name_ar}</span>
                        {!s.is_active && <Badge className="bg-stone-100 text-stone-600 ring-stone-200">{d.common.inactive}</Badge>}
                        <Money v={s.price} l={locale} className="font-semibold" />
                      </summary>
                      <div className="border-t border-sand-100 bg-sand-50/50 p-5"><ServiceForm service={s} clinics={clinics} /></div>
                    </details>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
