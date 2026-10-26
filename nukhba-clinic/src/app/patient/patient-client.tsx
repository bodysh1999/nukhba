'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { Field, Input, Textarea, buttonClass, cx } from '@/components/ui';
import { cancelAppointment, confirmAppointment, rateAppointment, updateMyContact } from '@/app/actions/clinic';
import type { Patient } from '@/lib/types';

export function ConfirmAppt({ id }: { id: string }) {
  const { d } = useI18n();
  return (
    <ActionForm action={confirmAppointment}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="accent">{d.cl.appt.confirm}</SubmitButton>
    </ActionForm>
  );
}

export function CancelAppt({ id }: { id: string }) {
  const { d } = useI18n();
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={buttonClass('ghost', 'md', 'text-rose-700')}>{d.cl.appt.cancel}</button>;
  return (
    <ActionForm action={cancelAppointment} className="w-full space-y-2 rounded-xl bg-rose-50 p-3">
      <input type="hidden" name="id" value={id} />
      <Input name="reason" placeholder={d.cl.appt.cancelReason} />
      <div className="flex gap-2">
        <SubmitButton variant="danger" size="sm">{d.cl.appt.cancel}</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass('ghost', 'sm')}>{d.common.back}</button>
      </div>
    </ActionForm>
  );
}

export function RateVisit({ id }: { id: string }) {
  const { d } = useI18n();
  const [score, setScore] = useState(0);
  return (
    <ActionForm action={rateAppointment} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="score" value={score} />
      <div className="flex gap-1.5" role="radiogroup" aria-label={d.cl.appt.rateTitle}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={score === i} onClick={() => setScore(i)} className="p-1">
            <Star className={cx('h-8 w-8 transition', i <= score ? 'fill-accent text-accent' : 'text-sand-300 hover:text-accent/60')} />
          </button>
        ))}
      </div>
      {score > 0 && <>
        <Textarea name="comment" placeholder={d.cl.appt.rateComment} className="min-h-[64px]" />
        <SubmitButton>{d.cl.appt.rateSend}</SubmitButton>
      </>}
    </ActionForm>
  );
}

export function ContactForm({ p }: { p: Patient }) {
  const { d } = useI18n();
  const f = d.cl.f;
  return (
    <ActionForm action={updateMyContact} className="grid gap-3 sm:grid-cols-2">
      <Field label={f.phone} required><Input name="phone" type="tel" required defaultValue={p.phone} /></Field>
      <Field label={f.email}><Input name="email" type="email" defaultValue={p.email ?? ''} /></Field>
      <Field label={f.city}><Input name="city" defaultValue={p.city ?? ''} /></Field>
      <div />
      <Field label={f.emergency}><Input name="emergency_name" defaultValue={p.emergency_name ?? ''} /></Field>
      <Field label={f.emergencyPhone}><Input name="emergency_phone" type="tel" defaultValue={p.emergency_phone ?? ''} /></Field>
      <div className="sm:col-span-2"><SubmitButton>{d.cl.profile.saveContact}</SubmitButton></div>
    </ActionForm>
  );
}
