import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, BadgeCheck, FileText, FlaskConical, Pill, Printer, ShieldPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { getServices, riyadhDay } from '@/lib/clinic-data';
import { Avatar, FlagBadge, fmtDay, PatientLine } from '@/components/clinic-ui';
import { Badge, Card, CardHeader, EmptyState, KeyValue, PageHeader, buttonClass } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import { ageOf, bmiOf } from '@/lib/constants';
import type { MedicalDoc, Patient, RxItem, TestOrder, Visit } from '@/lib/types';
import {
  AlertsForm, CancelTestButton, EncounterForm, IssueDocForm, OrderTests, ReopenVisit, ResultForm, RevokeDoc, RxPad,
} from '../../encounter-client';

export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ d, locale }, supabase, services] = await Promise.all([getI18n(), createClient(), getServices()]);
  const { data: v } = await supabase.from('visits').select('*').eq('id', id).maybeSingle();
  if (!v) notFound();
  const visit = v as Visit;
  const [{ data: p }, { data: rx }, { data: tests }, { data: docs }, { data: note }, { data: prev }] = await Promise.all([
    supabase.from('patients').select('*').eq('id', visit.patient_id).single(),
    supabase.from('prescription_items').select('*').eq('visit_id', id).order('created_at'),
    supabase.from('lab_orders').select('*').eq('visit_id', id).order('created_at'),
    supabase.from('medical_documents').select('*').eq('visit_id', id).order('issued_at'),
    supabase.from('visit_private_notes').select('body').eq('visit_id', id).maybeSingle(),
    supabase.from('visits').select('id, created_at, diagnosis, icd10_code, doctor_id, doctors(full_name_ar, full_name_en), clinics(name_ar, name_en)')
      .eq('patient_id', visit.patient_id).eq('status', 'signed').neq('id', id).order('created_at', { ascending: false }).limit(8),
  ]);
  const patient = p as Patient;
  const { data: ins } = patient.insurance_company_id
    ? await supabase.from('insurance_companies').select('name_ar, name_en').eq('id', patient.insurance_company_id).maybeSingle()
    : { data: null };
  const k = d.cl.dr;
  const r = d.cl.rec;
  const open = visit.status === 'open';
  const canReopen = !open && visit.signed_at && Date.now() - new Date(visit.signed_at).getTime() < 24 * 3600e3;
  const testList = (tests ?? []) as TestOrder[];
  type Prev = { id: string; created_at: string; diagnosis: string | null; icd10_code: string | null; doctors: { full_name_ar: string; full_name_en: string | null } | null; clinics: { name_ar: string; name_en: string } | null };

  return (
    <div>
      <PageHeader
        eyebrow={<>{k.encounter} · {fmtDay(visit.created_at, locale)}</>}
        title={patient.full_name}
        subtitle={<PatientLine p={patient} d={d} />}
        actions={<>
          <Link href={`/doctor/patients/${patient.id}`} className={buttonClass('outline')}>{k.chart}</Link>
          {!open && <Link href={`/print/visit/${visit.id}`} target="_blank" className={buttonClass('outline')}><Printer className="h-4 w-4" />{r.printRx}</Link>}
          {!open && <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-200"><BadgeCheck className="h-3.5 w-3.5" />{k.signed}</Badge>}
        </>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {(patient.allergies || patient.chronic_conditions || patient.current_medications) && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              <div className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />{k.alerts}</div>
              {patient.allergies && <div>{d.cl.f.allergies}: <b>{patient.allergies}</b></div>}
              {patient.chronic_conditions && <div>{d.cl.f.chronic}: {patient.chronic_conditions}</div>}
              {patient.current_medications && <div>{d.cl.f.meds}: {patient.current_medications}</div>}
            </div>
          )}

          <Card className="p-5">
            {open ? <EncounterForm visit={visit} privateNote={note?.body ?? ''} /> : (
              <div className="space-y-4 text-sm">
                <p className="rounded-xl bg-sand-50 p-3 text-stone-450">{k.readOnly}</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    [r.bp, visit.bp_systolic ? `${visit.bp_systolic}/${visit.bp_diastolic}` : null], [r.pulse, visit.pulse], [r.temp, visit.temperature],
                    [r.spo2, visit.spo2 ? `${visit.spo2}%` : null], [r.weight, visit.weight_kg], [r.height, visit.height_cm], [r.bmi, bmiOf(visit.weight_kg, visit.height_cm)],
                  ].map(([l, val]) => <div key={String(l)} className="rounded-xl bg-sand-50 px-3 py-2"><div className="text-xs text-stone-450">{l}</div><div className="font-semibold tabular-nums" dir="ltr">{val ?? '—'}</div></div>)}
                </div>
                {[[k.complaint, visit.chief_complaint], [k.history, visit.history], [k.exam, visit.examination], [k.diagnosis, visit.diagnosis ? `${visit.diagnosis}${visit.icd10_code ? ` (${visit.icd10_code})` : ''}` : null], [k.plan, visit.plan], [k.advice, visit.patient_advice]]
                  .filter(([, val]) => val).map(([l, val]) => <div key={String(l)}><div className="text-xs font-medium text-stone-450">{l}</div><p className="mt-0.5 whitespace-pre-line">{val}</p></div>)}
                {note?.body && <div className="rounded-xl border border-dashed border-sand-300 p-3"><div className="text-xs text-stone-450">{k.privateNote}</div><p className="whitespace-pre-line">{note.body}</p></div>}
                {canReopen && <ReopenVisit id={visit.id} />}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Pill className="h-4 w-4 text-brand" />{k.rx}</span>} />
            <div className="p-4"><RxPad visitId={visit.id} editable={open} items={(rx ?? []) as RxItem[]} /></div>
          </Card>

          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-brand" />{k.tests}</span>} />
            <div className="space-y-3 p-4">
              {testList.length > 0 && (
                <ul className="divide-y divide-sand-100 rounded-xl border border-sand-200">
                  {testList.map((t) => (
                    <li key={t.id} className="px-3 py-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate font-medium">{t.test_name}</span>
                        <Badge className="bg-sand-100 text-ink/70 ring-sand-200">{d.cl.testStatus[t.status]}</Badge>
                        <FlagBadge flag={t.result_flag} d={d} />
                        {open && t.status === 'ordered' && <CancelTestButton id={t.id} />}
                      </div>
                      {t.result_text && <p className="mt-1 text-xs text-ink/80">{t.result_text}</p>}
                      {t.status === 'ordered' && <ResultForm orderId={t.id} patientId={patient.id} visitId={visit.id} />}
                    </li>
                  ))}
                </ul>
              )}
              {open && <OrderTests visitId={visit.id} services={services.filter((s) => s.kind === 'lab' || s.kind === 'radiology')} />}
            </div>
          </Card>

          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><FileText className="h-4 w-4 text-brand" />{k.documents}</span>} />
            <div className="space-y-3 p-4">
              {((docs ?? []) as MedicalDoc[]).map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-sand-200 px-3 py-2 text-sm">
                  <span className="font-medium">{d.cl.docKind[m.kind]}</span>
                  <span className="font-mono text-xs text-stone-450" dir="ltr">{m.ref_no}</span>
                  {m.kind === 'sick_leave' && <span className="text-xs text-stone-450">{fmtDate(m.from_date, locale)} → {fmtDate(m.to_date, locale)}</span>}
                  {m.revoked_at && <Badge className="bg-rose-50 text-rose-700 ring-rose-200">{r.revoked}</Badge>}
                  <span className="ms-auto flex items-center gap-1">
                    <Link href={`/print/document/${m.id}`} target="_blank" className={buttonClass('ghost', 'sm')}><Printer className="h-3.5 w-3.5" /></Link>
                    {!m.revoked_at && <RevokeDoc id={m.id} />}
                  </span>
                </div>
              ))}
              {Date.now() - new Date(visit.created_at).getTime() < 7 * 86400e3 && <IssueDocForm visitId={visit.id} today={riyadhDay().day} />}
            </div>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-3">
              <Avatar name={patient.full_name} gender={patient.gender} size="lg" />
              <div className="text-sm">
                <div className="font-semibold">{patient.full_name}</div>
                <div className="text-stone-450">{ageOf(patient.birth_date) ?? '—'} {d.cl.f.years} · {d.cl.gender[patient.gender]}</div>
              </div>
            </div>
            <div className="divide-y divide-sand-100">
              <KeyValue label={d.cl.f.bloodType}>{patient.blood_type ?? '—'}</KeyValue>
              <KeyValue label={d.cl.f.insurance}>{ins ? <span className="inline-flex items-center gap-1 text-teal-800"><ShieldPlus className="h-3.5 w-3.5" />{locale === 'ar' ? ins.name_ar : ins.name_en ?? ins.name_ar}</span> : d.cl.payer.self}</KeyValue>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-brand">{k.editAlerts}</summary>
              <div className="mt-3"><AlertsForm patientId={patient.id} allergies={patient.allergies} chronic={patient.chronic_conditions} meds={patient.current_medications} /></div>
            </details>
          </Card>
          <Card>
            <CardHeader title={k.previousVisits} />
            {!prev?.length ? <EmptyState title={d.cl.rec.noVisits} /> : (
              <ul className="divide-y divide-sand-100">
                {(prev as unknown as Prev[]).map((x) => (
                  <li key={x.id}>
                    <Link href={`/doctor/patients/${patient.id}#v-${x.id}`} className="block px-5 py-3 text-sm hover:bg-sand-50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{x.diagnosis ?? '—'}</span>
                        {x.icd10_code && <span className="font-mono text-xs text-stone-450" dir="ltr">{x.icd10_code}</span>}
                      </div>
                      <div className="text-xs text-stone-450">{fmtDate(x.created_at, locale)} · {x.clinics ? (locale === 'ar' ? x.clinics.name_ar : x.clinics.name_en) : ''} · {x.doctors ? (locale === 'ar' ? x.doctors.full_name_ar : x.doctors.full_name_en ?? x.doctors.full_name_ar) : ''}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
