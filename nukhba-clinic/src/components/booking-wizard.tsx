'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CalendarCheck2, Check, Loader2, Moon, Sun } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { bookAppointment, linkBookingRequest, rescheduleAppointment } from '@/app/actions/clinic';
import { fmt } from '@/lib/i18n';
import type { BookingData } from '@/lib/clinic-data';
import { useI18n } from './client';
import { Avatar, ClinicIcon, fmtDay, fmtTime } from './clinic-ui';
import { buttonClass, cx, Textarea } from './ui';

type Slot = { starts_at: string; ends_at: string; is_free: boolean };
type Day = { day: string; free_slots: number };

export function BookingWizard({ data, mode, patientId, insuranceName, initialClinic, initialDoctor, appointmentId, backHref, requestId }: {
  data: BookingData; mode: 'patient' | 'staff' | 'reschedule'; patientId?: string; insuranceName?: string | null;
  initialClinic?: string | null; initialDoctor?: string | null; appointmentId?: string; backHref?: string; requestId?: string | null;
}) {
  const { d, locale } = useI18n();
  const b = d.cl.book;
  const router = useRouter();
  const L = locale === 'ar';
  const startDoctor = data.doctors.find((x) => x.id === initialDoctor);
  const [clinicId, setClinic] = useState<string | null>(startDoctor?.clinic_id ?? initialClinic ?? null);
  const [doctorId, setDoctor] = useState<string | null>(startDoctor?.id ?? null);
  const [days, setDays] = useState<Day[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [visitType, setVisitType] = useState<'new' | 'follow_up'>('new');
  const [reason, setReason] = useState('');
  const [source, setSource] = useState<'reception' | 'phone'>('reception');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; ref?: string } | null>(null);
  const [pending, start] = useTransition();

  const clinic = data.clinics.find((c) => c.id === clinicId) ?? null;
  const doctor = data.doctors.find((x) => x.id === doctorId) ?? null;
  const clinicDoctors = useMemo(() => data.doctors.filter((x) => x.clinic_id === clinicId), [data.doctors, clinicId]);
  const step = !clinic ? 1 : !doctor ? 2 : !slot ? 3 : 4;
  const name = (x: { full_name_ar: string; full_name_en: string | null }) => (!L && x.full_name_en ? x.full_name_en : x.full_name_ar);
  const cname = (x: { name_ar: string; name_en: string | null }) => (!L && x.name_en ? x.name_en : x.name_ar);
  const blockedOnline = mode === 'patient' && doctor && !doctor.accepts_online;

  // days with free times for the chosen doctor
  useEffect(() => {
    setDays(null); setDay(null); setSlots(null); setSlot(null);
    if (!doctorId || blockedOnline) return;
    const sb = createClient();
    sb.rpc('doctor_open_days', { p_doctor: doctorId, p_days: 21 }).then(({ data: rows }: { data: unknown }) => {
      const list = (rows ?? []) as Day[];
      setDays(list);
      const first = list.find((x) => x.free_slots > 0);
      if (first) setDay(first.day);
    });
  }, [doctorId, blockedOnline]);

  useEffect(() => {
    setSlots(null); setSlot(null);
    if (!doctorId || !day) return;
    const sb = createClient();
    sb.rpc('available_slots', { p_doctor: doctorId, p_date: day }).then(({ data: rows }: { data: unknown }) => setSlots(((rows ?? []) as Slot[]).filter((s) => s.is_free)));
  }, [doctorId, day]);

  const submit = () => {
    if (!doctor || !slot) return;
    setError(null);
    start(async () => {
      if (mode === 'reschedule' && appointmentId) {
        const r = await rescheduleAppointment({ id: appointmentId, starts_at: slot.starts_at, doctor: doctor.id });
        if (r.error) { setError(r.error); return; }
        router.push(backHref ?? '/');
        router.refresh();
        return;
      }
      const r = await bookAppointment({
        doctor: doctor.id, starts_at: slot.starts_at, patient: patientId ?? null, reason: reason || null, visit_type: visitType,
        source: mode === 'staff' ? source : null,
      });
      if (r.error) { setError(r.error); return; }
      if (requestId && r.id) await linkBookingRequest(requestId, r.id);
      setDone({ id: r.id!, ref: r.ref });
    });
  };

  if (done) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-card">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CalendarCheck2 className="h-8 w-8" /></div>
        <h2 className="mt-4 text-xl font-semibold">{mode === 'staff' ? fmt(d.cl.desk.staffBooked, { ref: done.ref }) : b.doneTitle}</h2>
        {mode === 'patient' && <p className="mt-2 text-sm text-stone-450">{b.doneBody}</p>}
        {doctor && slot && (
          <p className="mt-4 text-sm font-medium text-ink">{name(doctor)} · {fmtDay(slot.starts_at, locale)} · {fmtTime(slot.starts_at, locale)}</p>
        )}
        {done.ref && <p className="mt-1 font-mono text-xs text-stone-450" dir="ltr">{done.ref}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href={mode === 'staff' ? '/reception' : `/patient/appointments/${done.id}`} className={buttonClass('primary')}>{mode === 'staff' ? d.cl.desk.board : b.viewAppt}</Link>
          <button type="button" onClick={() => { setDone(null); setSlot(null); setReason(''); if (mode === 'staff') router.refresh(); }} className={buttonClass('outline')}>{b.bookAnother}</button>
        </div>
      </div>
    );
  }

  const steps = [b.stepClinic, b.stepDoctor, b.stepTime, b.stepConfirm];
  const Back = L ? ArrowRight : ArrowLeft;
  const morning = (slots ?? []).filter((s) => Number(fmtHour(s.starts_at)) < 12);
  const evening = (slots ?? []).filter((s) => Number(fmtHour(s.starts_at)) >= 12);

  return (
    <div className="space-y-5">
      {/* progress */}
      {mode !== 'reschedule' && (
        <ol className="flex items-center gap-2 text-xs sm:text-sm">
          {steps.map((s, i) => (
            <li key={s} className="flex min-w-0 flex-1 items-center gap-2">
              <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold',
                step > i + 1 ? 'bg-brand text-white' : step === i + 1 ? 'bg-accent text-white' : 'bg-sand-200 text-stone-450')}>
                {step > i + 1 ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={cx('truncate', step === i + 1 ? 'font-semibold text-ink' : 'text-stone-450')}>{s}</span>
              {i < 3 && <span className="hidden h-px flex-1 bg-sand-200 sm:block" />}
            </li>
          ))}
        </ol>
      )}

      {/* 1 — clinic */}
      {mode !== 'reschedule' && (
        <section className="rounded-2xl border border-sand-200 bg-white p-4 shadow-card sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">{clinic ? cname(clinic) : b.chooseClinic}</h3>
            {clinic && <button type="button" onClick={() => { setClinic(null); setDoctor(null); }} className="text-sm text-brand hover:underline">{b.change}</button>}
          </div>
          {!clinic && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {data.clinics.map((c) => {
                const n = data.doctors.filter((x) => x.clinic_id === c.id).length;
                return (
                  <button key={c.id} type="button" onClick={() => setClinic(c.id)} disabled={!n}
                    className="group flex flex-col items-start gap-2 rounded-xl border border-sand-200 p-3 text-start transition hover:border-brand/40 hover:bg-brand/[.03] disabled:opacity-40">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/[.07] text-brand group-hover:bg-brand group-hover:text-white"><ClinicIcon name={c.icon} className="h-5 w-5" /></span>
                    <span className="text-sm font-semibold">{cname(c)}</span>
                    <span className="text-xs text-stone-450">{n} {d.cl.f.doctors}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 2 — doctor */}
      {clinic && mode !== 'reschedule' && (
        <section className="rounded-2xl border border-sand-200 bg-white p-4 shadow-card sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">{doctor ? name(doctor) : b.chooseDoctor}</h3>
            {doctor && <button type="button" onClick={() => setDoctor(null)} className="text-sm text-brand hover:underline">{b.change}</button>}
          </div>
          {!doctor && (
            <div className="grid gap-2 sm:grid-cols-2">
              {clinicDoctors.map((x) => (
                <button key={x.id} type="button" onClick={() => setDoctor(x.id)}
                  className="flex items-center gap-3 rounded-xl border border-sand-200 p-3 text-start transition hover:border-brand/40 hover:bg-brand/[.03]">
                  <Avatar name={x.full_name_ar} gender={x.gender} photo={x.photo_url} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{name(x)}</span>
                    <span className="block truncate text-xs text-stone-450">{d.cl.title[x.title]}{(L ? x.specialty_ar : x.specialty_en) ? ` · ${L ? x.specialty_ar : x.specialty_en}` : ''}</span>
                  </span>
                  <span className="text-end text-xs">
                    <span className="block text-stone-450">{b.fee}</span>
                    <span className="font-semibold tabular-nums">{x.consultation_fee} {d.common.sar}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 3 — day & time */}
      {doctor && (
        <section className="rounded-2xl border border-sand-200 bg-white p-4 shadow-card sm:p-5">
          <h3 className="mb-3 font-semibold">{mode === 'reschedule' ? d.cl.appt.rescheduleTo : slot ? `${fmtDay(slot.starts_at, locale)} · ${fmtTime(slot.starts_at, locale)}` : b.chooseDay}</h3>
          {blockedOnline ? (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{b.offline}</p>
          ) : days === null ? (
            <div className="flex items-center gap-2 py-6 text-sm text-stone-450"><Loader2 className="h-4 w-4 animate-spin" />{d.common.loading}</div>
          ) : !days.some((x) => x.free_slots > 0) ? (
            <p className="py-6 text-center text-sm text-stone-450">{b.noDays}</p>
          ) : (
            <>
              <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {days.map((x) => {
                  const dt = new Date(`${x.day}T12:00:00+03:00`);
                  const on = x.day === day;
                  return (
                    <button key={x.day} type="button" disabled={!x.free_slots} onClick={() => setDay(x.day)}
                      className={cx('flex w-[68px] shrink-0 flex-col items-center rounded-xl border px-2 py-2 text-center transition disabled:opacity-35',
                        on ? 'border-brand bg-brand text-white' : 'border-sand-200 hover:border-brand/40')}>
                      <span className={cx('text-[11px]', on ? 'text-white/80' : 'text-stone-450')}>{fmtDay(dt, locale, { weekday: 'short' })}</span>
                      <span className="text-lg font-semibold leading-tight tabular-nums">{fmtDay(dt, locale, { day: 'numeric' })}</span>
                      <span className={cx('text-[10px]', on ? 'text-white/80' : 'text-stone-450')}>{fmtDay(dt, locale, { month: 'short' })}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4">
                {slots === null ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-stone-450"><Loader2 className="h-4 w-4 animate-spin" />{d.common.loading}</div>
                ) : slots.length === 0 ? (
                  <p className="py-4 text-center text-sm text-stone-450">{b.noSlots}</p>
                ) : (
                  <div className="space-y-3">
                    {[{ k: 'm', icon: Sun, label: b.morning, list: morning }, { k: 'e', icon: Moon, label: b.evening, list: evening }].filter((g) => g.list.length).map((g) => (
                      <div key={g.k}>
                        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-stone-450"><g.icon className="h-3.5 w-3.5" />{g.label}</div>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                          {g.list.map((s) => (
                            <button key={s.starts_at} type="button" onClick={() => setSlot(s)}
                              className={cx('h-10 rounded-xl border text-sm font-medium tabular-nums transition',
                                slot?.starts_at === s.starts_at ? 'border-accent bg-accent text-white' : 'border-sand-200 hover:border-brand/40 hover:bg-brand/[.03]')}>
                              {fmtTime(s.starts_at, locale)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* 4 — confirm */}
      {doctor && slot && (
        <section className="rounded-2xl border-2 border-brand/20 bg-white p-4 shadow-card sm:p-5">
          <h3 className="mb-3 font-semibold">{b.summary}</h3>
          <div className="flex items-center gap-3">
            <Avatar name={doctor.full_name_ar} gender={doctor.gender} photo={doctor.photo_url} />
            <div className="min-w-0 text-sm">
              <div className="font-semibold">{name(doctor)}</div>
              <div className="text-stone-450">{clinic ? cname(clinic) : ''} · {fmtDay(slot.starts_at, locale)} · {fmtTime(slot.starts_at, locale)}</div>
            </div>
          </div>
          {mode !== 'reschedule' && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {(['new', 'follow_up'] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setVisitType(v)}
                    className={cx('h-9 rounded-full border px-4 text-sm', visitType === v ? 'border-brand bg-brand/[.06] font-semibold text-brand' : 'border-sand-200 text-ink/70')}>
                    {d.cl.visitType[v]} · <span className="tabular-nums">{v === 'new' ? doctor.consultation_fee : doctor.follow_up_fee} {d.common.sar}</span>
                  </button>
                ))}
                {mode === 'staff' && (['reception', 'phone'] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setSource(v)}
                    className={cx('h-9 rounded-full border px-4 text-sm', source === v ? 'border-accent bg-accent/10 font-semibold text-accent' : 'border-sand-200 text-ink/70')}>
                    {d.cl.source[v]}
                  </button>
                ))}
              </div>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={b.reasonPh} className="min-h-[72px]" maxLength={500} />
              {mode === 'patient' && (
                <p className="rounded-xl bg-sand-50 p-3 text-xs leading-relaxed text-stone-450">
                  {insuranceName ? fmt(b.insuranceNote, { ins: insuranceName }) : b.noInsuranceNote} {b.arriveEarly}
                </p>
              )}
            </div>
          )}
          {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={submit} className={buttonClass('accent', 'lg', 'flex-1 sm:flex-none')}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'reschedule' ? d.cl.appt.saveNew : pending ? b.confirming : b.confirm}
            </button>
            <button type="button" onClick={() => setSlot(null)} className={buttonClass('ghost', 'lg')}><Back className="h-4 w-4" />{b.back}</button>
          </div>
        </section>
      )}
    </div>
  );
}

function fmtHour(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Riyadh' }).format(new Date(iso));
}
