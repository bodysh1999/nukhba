'use client';

import { useRef, useState, useTransition } from 'react';
import { Loader2, Paperclip, Pill, Plus, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { Field, Input, Select, Textarea, buttonClass, cx } from '@/components/ui';
import {
  addRx, cancelTest, issueDocument, orderTest, recordResult, removeRx, reopenVisit, revokeDocument, saveVisit, startConsultation, updateAlerts,
} from '@/app/actions/doctor';
import { registerPatientFile } from '@/app/actions/common';
import { ICD10_COMMON, RX_FREQ_AR, RX_FREQ_EN, bmiOf } from '@/lib/constants';
import { prepareImage } from '@/lib/image';
import type { DocKind, Service, Visit } from '@/lib/types';

export function CallPatient({ id, primary = true }: { id: string; primary?: boolean }) {
  const { d } = useI18n();
  return (
    <ActionForm action={startConsultation}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton size="sm" variant={primary ? 'accent' : 'outline'}>{d.cl.dr.call}</SubmitButton>
    </ActionForm>
  );
}

/** The consultation note. Save keeps it open; "finish & sign" closes the visit (and the appointment). */
export function EncounterForm({ visit, privateNote }: { visit: Visit; privateNote: string }) {
  const { d, locale } = useI18n();
  const k = d.cl.dr;
  const r = d.cl.rec;
  const [w, setW] = useState<number | null>(visit.weight_kg);
  const [h, setH] = useState<number | null>(visit.height_cm);
  const bmi = bmiOf(w, h);
  const num = (name: keyof Visit, label: string, unit: string, step = '1') => (
    <Field label={<>{label} <span className="text-stone-450">({unit})</span></>}>
      <Input name={name} type="number" inputMode="decimal" step={step} defaultValue={(visit[name] as number | null) ?? ''}
        onChange={name === 'weight_kg' ? (e) => setW(Number(e.target.value) || null) : name === 'height_cm' ? (e) => setH(Number(e.target.value) || null) : undefined} />
    </Field>
  );
  return (
    <ActionForm action={saveVisit} className="space-y-6">
      <input type="hidden" name="id" value={visit.id} />
      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink/80">{k.vitals}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label={<>{r.bp} <span className="text-stone-450">(mmHg)</span></>}>
            <div className="flex items-center gap-1" dir="ltr">
              <Input name="bp_systolic" type="number" inputMode="numeric" defaultValue={visit.bp_systolic ?? ''} placeholder="120" />
              <span className="text-stone-450">/</span>
              <Input name="bp_diastolic" type="number" inputMode="numeric" defaultValue={visit.bp_diastolic ?? ''} placeholder="80" />
            </div>
          </Field>
          {num('pulse', r.pulse, 'bpm')}
          {num('temperature', r.temp, '°C', '0.1')}
          {num('spo2', r.spo2, '%')}
          {num('resp_rate', r.rr, '/min')}
          {num('weight_kg', r.weight, 'kg', '0.1')}
          {num('height_cm', r.height, 'cm', '0.1')}
          <div className="rounded-xl bg-sand-50 px-3 py-2">
            <div className="text-[13px] text-ink/70">{r.bmi}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{bmi ?? '—'}</div>
          </div>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={k.complaint}><Textarea name="chief_complaint" defaultValue={visit.chief_complaint ?? ''} className="min-h-[72px]" /></Field>
        <Field label={k.history}><Textarea name="history" defaultValue={visit.history ?? ''} className="min-h-[72px]" /></Field>
      </div>
      <Field label={k.exam}><Textarea name="examination" defaultValue={visit.examination ?? ''} className="min-h-[72px]" /></Field>
      <div className="grid gap-4 md:grid-cols-[1fr_180px]">
        <Field label={k.diagnosis} required><Input name="diagnosis" list="dx-list" defaultValue={visit.diagnosis ?? ''} /></Field>
        <Field label={k.icd}><Input name="icd10_code" dir="ltr" list="icd-list" defaultValue={visit.icd10_code ?? ''} placeholder="J02.9" /></Field>
        <datalist id="dx-list">{ICD10_COMMON.map(([c, ar, en]) => <option key={c} value={locale === 'ar' ? ar : en} />)}</datalist>
        <datalist id="icd-list">{ICD10_COMMON.map(([c, ar, en]) => <option key={c} value={c}>{locale === 'ar' ? ar : en}</option>)}</datalist>
      </div>
      <Field label={k.plan}><Textarea name="plan" defaultValue={visit.plan ?? ''} className="min-h-[72px]" /></Field>
      <div className="grid gap-4 md:grid-cols-[1fr_200px]">
        <Field label={k.advice}><Textarea name="patient_advice" defaultValue={visit.patient_advice ?? ''} className="min-h-[72px]" /></Field>
        <Field label={k.followUp}>
          <Select name="follow_up_in_days" defaultValue={visit.follow_up_in_days ?? ''}>
            <option value="">—</option>{[3, 7, 14, 30, 60, 90, 180].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </Field>
      </div>
      <Field label={k.privateNote}><Textarea name="private_note" defaultValue={privateNote} className="min-h-[56px] border-dashed" /></Field>
      <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 -mx-5 flex flex-wrap gap-2 border-t border-sand-100 bg-white/95 px-5 py-3 backdrop-blur lg:bottom-0">
        <SubmitButton variant="outline">{k.save}</SubmitButton>
        <SubmitButton name="then" value="sign" variant="accent" confirmText={k.signConfirm}>{k.sign}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function RxPad({ visitId, editable, items }: { visitId: string; editable: boolean; items: { id: string; drug_name: string; dose: string | null; frequency: string | null; duration: string | null; instructions: string | null }[] }) {
  const { d, locale } = useI18n();
  const r = d.cl.rec;
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <ul className="divide-y divide-sand-100 rounded-xl border border-sand-200">
          {items.map((x) => (
            <li key={x.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
              <Pill className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <div className="min-w-0 flex-1">
                <div className="font-medium" dir="ltr">{x.drug_name}</div>
                <div className="text-xs text-stone-450">{[x.dose, x.frequency, x.duration].filter(Boolean).join(' · ')}{x.instructions ? ` — ${x.instructions}` : ''}</div>
              </div>
              {editable && (
                <button type="button" disabled={pending} onClick={() => start(() => removeRx(x.id))} aria-label={d.common.delete} className="text-stone-450 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <ActionForm action={addRx} resetOnSuccess className="grid gap-2 rounded-xl bg-sand-50 p-3 sm:grid-cols-[2fr_1fr_1.3fr_1fr_auto] sm:items-end">
          <input type="hidden" name="visit_id" value={visitId} />
          <Field label={r.drug}><Input name="drug_name" required dir="ltr" placeholder="Paracetamol 500mg" /></Field>
          <Field label={r.dose}><Input name="dose" /></Field>
          <Field label={r.freq}>
            <Input name="frequency" list="freq-list" />
            <datalist id="freq-list">{(locale === 'ar' ? RX_FREQ_AR : RX_FREQ_EN).map((f) => <option key={f} value={f} />)}</datalist>
          </Field>
          <Field label={r.duration}><Input name="duration" /></Field>
          <SubmitButton size="md" variant="primary"><Plus className="h-4 w-4" /><span className="sm:sr-only">{d.cl.dr.addDrug}</span></SubmitButton>
          <Input name="instructions" placeholder={r.instructions} className="sm:col-span-5" />
        </ActionForm>
      )}
    </div>
  );
}

export function OrderTests({ visitId, services }: { visitId: string; services: Pick<Service, 'id' | 'name_ar' | 'name_en' | 'kind' | 'price'>[] }) {
  const { d, locale } = useI18n();
  const [other, setOther] = useState(false);
  return (
    <ActionForm action={orderTest} resetOnSuccess className="flex flex-wrap items-end gap-2 rounded-xl bg-sand-50 p-3">
      <input type="hidden" name="visit_id" value={visitId} />
      {!other ? (
        <Field label={d.cl.dr.orderTest} className="min-w-0 flex-1">
          <Select name="service_id" required defaultValue="">
            <option value="" disabled>—</option>
            {(['lab', 'radiology'] as const).map((kind) => (
              <optgroup key={kind} label={d.cl.testKind[kind]}>
                {services.filter((s) => s.kind === kind).map((s) => <option key={s.id} value={s.id}>{locale === 'ar' ? s.name_ar : s.name_en ?? s.name_ar} · {s.price} {d.common.sar}</option>)}
              </optgroup>
            ))}
          </Select>
        </Field>
      ) : (
        <Field label={d.cl.dr.otherTest} className="min-w-0 flex-1"><Input name="test_name" required /></Field>
      )}
      <SubmitButton><Plus className="h-4 w-4" />{d.common.add}</SubmitButton>
      <button type="button" onClick={() => setOther(!other)} className={buttonClass('ghost', 'md')}>{other ? d.cl.dr.orderTest : d.cl.dr.otherTest}</button>
    </ActionForm>
  );
}

export function CancelTestButton({ id }: { id: string }) {
  const { d } = useI18n();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => { await cancelTest(id); })} className="text-stone-450 hover:text-rose-600" aria-label={d.common.cancel}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
    </button>
  );
}

/** Result entry with an optional file (uploaded straight to the patient's private folder) */
export function ResultForm({ orderId, patientId, visitId }: { orderId: string; patientId: string; visitId: string }) {
  const { d } = useI18n();
  const k = d.cl.dr;
  const [path, setPath] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const upload = async (f: File) => {
    setBusy(true); setErr(null);
    try {
      const file = await prepareImage(f);
      if (file.size > 25 * 1024 * 1024) throw new Error(d.errors.FILE_TOO_LARGE);
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
      const p = `${patientId}/${crypto.randomUUID()}.${ext}`;
      const sb = createClient();
      const { error } = await sb.storage.from('medical').upload(p, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
      const res = await registerPatientFile({ patient_id: patientId, visit_id: visitId, lab_order_id: orderId, storage_path: p, file_name: file.name.slice(0, 180), mime_type: file.type, size_bytes: file.size });
      if (res.error) throw new Error(res.error);
      setPath(p); setFileName(file.name);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  return (
    <ActionForm action={recordResult} className="mt-2 grid gap-2 rounded-xl bg-sand-50 p-3 sm:grid-cols-[1fr_140px_auto] sm:items-start">
      <input type="hidden" name="id" value={orderId} />
      <input type="hidden" name="result_file" value={path} />
      <Textarea name="result_text" placeholder={k.resultText} className="min-h-[44px]" />
      <Select name="result_flag" defaultValue="normal">
        {(['normal', 'abnormal', 'critical'] as const).map((f) => <option key={f} value={f}>{d.cl.flag[f]}</option>)}
      </Select>
      <div className="flex gap-2">
        <button type="button" onClick={() => input.current?.click()} className={buttonClass('outline', 'md', 'px-3')} title={k.attachResult}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </button>
        <SubmitButton>{d.common.save}</SubmitButton>
      </div>
      <input ref={input} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      {(fileName || err) && <p className={cx('text-xs sm:col-span-3', err ? 'text-rose-700' : 'text-emerald-700')}>{err ?? `✓ ${fileName}`}</p>}
    </ActionForm>
  );
}

export function IssueDocForm({ visitId, today }: { visitId: string; today: string }) {
  const { d } = useI18n();
  const k = d.cl.dr;
  const [kind, setKind] = useState<DocKind>('sick_leave');
  return (
    <ActionForm action={issueDocument} resetOnSuccess className="space-y-3 rounded-xl bg-sand-50 p-3">
      <input type="hidden" name="visit_id" value={visitId} />
      <input type="hidden" name="kind" value={kind} />
      <div className="flex flex-wrap gap-1.5">
        {(['sick_leave', 'medical_report', 'referral'] as const).map((x) => (
          <button key={x} type="button" onClick={() => setKind(x)} className={cx('h-8 rounded-full border px-3 text-xs', kind === x ? 'border-brand bg-brand text-white' : 'border-sand-300 bg-white')}>{d.cl.docKind[x]}</button>
        ))}
      </div>
      {kind === 'sick_leave' ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label={k.sickFrom}><Input name="from_date" type="date" defaultValue={today} required /></Field>
          <Field label={k.sickTo}><Input name="to_date" type="date" defaultValue={today} required /></Field>
        </div>
      ) : (
        <>
          {kind === 'referral' && <Field label={k.referralTo}><Input name="referral_to" required /></Field>}
          <Field label={k.reportBody}><Textarea name="body" required /></Field>
        </>
      )}
      <SubmitButton size="sm">{k.issueDoc}</SubmitButton>
    </ActionForm>
  );
}

export function RevokeDoc({ id }: { id: string }) {
  const { d } = useI18n();
  return (
    <ActionForm action={revokeDocument}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton size="sm" variant="ghost" className="text-rose-700" confirmText={d.cl.dr.revokeConfirm}>{d.cl.dr.revoke}</SubmitButton>
    </ActionForm>
  );
}

export function ReopenVisit({ id }: { id: string }) {
  const { d } = useI18n();
  return (
    <ActionForm action={reopenVisit} className="flex flex-wrap gap-2">
      <input type="hidden" name="id" value={id} />
      <Input name="reason" required placeholder={d.cl.dr.reopenReason} className="min-w-0 flex-1" />
      <SubmitButton variant="outline">{d.cl.dr.reopen}</SubmitButton>
    </ActionForm>
  );
}

export function AlertsForm({ patientId, allergies, chronic, meds }: { patientId: string; allergies: string | null; chronic: string | null; meds: string | null }) {
  const { d } = useI18n();
  const f = d.cl.f;
  return (
    <ActionForm action={updateAlerts} className="space-y-2">
      <input type="hidden" name="patient_id" value={patientId} />
      <Field label={f.allergies}><Input name="allergies" defaultValue={allergies ?? ''} /></Field>
      <Field label={f.chronic}><Input name="chronic_conditions" defaultValue={chronic ?? ''} /></Field>
      <Field label={f.meds}><Input name="current_medications" defaultValue={meds ?? ''} /></Field>
      <SubmitButton size="sm" variant="outline">{d.common.save}</SubmitButton>
    </ActionForm>
  );
}
