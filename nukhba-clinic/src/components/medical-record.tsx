import Link from 'next/link';
import { FileText, FlaskConical, Pill, Printer, Stethoscope } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import type { Dict } from '@/lib/i18n';
import { fmtDate } from '@/lib/format';
import { bmiOf } from '@/lib/constants';
import type { Locale, MedicalDoc, RxItem, TestOrder, Visit } from '@/lib/types';
import { ClinicIcon, FlagBadge, fmtDay } from './clinic-ui';
import { DocPreview } from './live';
import { Badge, Card, EmptyState, buttonClass, cx } from './ui';

type VisitRow = Visit & {
  doctors: { full_name_ar: string; full_name_en: string | null } | null;
  clinics: { name_ar: string; name_en: string; icon: string } | null;
};

/** Everything the caller may see of a patient's record (RLS: treating doctors, admin, the patient — signed visits only) */
export async function loadRecord(patientId: string) {
  const supabase = await createClient();
  const [{ data: visits }, { data: rx }, { data: tests }, { data: docs }, { data: files }] = await Promise.all([
    supabase.from('visits').select('*, doctors(full_name_ar, full_name_en), clinics(name_ar, name_en, icon)').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(60),
    supabase.from('prescription_items').select('*, visits!inner(patient_id)').eq('visits.patient_id', patientId),
    supabase.from('lab_orders').select('*').eq('patient_id', patientId).neq('status', 'cancelled').order('created_at', { ascending: false }),
    supabase.from('medical_documents').select('*, doctors(full_name_ar, full_name_en)').eq('patient_id', patientId).order('issued_at', { ascending: false }),
    supabase.from('patient_files').select('id, lab_order_id, storage_path, file_name, mime_type').eq('patient_id', patientId),
  ]);
  const signed: Record<string, string> = {};
  for (const f of files ?? []) {
    const { data } = await supabase.storage.from('medical').createSignedUrl(f.storage_path, 3600);
    if (data?.signedUrl && f.lab_order_id) signed[f.lab_order_id] = data.signedUrl;
  }
  return {
    visits: (visits ?? []) as VisitRow[],
    rx: (rx ?? []) as RxItem[],
    tests: (tests ?? []) as TestOrder[],
    docs: (docs ?? []) as (MedicalDoc & { doctors: { full_name_ar: string; full_name_en: string | null } | null })[],
    fileUrl: signed,
  };
}
export type RecordData = Awaited<ReturnType<typeof loadRecord>>;

export function VisitsTimeline({ data, d, locale, audience }: { data: RecordData; d: Dict; locale: Locale; audience: 'doctor' | 'patient' }) {
  const r = d.cl.rec;
  if (!data.visits.length) return <Card><EmptyState icon={<Stethoscope className="h-5 w-5" />} title={r.noVisits} /></Card>;
  return (
    <ol className="relative space-y-4 border-s-2 border-sand-200 ps-5">
      {data.visits.map((v) => {
        const items = data.rx.filter((x) => x.visit_id === v.id);
        const tests = data.tests.filter((t) => t.visit_id === v.id);
        const bmi = bmiOf(v.weight_kg, v.height_cm);
        return (
          <li key={v.id} id={`v-${v.id}`} className="relative scroll-mt-24">
            <span className="absolute -start-[29px] top-5 grid h-6 w-6 place-items-center rounded-full bg-white ring-2 ring-brand/30">
              <ClinicIcon name={v.clinics?.icon} className="h-3.5 w-3.5 text-brand" />
            </span>
            <Card className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-stone-450">{fmtDay(v.created_at, locale, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  <div className="mt-0.5 font-semibold">{v.diagnosis ?? (v.status === 'open' ? d.cl.status.in_consultation : '—')}{v.icd10_code && <span className="ms-2 font-mono text-xs font-normal text-stone-450" dir="ltr">{v.icd10_code}</span>}</div>
                  <div className="text-xs text-stone-450">
                    {v.clinics ? (locale === 'ar' ? v.clinics.name_ar : v.clinics.name_en) : ''} · {v.doctors ? (locale === 'ar' ? v.doctors.full_name_ar : v.doctors.full_name_en ?? v.doctors.full_name_ar) : ''}
                  </div>
                </div>
                <div className="flex gap-1">
                  {audience === 'doctor' && <Link href={`/doctor/visits/${v.id}`} className={buttonClass('ghost', 'sm')}>{d.cl.f.open}</Link>}
                  {v.status === 'signed' && <Link href={`/print/visit/${v.id}`} target="_blank" className={buttonClass('ghost', 'sm')}><Printer className="h-3.5 w-3.5" />{audience === 'patient' ? r.printRx : ''}</Link>}
                </div>
              </div>
              {(v.bp_systolic || v.pulse || v.temperature || v.weight_kg) && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {v.bp_systolic && <span className="rounded-lg bg-sand-50 px-2 py-1">{r.bp} <b dir="ltr">{v.bp_systolic}/{v.bp_diastolic}</b></span>}
                  {v.pulse && <span className="rounded-lg bg-sand-50 px-2 py-1">{r.pulse} <b>{v.pulse}</b></span>}
                  {v.temperature && <span className="rounded-lg bg-sand-50 px-2 py-1">{r.temp} <b>{v.temperature}°</b></span>}
                  {v.weight_kg && <span className="rounded-lg bg-sand-50 px-2 py-1">{r.weight} <b>{v.weight_kg}</b></span>}
                  {bmi && <span className="rounded-lg bg-sand-50 px-2 py-1">{r.bmi} <b>{bmi}</b></span>}
                </div>
              )}
              {audience === 'doctor' && v.chief_complaint && <p className="mt-3 text-sm text-ink/80">{v.chief_complaint}</p>}
              {v.patient_advice && (
                <div className="mt-3 rounded-xl bg-brand/[.04] p-3 text-sm">
                  <div className="mb-0.5 text-xs font-medium text-brand">{r.advice}</div>
                  <p className="whitespace-pre-line text-ink/80">{v.patient_advice}</p>
                </div>
              )}
              {items.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-stone-450"><Pill className="h-3.5 w-3.5" />{r.prescription}</div>
                  <ul className="space-y-1 text-sm">
                    {items.map((x) => (
                      <li key={x.id}><span className="font-medium" dir="ltr">{x.drug_name}</span> <span className="text-stone-450">— {[x.dose, x.frequency, x.duration].filter(Boolean).join(' · ')}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              {tests.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {tests.map((t) => (
                    <span key={t.id} className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset',
                      t.status === 'resulted' ? (t.result_flag === 'normal' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-amber-200') : 'bg-sand-50 text-stone-450 ring-sand-200')}>
                      <FlaskConical className="h-3 w-3" />{t.test_name}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          </li>
        );
      })}
    </ol>
  );
}

export function ResultsList({ data, d, locale }: { data: RecordData; d: Dict; locale: Locale }) {
  const r = d.cl.rec;
  const list = data.tests;
  if (!list.length) return <Card><EmptyState icon={<FlaskConical className="h-5 w-5" />} title={r.noResults} /></Card>;
  return (
    <Card className="divide-y divide-sand-100">
      {list.map((t) => (
        <div key={t.id} className="px-4 py-3.5 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{t.test_name}</span>
            <Badge className="bg-sand-100 text-ink/70 ring-sand-200">{d.cl.testKind[t.kind]}</Badge>
            {t.status === 'resulted' ? <FlagBadge flag={t.result_flag} d={d} /> : <Badge className="bg-sky-50 text-sky-800 ring-sky-200">{d.cl.testStatus[t.status]}</Badge>}
            <span className="ms-auto text-xs text-stone-450">{fmtDate(t.resulted_at ?? t.created_at, locale)}</span>
          </div>
          {t.result_text && <p className="mt-1.5 text-sm text-ink/80">{t.result_text}</p>}
          {data.fileUrl[t.id] && <div className="mt-2"><DocPreview url={data.fileUrl[t.id]} title={t.test_name} mime={null} /></div>}
        </div>
      ))}
    </Card>
  );
}

export function DocumentsList({ data, d, locale }: { data: RecordData; d: Dict; locale: Locale }) {
  const r = d.cl.rec;
  if (!data.docs.length) return <Card><EmptyState icon={<FileText className="h-5 w-5" />} title={r.noDocs} /></Card>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {data.docs.map((m) => (
        <Card key={m.id} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold">{d.cl.docKind[m.kind]}</div>
              <div className="font-mono text-xs text-stone-450" dir="ltr">{m.ref_no}</div>
            </div>
            {m.revoked_at ? <Badge className="bg-rose-50 text-rose-700 ring-rose-200">{r.revoked}</Badge> : <Badge className="bg-emerald-50 text-emerald-800 ring-emerald-200">{r.validDoc}</Badge>}
          </div>
          <div className="mt-2 text-sm text-ink/80">
            {m.kind === 'sick_leave' && m.from_date && m.to_date
              ? <>{r.period.replace('{from}', fmtDate(m.from_date, locale)).replace('{to}', fmtDate(m.to_date, locale))} · {r.days.replace('{n}', String(Math.round((Date.parse(m.to_date) - Date.parse(m.from_date)) / 86400e3) + 1))}</>
              : m.referral_to ? <>{r.referralTo}: {m.referral_to}</> : fmtDate(m.issued_at, locale)}
          </div>
          <div className="mt-1 text-xs text-stone-450">{r.issuedBy}: {m.doctors ? (locale === 'ar' ? m.doctors.full_name_ar : m.doctors.full_name_en ?? m.doctors.full_name_ar) : ''}</div>
          {!m.revoked_at && <Link href={`/print/document/${m.id}`} target="_blank" className={buttonClass('outline', 'sm', 'mt-3')}><Printer className="h-3.5 w-3.5" />{d.cl.f.print}</Link>}
        </Card>
      ))}
    </div>
  );
}
