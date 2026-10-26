import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, CalendarPlus, Pencil, Phone, ReceiptText, ShieldPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { getInsurers, riyadhDay } from '@/lib/clinic-data';
import { ApptBadge, Avatar, fmtDay, fmtTime, InvoiceBadge, Money, PatientLine } from '@/components/clinic-ui';
import { Card, CardHeader, EmptyState, KeyValue, LinkButton, PageHeader } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import type { AppointmentOverview, Invoice, Patient } from '@/lib/types';
import { PatientForm, PortalAccount } from '../../desk-client';

export default async function PatientFile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ d, locale }, supabase, insurers] = await Promise.all([getI18n(), createClient(), getInsurers()]);
  const { data: p } = await supabase.from('patients').select('*').eq('id', id).maybeSingle();
  if (!p) notFound();
  const patient = p as Patient;
  const [{ data: appts }, { data: invs }] = await Promise.all([
    supabase.from('appointment_overview').select('*').eq('patient_id', id).order('starts_at', { ascending: false }).limit(50),
    supabase.from('invoices').select('*').eq('patient_id', id).neq('status', 'cancelled').order('created_at', { ascending: false }).limit(30),
  ]);
  const f = d.cl.f;
  const ins = insurers.find((i) => i.id === patient.insurance_company_id);
  const expired = patient.insurance_expiry && patient.insurance_expiry < riyadhDay().day;
  const balance = ((invs ?? []) as Invoice[]).reduce((s, i) => s + (['issued', 'partially_paid'].includes(i.status) ? Number(i.patient_amount) - Number(i.paid_amount) : 0), 0);

  return (
    <div>
      <PageHeader
        eyebrow={<span dir="ltr">{patient.file_no}</span>}
        title={patient.full_name}
        subtitle={<PatientLine p={patient} d={d} />}
        actions={<>
          <a href={`tel:${patient.phone}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-sand-300 bg-white px-4 text-sm"><Phone className="h-4 w-4" /><span dir="ltr">{patient.phone}</span></a>
          <LinkButton href={`/reception/book?patient=${patient.id}`} variant="accent"><CalendarPlus className="h-4 w-4" />{d.cl.desk.bookFor}</LinkButton>
        </>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {(patient.allergies || patient.chronic_conditions) && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                {patient.allergies && <div><b>{f.allergies}:</b> {patient.allergies}</div>}
                {patient.chronic_conditions && <div><b>{f.chronic}:</b> {patient.chronic_conditions}</div>}
              </div>
            </div>
          )}
          <Card>
            <CardHeader title={d.cl.desk.history} />
            {!appts?.length ? <EmptyState title={d.cl.pt.noAppts} /> : (
              <ul className="divide-y divide-sand-100">
                {(appts as AppointmentOverview[]).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <div className="w-36 shrink-0">
                      <div className="font-medium">{fmtDay(a.starts_at, locale, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      <div className="text-xs text-stone-450">{fmtTime(a.starts_at, locale)}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{locale === 'ar' ? a.doctor_name_ar : a.doctor_name_en ?? a.doctor_name_ar}</div>
                      <div className="truncate text-xs text-stone-450">{locale === 'ar' ? a.clinic_name_ar : a.clinic_name_en} · <span dir="ltr">{a.ref_no}</span></div>
                    </div>
                    <ApptBadge status={a.status} d={d} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title={d.cl.inv.title} subtitle={balance > 0 ? <span className="text-rose-700">{d.cl.inv.balance}: <Money v={balance} l={locale} /></span> : undefined} />
            {!invs?.length ? <EmptyState icon={<ReceiptText className="h-5 w-5" />} title={d.cl.inv.noInvoices} /> : (
              <ul className="divide-y divide-sand-100">
                {(invs as Invoice[]).map((i) => (
                  <li key={i.id}>
                    <Link href={`/billing/invoices/${i.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-sand-50">
                      <span className="font-mono text-xs" dir="ltr">{i.inv_no}</span>
                      <span className="flex-1 text-stone-450">{fmtDate(i.created_at, locale)}</span>
                      <Money v={i.patient_amount} l={locale} className="font-medium" />
                      <InvoiceBadge status={i.status} d={d} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <details className="group rounded-2xl border border-sand-200 bg-white shadow-card">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
              <Pencil className="h-4 w-4 text-stone-450" />{d.common.edit}
            </summary>
            <div className="border-t border-sand-100 p-5"><PatientForm patient={patient} insurers={insurers} /></div>
          </details>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-3">
              <Avatar name={patient.full_name} gender={patient.gender} size="lg" />
              <div className="min-w-0 text-sm">
                <div className="font-semibold">{patient.full_name}</div>
                {patient.full_name_en && <div className="text-xs text-stone-450" dir="ltr">{patient.full_name_en}</div>}
              </div>
            </div>
            <div className="divide-y divide-sand-100">
              <KeyValue label={f.nationalId}><span dir="ltr">{patient.national_id ?? '—'}</span></KeyValue>
              <KeyValue label={f.birthDate}>{fmtDate(patient.birth_date, locale)}</KeyValue>
              <KeyValue label={f.nationality}>{patient.is_saudi ? f.saudi : patient.nationality ?? f.nonSaudi}</KeyValue>
              <KeyValue label={f.bloodType}>{patient.blood_type ?? '—'}</KeyValue>
              <KeyValue label={f.email}><span dir="ltr" className="break-all">{patient.email ?? '—'}</span></KeyValue>
              <KeyValue label={f.emergency}>{patient.emergency_name ? <>{patient.emergency_name} <span dir="ltr" className="text-stone-450">{patient.emergency_phone}</span></> : '—'}</KeyValue>
            </div>
          </Card>
          <Card className={`p-5 ${expired ? 'border-amber-300' : ''}`}>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><ShieldPlus className="h-4 w-4 text-teal-700" />{f.insurance}</div>
            {ins ? (
              <div className="divide-y divide-sand-100">
                <KeyValue label={f.insurer}>{locale === 'ar' ? ins.name_ar : ins.name_en ?? ins.name_ar}</KeyValue>
                <KeyValue label={f.memberNo}><span dir="ltr">{patient.insurance_member_no ?? '—'}</span></KeyValue>
                <KeyValue label={f.insClass}>{patient.insurance_class ?? '—'}</KeyValue>
                <KeyValue label={f.insExpiry}><span className={expired ? 'text-amber-700' : ''}>{fmtDate(patient.insurance_expiry, locale)}{expired ? ` · ${f.insExpired}` : ''}</span></KeyValue>
                <KeyValue label={d.cl.bill.coverage}>{ins.coverage_percent}% {ins.max_copay ? `· ${d.cl.inv.cap.replace('{a}', String(ins.max_copay))}` : ''}</KeyValue>
              </div>
            ) : <p className="text-sm text-stone-450">{f.noInsurance}</p>}
          </Card>
          <Card className="p-5"><PortalAccount patient={patient} /></Card>
        </aside>
      </div>
    </div>
  );
}
