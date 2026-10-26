import { getI18n } from '@/lib/session';
import { getClinics, getDoctors } from '@/lib/clinic-data';
import { Creator } from '@/components/forms-kit';
import { ClinicIcon } from '@/components/clinic-ui';
import { Badge, PageHeader } from '@/components/ui';
import { ClinicForm } from '../clinic-forms';

export const metadata = { title: 'العيادات' };

export default async function ClinicsPage() {
  const [{ d, locale }, clinics, doctors] = await Promise.all([getI18n(), getClinics(false), getDoctors(false)]);
  const a = d.cl.adm;
  return (
    <div>
      <PageHeader title={a.clinics} subtitle={`${clinics.length}`} />
      <div className="mb-6"><Creator label={a.addClinic}>{() => <ClinicForm />}</Creator></div>
      <div className="space-y-3">
        {clinics.map((c) => (
          <details key={c.id} className="rounded-2xl border border-sand-200 bg-white shadow-card">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/[.07] text-brand"><ClinicIcon name={c.icon} className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{locale === 'ar' ? c.name_ar : c.name_en}</div>
                <div className="text-xs text-stone-450">{(locale === 'ar' ? c.location_ar : c.location_en) ?? ''} · {doctors.filter((x) => x.clinic_id === c.id && x.is_active).length} {d.cl.f.doctors}</div>
              </div>
              {!c.is_active && <Badge className="bg-stone-100 text-stone-600 ring-stone-200">{a.hidden}</Badge>}
              <span className="text-sm text-brand">{d.common.edit}</span>
            </summary>
            <div className="border-t border-sand-100 p-5"><ClinicForm clinic={c} /></div>
          </details>
        ))}
      </div>
    </div>
  );
}
