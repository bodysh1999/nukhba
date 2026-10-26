'use client';

import { useState } from 'react';
import { DoorOpen, UserX, X } from 'lucide-react';
import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { TempPassword } from '@/components/forms-kit';
import { Field, Input, Select, Textarea, buttonClass } from '@/components/ui';
import {
  cancelAppointment, checkIn, createPatient, createPatientPortal, disablePatientPortal, handleBookingRequest, markNoShow, updatePatient,
} from '@/app/actions/clinic';
import { BLOOD_TYPES } from '@/lib/constants';
import type { AppointmentStatus, Insurer, Patient } from '@/lib/types';

/** Check-in / no-show / cancel on one appointment row */
export function DeskRowActions({ id, status, past }: { id: string; status: AppointmentStatus; past: boolean }) {
  const { d } = useI18n();
  const [cancel, setCancel] = useState(false);
  if (!['booked', 'confirmed', 'checked_in'].includes(status)) return null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {status !== 'checked_in' && (
        <ActionForm action={checkIn}>
          <input type="hidden" name="id" value={id} />
          <SubmitButton size="sm" variant="accent"><DoorOpen className="h-3.5 w-3.5" />{d.cl.desk.checkIn}</SubmitButton>
        </ActionForm>
      )}
      {status !== 'checked_in' && past && (
        <ActionForm action={markNoShow}>
          <input type="hidden" name="id" value={id} />
          <SubmitButton size="sm" variant="outline" confirmText={d.cl.desk.noShowBtn + '؟'}><UserX className="h-3.5 w-3.5" />{d.cl.desk.noShowBtn}</SubmitButton>
        </ActionForm>
      )}
      {!cancel ? (
        <button type="button" onClick={() => setCancel(true)} className={buttonClass('ghost', 'sm', 'text-rose-700')}>{d.cl.desk.cancelBtn}</button>
      ) : (
        <ActionForm action={cancelAppointment} className="flex w-full items-center gap-1.5 sm:w-auto">
          <input type="hidden" name="id" value={id} />
          <Input name="reason" required placeholder={d.cl.appt.cancelReason} className="h-8 min-w-0 flex-1 text-xs sm:w-44" autoFocus />
          <SubmitButton size="sm" variant="danger">{d.common.confirm}</SubmitButton>
          <button type="button" aria-label="close" onClick={() => setCancel(false)} className="text-stone-450"><X className="h-4 w-4" /></button>
        </ActionForm>
      )}
    </div>
  );
}

/** Create / edit a patient file */
export function PatientForm({ patient, insurers, then }: { patient?: Patient; insurers: Insurer[]; then?: string }) {
  const { d, locale } = useI18n();
  const f = d.cl.f;
  const [saudi, setSaudi] = useState(patient?.is_saudi ?? true);
  const [ins, setIns] = useState(patient?.insurance_company_id ?? '');
  return (
    <ActionForm action={patient ? updatePatient : createPatient} className="space-y-5">
      {patient && <input type="hidden" name="id" value={patient.id} />}
      {then && <input type="hidden" name="then" value={then} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={d.common.name} required><Input name="full_name" required defaultValue={patient?.full_name} /></Field>
        <Field label={`${d.common.name} (EN)`}><Input name="full_name_en" dir="ltr" defaultValue={patient?.full_name_en ?? ''} /></Field>
        <Field label={f.nationalId}><Input name="national_id" inputMode="numeric" dir="ltr" maxLength={10} defaultValue={patient?.national_id ?? ''} placeholder="1xxxxxxxxx" /></Field>
        <Field label={f.phone} required><Input name="phone" type="tel" required defaultValue={patient?.phone} placeholder="05xxxxxxxx" /></Field>
        <Field label={f.birthDate}><Input name="birth_date" type="date" defaultValue={patient?.birth_date ?? ''} /></Field>
        <Field label={f.gender}>
          <Select name="gender" defaultValue={patient?.gender ?? 'male'}>
            <option value="male">{d.cl.gender.male}</option><option value="female">{d.cl.gender.female}</option>
          </Select>
        </Field>
        <Field label={f.nationality}>
          <div className="flex gap-2">
            <Select name="is_saudi" value={saudi ? 'true' : 'false'} onChange={(e) => setSaudi(e.target.value === 'true')} className="w-36">
              <option value="true">{f.saudi}</option><option value="false">{f.nonSaudi}</option>
            </Select>
            {!saudi && <Input name="nationality" defaultValue={patient?.nationality ?? ''} placeholder={f.nationality} />}
          </div>
        </Field>
        <Field label={f.email}><Input name="email" type="email" defaultValue={patient?.email ?? ''} /></Field>
        <Field label={f.city}><Input name="city" defaultValue={patient?.city ?? (locale === 'ar' ? 'جدة' : 'Jeddah')} /></Field>
        <Field label={f.bloodType}>
          <Select name="blood_type" defaultValue={patient?.blood_type ?? ''}>
            <option value="">—</option>{BLOOD_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
        </Field>
      </div>

      <fieldset className="rounded-2xl border border-sand-200 p-4">
        <legend className="px-1 text-sm font-semibold">{f.insurance}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={f.insurer}>
            <Select name="insurance_company_id" value={ins} onChange={(e) => setIns(e.target.value)}>
              <option value="">{f.noInsurance}</option>
              {insurers.filter((i) => i.is_active || i.id === ins).map((i) => <option key={i.id} value={i.id}>{locale === 'ar' ? i.name_ar : i.name_en ?? i.name_ar}</option>)}
            </Select>
          </Field>
          {ins && <>
            <Field label={f.memberNo}><Input name="insurance_member_no" dir="ltr" defaultValue={patient?.insurance_member_no ?? ''} /></Field>
            <Field label={f.insClass}><Input name="insurance_class" defaultValue={patient?.insurance_class ?? ''} /></Field>
            <Field label={f.insExpiry}><Input name="insurance_expiry" type="date" defaultValue={patient?.insurance_expiry ?? ''} /></Field>
          </>}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={f.allergies}><Input name="allergies" defaultValue={patient?.allergies ?? ''} /></Field>
        <Field label={f.chronic}><Input name="chronic_conditions" defaultValue={patient?.chronic_conditions ?? ''} /></Field>
        <Field label={f.emergency}><Input name="emergency_name" defaultValue={patient?.emergency_name ?? ''} /></Field>
        <Field label={f.emergencyPhone}><Input name="emergency_phone" type="tel" defaultValue={patient?.emergency_phone ?? ''} /></Field>
      </div>
      <Field label={f.notes}><Textarea name="notes" defaultValue={patient?.notes ?? ''} className="min-h-[64px]" /></Field>
      <div className="flex flex-wrap gap-2">
        <SubmitButton>{patient ? d.common.save : then === 'book' ? d.cl.desk.createAndBook : d.cl.desk.newFile}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function PortalAccount({ patient }: { patient: Pick<Patient, 'id' | 'email' | 'account_status' | 'profile_id'> }) {
  const { d } = useI18n();
  const k = d.cl.desk;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-stone-450">{k.portalAccount}</span>
        <span className="font-medium">{patient.account_status === 'active' ? k.portalActive : patient.account_status === 'disabled' ? d.common.inactive : k.portalNone}</span>
      </div>
      {patient.account_status !== 'active' ? (
        <ActionForm action={createPatientPortal}>
          {(state) => (
            <>
              <input type="hidden" name="id" value={patient.id} />
              <SubmitButton size="sm" variant="outline" className="w-full">{k.createPortal}</SubmitButton>
              {!patient.email && <p className="mt-2 text-xs text-stone-450">{k.portalHint}</p>}
              {state?.data?.password ? <TempPassword email={String(state.data.email)} password={String(state.data.password)} /> : null}
            </>
          )}
        </ActionForm>
      ) : (
        <ActionForm action={disablePatientPortal}>
          <input type="hidden" name="id" value={patient.id} />
          <SubmitButton size="sm" variant="ghost" className="w-full text-rose-700" confirmText={k.disablePortal + '؟'}>{k.disablePortal}</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}

export function RequestActions({ id, status }: { id: string; status: string }) {
  const { d } = useI18n();
  const k = d.cl.desk;
  if (status === 'booked' || status === 'cancelled') return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {status === 'new' && (
        <ActionForm action={handleBookingRequest}>
          <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="contacted" />
          <SubmitButton size="sm" variant="outline">{k.markContacted}</SubmitButton>
        </ActionForm>
      )}
      <ActionForm action={handleBookingRequest}>
        <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="cancelled" />
        <SubmitButton size="sm" variant="ghost" confirmText={k.closeRequest + '؟'}>{k.closeRequest}</SubmitButton>
      </ActionForm>
    </div>
  );
}
