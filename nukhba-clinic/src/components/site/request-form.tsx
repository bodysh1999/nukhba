'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ActionForm, SubmitButton, useI18n } from '../client';
import { Field, Input, Select, Textarea } from '../ui';
import { submitBookingRequest } from '@/app/actions/clinic';

type Opt = { id: string; name_ar: string; name_en: string };
type Doc = { id: string; clinic_id: string; full_name_ar: string; full_name_en: string | null };

/** Visitor booking request (no account) → reception calls back */
export function BookingRequestForm({ clinics, doctors, insurers, initialDoctor, initialClinic }: {
  clinics: Opt[]; doctors: Doc[]; insurers: { id: string; name_ar: string; name_en: string | null }[]; initialDoctor?: string | null; initialClinic?: string | null;
}) {
  const { d, locale } = useI18n();
  const t = d.cl.site;
  const L = locale === 'ar';
  const start = doctors.find((x) => x.id === initialDoctor);
  const [clinic, setClinic] = useState(start?.clinic_id ?? initialClinic ?? '');
  const [done, setDone] = useState<string | null>(null);
  const tomorrow = new Date(Date.now() + 3 * 3600e3 + 86400e3).toISOString().slice(0, 10);
  if (done) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <p className="mt-4 text-lg font-semibold text-emerald-900">{done}</p>
        <button type="button" onClick={() => setDone(null)} className="mt-4 text-sm text-brand hover:underline">{d.cl.book.bookAnother}</button>
      </div>
    );
  }
  return (
    <ActionForm action={submitBookingRequest} onSuccess={(r) => setDone(r?.message ?? '')} className="space-y-4">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={d.cl.f.clinic} required>
          <Select name="clinic_id" required value={clinic} onChange={(e) => setClinic(e.target.value)}>
            <option value="" disabled>{d.cl.book.chooseClinic}</option>
            {clinics.map((c) => <option key={c.id} value={c.id}>{L ? c.name_ar : c.name_en}</option>)}
          </Select>
        </Field>
        <Field label={d.cl.f.doctor}>
          <Select name="doctor_id" defaultValue={start?.id ?? ''} key={clinic}>
            <option value="">{d.cl.f.allDoctors}</option>
            {doctors.filter((x) => !clinic || x.clinic_id === clinic).map((x) => <option key={x.id} value={x.id}>{!L && x.full_name_en ? x.full_name_en : x.full_name_ar}</option>)}
          </Select>
        </Field>
        <Field label={t.preferredDate}><Input name="preferred_date" type="date" min={tomorrow} defaultValue={tomorrow} /></Field>
        <Field label={t.preferredTime}>
          <Select name="preferred_time" defaultValue="any">
            {(['any', 'morning', 'afternoon', 'evening'] as const).map((k) => <option key={k} value={k}>{d.cl.desk.time[k]}</option>)}
          </Select>
        </Field>
        <Field label={d.cl.f.patient} required><Input name="full_name" required autoComplete="name" /></Field>
        <Field label={d.cl.f.phone} required><Input name="phone" type="tel" required autoComplete="tel" placeholder="05xxxxxxxx" /></Field>
        <Field label={t.insuranceOpt}>
          <Input name="insurance" list="ins-list" />
          <datalist id="ins-list">{insurers.map((i) => <option key={i.id} value={L ? i.name_ar : i.name_en ?? i.name_ar} />)}</datalist>
        </Field>
        <Field label={d.cl.f.email}><Input name="email" type="email" autoComplete="email" /></Field>
      </div>
      <Field label={t.messageOpt}><Textarea name="message" className="min-h-[72px]" /></Field>
      <label className="flex items-start gap-2 text-sm text-ink/80">
        <input type="checkbox" name="consent" required className="mt-1 h-4 w-4 rounded border-sand-300 text-brand" />
        <span>{t.consent} — <Link href="/privacy" target="_blank" className="text-brand underline">{L ? 'سياسة الخصوصية' : 'Privacy policy'}</Link></span>
      </label>
      <SubmitButton size="lg" variant="accent" className="w-full sm:w-auto">{t.send}</SubmitButton>
    </ActionForm>
  );
}
