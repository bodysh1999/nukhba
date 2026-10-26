'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { TempPassword } from '@/components/forms-kit';
import { CLINIC_ICONS, ClinicIcon } from '@/components/clinic-ui';
import { Field, Input, Select, Textarea, cx } from '@/components/ui';
import { addShift, createDoctorLogin, removeShift, saveClinic, saveDoctor } from '@/app/actions/admin';
import { addTimeOff, removeTimeOff } from '@/app/actions/clinic';
import { WEEKDAYS } from '@/lib/constants';
import type { Clinic, Doctor } from '@/lib/types';

const check = 'h-4 w-4 rounded border-sand-300 text-brand focus:ring-brand';

export function ClinicForm({ clinic }: { clinic?: Clinic }) {
  const { d } = useI18n();
  const a = d.cl.adm;
  const [icon, setIcon] = useState(clinic?.icon ?? 'stethoscope');
  return (
    <ActionForm action={saveClinic} resetOnSuccess={!clinic} className="space-y-4">
      {clinic && <input type="hidden" name="id" value={clinic.id} />}
      <input type="hidden" name="icon" value={icon} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={a.nameAr} required><Input name="name_ar" required defaultValue={clinic?.name_ar} /></Field>
        <Field label={a.nameEn} required><Input name="name_en" dir="ltr" required defaultValue={clinic?.name_en} /></Field>
        <Field label={a.code} required><Input name="code" dir="ltr" required pattern="[a-z0-9_\-]{2,30}" defaultValue={clinic?.code} placeholder="dental" /></Field>
        <Field label={a.locationAr}><Input name="location_ar" defaultValue={clinic?.location_ar ?? ''} /></Field>
        <Field label={`${a.locationAr} (EN)`}><Input name="location_en" dir="ltr" defaultValue={clinic?.location_en ?? ''} /></Field>
        <Field label={a.sort}><Input name="sort" type="number" defaultValue={clinic?.sort ?? 0} /></Field>
      </div>
      <Field label={a.icon}>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(CLINIC_ICONS).map((k) => (
            <button key={k} type="button" onClick={() => setIcon(k)} aria-label={k}
              className={cx('grid h-10 w-10 place-items-center rounded-xl border', icon === k ? 'border-brand bg-brand text-white' : 'border-sand-200 text-ink/70 hover:border-brand/40')}>
              <ClinicIcon name={k} className="h-5 w-5" />
            </button>
          ))}
        </div>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={a.descAr}><Textarea name="description_ar" defaultValue={clinic?.description_ar ?? ''} className="min-h-[64px]" /></Field>
        <Field label={a.descEn}><Textarea name="description_en" dir="ltr" defaultValue={clinic?.description_en ?? ''} className="min-h-[64px]" /></Field>
      </div>
      {clinic && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={clinic.is_active} className={check} />{a.active}</label>}
      <SubmitButton>{d.common.save}</SubmitButton>
    </ActionForm>
  );
}

export function DoctorForm({ doctor, clinics }: { doctor?: Doctor; clinics: Clinic[] }) {
  const { d, locale } = useI18n();
  const a = d.cl.adm;
  return (
    <ActionForm action={saveDoctor} resetOnSuccess={!doctor} className="space-y-4">
      {doctor && <input type="hidden" name="id" value={doctor.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={`${d.common.name} (AR)`} required><Input name="full_name_ar" required defaultValue={doctor?.full_name_ar} placeholder="د. " /></Field>
        <Field label={`${d.common.name} (EN)`}><Input name="full_name_en" dir="ltr" defaultValue={doctor?.full_name_en ?? ''} placeholder="Dr. " /></Field>
        <Field label={d.cl.f.clinic} required>
          <Select name="clinic_id" required defaultValue={doctor?.clinic_id ?? ''}>
            <option value="" disabled>—</option>
            {clinics.map((c) => <option key={c.id} value={c.id}>{locale === 'ar' ? c.name_ar : c.name_en}</option>)}
          </Select>
        </Field>
        <Field label={d.cl.f.type}>
          <Select name="title" defaultValue={doctor?.title ?? 'specialist'}>
            {(['consultant', 'specialist', 'resident', 'gp'] as const).map((t) => <option key={t} value={t}>{d.cl.title[t]}</option>)}
          </Select>
        </Field>
        <Field label={d.cl.f.gender}>
          <Select name="gender" defaultValue={doctor?.gender ?? 'male'}><option value="male">{d.cl.gender.male}</option><option value="female">{d.cl.gender.female}</option></Select>
        </Field>
        <Field label={a.scfhs}><Input name="scfhs_no" dir="ltr" defaultValue={doctor?.scfhs_no ?? ''} /></Field>
        <Field label={a.specialtyAr}><Input name="specialty_ar" defaultValue={doctor?.specialty_ar ?? ''} /></Field>
        <Field label={a.specialtyEn}><Input name="specialty_en" dir="ltr" defaultValue={doctor?.specialty_en ?? ''} /></Field>
        <Field label={d.cl.f.languages}><Input name="languages" dir="ltr" defaultValue={(doctor?.languages ?? ['ar', 'en']).join(', ')} /></Field>
        <Field label={d.cl.f.fee}><Input name="consultation_fee" type="number" min="0" step="1" defaultValue={doctor?.consultation_fee ?? 250} /></Field>
        <Field label={d.cl.f.followFee}><Input name="follow_up_fee" type="number" min="0" step="1" defaultValue={doctor?.follow_up_fee ?? 125} /></Field>
        <Field label={a.slot}><Input name="slot_minutes" type="number" min="5" max="120" step="5" defaultValue={doctor?.slot_minutes ?? 20} /></Field>
        <Field label={d.cl.f.qualifications}><Input name="qualifications" defaultValue={doctor?.qualifications ?? ''} /></Field>
        <Field label={d.cl.f.experience.replace('{n} ', '')}><Input name="years_experience" type="number" min="0" max="70" defaultValue={doctor?.years_experience ?? ''} /></Field>
        <Field label={a.photo}><Input name="photo_url" dir="ltr" type="url" defaultValue={doctor?.photo_url ?? ''} placeholder="https://" /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={a.bioAr}><Textarea name="bio_ar" defaultValue={doctor?.bio_ar ?? ''} className="min-h-[64px]" /></Field>
        <Field label={a.bioEn}><Textarea name="bio_en" dir="ltr" defaultValue={doctor?.bio_en ?? ''} className="min-h-[64px]" /></Field>
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="accepts_online" defaultChecked={doctor?.accepts_online ?? true} className={check} />{a.acceptsOnline}</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="show_public" defaultChecked={doctor?.show_public ?? true} className={check} />{a.showPublic}</label>
        {doctor && <label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked={doctor.is_active} className={check} />{d.common.active}</label>}
      </div>
      <SubmitButton>{d.common.save}</SubmitButton>
    </ActionForm>
  );
}

export function ShiftEditor({ doctorId, shifts }: { doctorId: string; shifts: { id: string; weekday: number; start_time: string; end_time: string }[] }) {
  const { d } = useI18n();
  const a = d.cl.adm;
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-sand-100 rounded-xl border border-sand-200">
        {WEEKDAYS.map((w) => {
          const list = shifts.filter((s) => s.weekday === w);
          return (
            <li key={w} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
              <span className="w-24 font-medium">{d.cl.weekday[w]}</span>
              {list.length === 0 && <span className="text-stone-450">—</span>}
              {list.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1.5 rounded-lg bg-brand/[.06] px-2 py-1 text-xs font-medium text-brand" dir="ltr">
                  {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                  <button type="button" disabled={pending} onClick={() => start(() => removeShift(s.id))} aria-label={d.common.delete} className="text-brand/60 hover:text-rose-600"><Trash2 className="h-3 w-3" /></button>
                </span>
              ))}
            </li>
          );
        })}
      </ul>
      <ActionForm action={addShift} className="space-y-3 rounded-xl bg-sand-50 p-3">
        <input type="hidden" name="doctor_id" value={doctorId} />
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((w) => (
            <label key={w} className="cursor-pointer">
              <input type="checkbox" name="weekday" value={w} className="peer sr-only" defaultChecked={w !== 5} />
              <span className="inline-flex h-8 items-center rounded-full border border-sand-300 bg-white px-3 text-xs peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white">{d.cl.weekday[w]}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label={a.from}><Input name="start_time" type="time" defaultValue="16:00" required className="w-32" /></Field>
          <Field label={a.to}><Input name="end_time" type="time" defaultValue="22:00" required className="w-32" /></Field>
          <SubmitButton>{a.addShift}</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}

export function TimeOffEditor({ doctorId, items }: { doctorId: string; items: { id: string; from_date: string; to_date: string; reason: string | null }[] }) {
  const { d } = useI18n();
  const a = d.cl.adm;
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      {items.map((t) => (
        <div key={t.id} className="flex items-center gap-2 rounded-xl border border-sand-200 px-3 py-2 text-sm">
          <span dir="ltr">{t.from_date} → {t.to_date}</span>
          {t.reason && <span className="text-stone-450">· {t.reason}</span>}
          <button type="button" disabled={pending} onClick={() => start(() => removeTimeOff(t.id))} className="ms-auto text-stone-450 hover:text-rose-600" aria-label={d.common.delete}><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <ActionForm action={addTimeOff} resetOnSuccess className="flex flex-wrap items-end gap-2 rounded-xl bg-sand-50 p-3">
        <input type="hidden" name="doctor_id" value={doctorId} />
        <Field label={a.from}><Input name="from_date" type="date" required /></Field>
        <Field label={a.to}><Input name="to_date" type="date" required /></Field>
        <Field label={d.cl.f.reason} className="min-w-0 flex-1"><Input name="reason" /></Field>
        <SubmitButton>{a.addTimeOff}</SubmitButton>
      </ActionForm>
    </div>
  );
}

export function DoctorLogin({ doctorId }: { doctorId: string }) {
  const { d } = useI18n();
  return (
    <ActionForm action={createDoctorLogin}>
      {(state) => (
        <div className="space-y-2">
          <input type="hidden" name="doctor_id" value={doctorId} />
          <Input name="email" type="email" required placeholder={d.cl.f.email} />
          <SubmitButton size="sm" variant="outline" className="w-full">{d.cl.adm.createLogin}</SubmitButton>
          {state?.data?.password ? <TempPassword email={String(state.data.email)} password={String(state.data.password)} /> : null}
        </div>
      )}
    </ActionForm>
  );
}
