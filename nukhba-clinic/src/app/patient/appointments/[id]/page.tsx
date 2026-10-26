import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, FileHeart, MapPin, Navigation, ReceiptText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, getSettings } from '@/lib/session';
import { bookingData } from '@/lib/clinic-data';
import { fmt } from '@/lib/i18n';
import { APPT_STAGES } from '@/lib/constants';
import { mapLink } from '@/lib/public-data';
import { BookingWizard } from '@/components/booking-wizard';
import { ApptBadge, Avatar, fmtDay, fmtTime, InvoiceBadge, Money, Stars } from '@/components/clinic-ui';
import { LiveRefresh } from '@/components/live';
import { Card, CardHeader, KeyValue, PageHeader, buttonClass, cx } from '@/components/ui';
import type { AppointmentOverview } from '@/lib/types';
import { CancelAppt, ConfirmAppt, RateVisit } from '../../patient-client';

export default async function MyAppointment({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ change?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [{ d, locale }, supabase, s] = await Promise.all([getI18n(), createClient(), getSettings()]);
  const { data } = await supabase.from('appointment_overview').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const a = data as AppointmentOverview;
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('appointment_id', id).is('read_at', null);
  const { data: visit } = a.visit_id && a.visit_status === 'signed'
    ? await supabase.from('visits').select('diagnosis, patient_advice, follow_up_in_days').eq('id', a.visit_id).maybeSingle()
    : { data: null };
  const k = d.cl.appt;
  const L = locale === 'ar';
  const window = Number(s.cancel_window_hours ?? 3);
  const canChange = ['booked', 'confirmed'].includes(a.status) && new Date(a.starts_at).getTime() - Date.now() > window * 3600e3;
  const stageIdx = APPT_STAGES.indexOf(a.status);
  const off = a.status === 'cancelled' || a.status === 'no_show';
  const room = (L ? a.clinic_location_ar : a.clinic_location_en) ?? (L ? a.clinic_name_ar : a.clinic_name_en);

  if (sp.change && canChange) {
    const data2 = await bookingData();
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title={k.reschedule} subtitle={`${L ? a.doctor_name_ar : a.doctor_name_en ?? a.doctor_name_ar} · ${fmtDay(a.starts_at, locale)} ${fmtTime(a.starts_at, locale)}`} />
        <BookingWizard data={data2} mode="reschedule" appointmentId={a.id} initialDoctor={a.doctor_id} backHref={`/patient/appointments/${a.id}`} />
        <Link href={`/patient/appointments/${a.id}`} className={buttonClass('ghost', 'md', 'mt-4')}>{d.common.back}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <LiveRefresh appointmentId={a.id} fallbackSeconds={['checked_in', 'in_consultation'].includes(a.status) ? 30 : 300} />
      <PageHeader eyebrow={<span dir="ltr">{a.ref_no}</span>} title={L ? a.clinic_name_ar : a.clinic_name_en} actions={<ApptBadge status={a.status} d={d} />} />

      {a.status === 'in_consultation' && <div className="rounded-2xl bg-accent p-4 text-lg font-semibold text-white shadow-lift">{fmt(d.cl.pt.yourTurn, { room })}</div>}
      {a.status === 'checked_in' && <div className="rounded-2xl bg-amber-50 p-4 text-lg font-semibold text-amber-900">{fmt(d.cl.pt.waitingNow, { q: a.queue_no ?? '—' })}</div>}

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <Avatar name={a.doctor_name_ar} photo={a.doctor_photo} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{L ? a.doctor_name_ar : a.doctor_name_en ?? a.doctor_name_ar}</div>
            <div className="text-sm text-stone-450">{d.cl.title[a.doctor_title]}</div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-sand-50 p-4">
            <div className="text-xs text-stone-450">{k.when}</div>
            <div className="mt-1 text-xl font-bold tabular-nums">{fmtTime(a.starts_at, locale)}</div>
            <div className="text-sm">{fmtDay(a.starts_at, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
          <div className="rounded-2xl bg-sand-50 p-4">
            <div className="text-xs text-stone-450">{k.where}</div>
            <div className="mt-1 flex items-center gap-1.5 font-semibold"><MapPin className="h-4 w-4 text-accent" />{room}</div>
            <div className="text-sm text-stone-450">{L ? s.address_ar : s.address_en}</div>
            {mapLink(s.map_query) && <a href={mapLink(s.map_query)!} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-brand hover:underline"><Navigation className="h-3.5 w-3.5" />{k.directions}</a>}
          </div>
        </div>
        {a.reason && <p className="mt-3 text-sm text-stone-450">{d.cl.f.reason}: {a.reason}</p>}
        {(['booked', 'confirmed'].includes(a.status)) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-sand-100 pt-4">
            {a.status === 'booked' && <ConfirmAppt id={a.id} />}
            {a.status === 'confirmed' && <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700"><Check className="h-4 w-4" />{k.confirmed}</span>}
            {canChange ? <>
              <Link href={`/patient/appointments/${a.id}?change=1`} className={buttonClass('outline')}>{k.reschedule}</Link>
              <CancelAppt id={a.id} />
            </> : <p className="text-xs text-stone-450">{k.tooLate}</p>}
            {canChange && <p className="w-full text-xs text-stone-450">{fmt(k.windowNote, { h: window })}</p>}
          </div>
        )}
        {a.status === 'cancelled' && <p className="mt-4 rounded-xl bg-stone-100 p-3 text-sm text-stone-600">{k.cancelled}{a.cancel_reason ? ` — ${a.cancel_reason}` : ''}</p>}
        {a.status === 'no_show' && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{k.noShow}</p>}
      </Card>

      {!off && (
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold">{k.journey}</h3>
          <ol className="grid grid-cols-5 gap-1">
            {APPT_STAGES.map((st, i) => (
              <li key={st} className="flex flex-col items-center text-center">
                <span className={cx('grid h-8 w-8 place-items-center rounded-full text-xs font-semibold', i <= stageIdx ? 'bg-brand text-white' : 'bg-sand-100 text-stone-450', i === stageIdx && 'ring-4 ring-brand/15')}>
                  {i < stageIdx ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className={cx('mt-2 text-[11px] leading-tight', i <= stageIdx ? 'font-medium text-ink' : 'text-stone-450')}>{d.cl.journey[st as keyof typeof d.cl.journey]}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {visit && (
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><FileHeart className="h-4 w-4 text-brand" />{k.summary}</span>}
            action={<Link href={`/patient/records/${a.visit_id}`} className="text-sm text-brand hover:underline">{k.viewSummary}</Link>} />
          <div className="space-y-2 p-5 text-sm">
            <div><span className="text-stone-450">{d.cl.rec.diagnosis}:</span> <b>{visit.diagnosis}</b></div>
            {visit.patient_advice && <p className="rounded-xl bg-brand/[.04] p-3 text-ink/80">{visit.patient_advice}</p>}
            {visit.follow_up_in_days && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent/10 p-3">
                <span>{fmt(k.followUpIn, { n: visit.follow_up_in_days })}</span>
                <Link href={`/patient/book?doctor=${a.doctor_id}`} className={buttonClass('accent', 'sm')}>{k.bookFollowUp}</Link>
              </div>
            )}
          </div>
        </Card>
      )}

      {a.invoice_id && a.invoice_status && a.invoice_status !== 'draft' && (
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <ReceiptText className="h-5 w-5 text-brand" />
            <div className="flex-1"><div className="font-semibold">{k.invoice}</div><div className="font-mono text-xs text-stone-450" dir="ltr">{a.inv_no}</div></div>
            <Money v={a.patient_amount} l={locale} className="font-semibold" />
            <InvoiceBadge status={a.invoice_status} d={d} />
          </div>
          <Link href={`/print/invoice/${a.invoice_id}`} target="_blank" className={buttonClass('outline', 'sm', 'mt-3')}>{d.cl.f.print}</Link>
        </Card>
      )}

      {a.status === 'completed' && (
        <Card className="p-5">
          {a.rating_score ? (
            <div className="flex items-center justify-between"><span className="text-sm">{k.yourRating}</span><Stars score={a.rating_score} /></div>
          ) : (
            <>
              <h3 className="font-semibold">{k.rateTitle}</h3>
              <p className="mb-3 text-sm text-stone-450">{k.rateSub}</p>
              <RateVisit id={a.id} />
            </>
          )}
        </Card>
      )}

      <Card className="p-5 text-sm">
        <div className="divide-y divide-sand-100">
          <KeyValue label={d.cl.f.type}>{d.cl.visitType[a.visit_type]}</KeyValue>
          <KeyValue label={d.cl.f.source}>{d.cl.source[a.source]}</KeyValue>
          <KeyValue label={d.cl.f.ref}><span dir="ltr">{a.ref_no}</span></KeyValue>
        </div>
      </Card>
    </div>
  );
}
