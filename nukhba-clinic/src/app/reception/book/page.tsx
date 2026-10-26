import Link from 'next/link';
import { AlertTriangle, Search, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { bookingData, riyadhDay } from '@/lib/clinic-data';
import { BookingWizard } from '@/components/booking-wizard';
import { Avatar, PatientLine } from '@/components/clinic-ui';
import { Card, EmptyState, Input, LinkButton, PageHeader, buttonClass } from '@/components/ui';
import type { Patient } from '@/lib/types';
import { searchPatients } from '../patients/search';

export default async function ReceptionBook({ searchParams }: { searchParams: Promise<{ patient?: string; q?: string; request?: string; doctor?: string; clinic?: string }> }) {
  const sp = await searchParams;
  const [{ d, locale }, supabase, data] = await Promise.all([getI18n(), createClient(), bookingData()]);
  const k = d.cl.desk;
  type P = Patient & { insurance_companies: { name_ar: string; name_en: string | null; is_active: boolean } | null };
  const patient: P | null = sp.patient
    ? ((await supabase.from('patients').select('*, insurance_companies(name_ar, name_en, is_active)').eq('id', sp.patient).maybeSingle()).data as P | null)
    : null;
  const results = !patient && sp.q ? await searchPatients(sp.q, 12) : [];
  const insExpired = patient?.insurance_company_id && patient.insurance_expiry && patient.insurance_expiry < riyadhDay().day;
  const keep = (extra: string) => `${extra}${sp.request ? `&request=${sp.request}` : ''}${sp.doctor ? `&doctor=${sp.doctor}` : ''}`;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={k.walkIn} subtitle={d.cl.book.sub} />
      {!patient ? (
        <Card className="p-5">
          <form className="flex gap-2" action="/reception/book">
            {sp.request && <input type="hidden" name="request" value={sp.request} />}
            {sp.doctor && <input type="hidden" name="doctor" value={sp.doctor} />}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-450" />
              <Input name="q" defaultValue={sp.q} placeholder={k.findPatient} className="ps-10" autoFocus />
            </div>
            <button className={buttonClass('primary')}>{d.common.search}</button>
          </form>
          {sp.q && (
            results.length === 0 ? (
              <EmptyState title={k.noMatch}>
                <LinkButton href={`/reception/patients/new?then=book&q=${encodeURIComponent(sp.q)}`} className="mt-3"><UserPlus className="h-4 w-4" />{k.newPatient}</LinkButton>
              </EmptyState>
            ) : (
              <ul className="mt-4 divide-y divide-sand-100 rounded-xl border border-sand-200">
                {results.map((p) => (
                  <li key={p.id}>
                    <Link href={`/reception/book?${keep(`patient=${p.id}`)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sand-50">
                      <Avatar name={p.full_name} gender={p.gender} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{p.full_name}</div>
                        <PatientLine p={p} d={d} />
                      </div>
                      <span className="text-xs text-stone-450" dir="ltr">{p.phone}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          )}
          <div className="mt-4 border-t border-sand-100 pt-4">
            <LinkButton href="/reception/patients/new?then=book" variant="outline"><UserPlus className="h-4 w-4" />{k.newPatient}</LinkButton>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center gap-3 p-4">
            <Avatar name={patient.full_name} gender={patient.gender} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{patient.full_name}</div>
              <PatientLine p={patient} d={d} />
            </div>
            {patient.insurance_companies && (
              <span className="text-sm text-teal-800">{locale === 'ar' ? patient.insurance_companies.name_ar : patient.insurance_companies.name_en ?? patient.insurance_companies.name_ar}</span>
            )}
            <Link href={`/reception/book${sp.request ? `?request=${sp.request}` : ''}`} className="text-sm text-brand hover:underline">{d.cl.book.change}</Link>
          </Card>
          {insExpired && <p className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="h-4 w-4" />{k.insuranceWarn}</p>}
          {patient.allergies && <p className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-900"><AlertTriangle className="h-4 w-4" />{d.cl.f.allergies}: {patient.allergies}</p>}
          <BookingWizard data={data} mode="staff" patientId={patient.id} requestId={sp.request ?? null} initialDoctor={sp.doctor ?? null} initialClinic={sp.clinic ?? null} />
        </div>
      )}
    </div>
  );
}
