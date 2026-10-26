import Link from 'next/link';
import {
  AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, CalendarPlus, FileHeart, FileText, FlaskConical, MapPin, ReceiptText, ShieldPlus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { fmt } from '@/lib/i18n';
import { ApptBadge, Avatar, FlagBadge, fmtDay, fmtTime, Money } from '@/components/clinic-ui';
import { LiveRefresh } from '@/components/live';
import { Card, CardHeader, EmptyState, LinkButton, cx } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import type { AppointmentOverview, Invoice, TestOrder } from '@/lib/types';
import { getMyPatient } from './data';

export const metadata = { title: 'الرئيسية' };

export default async function PatientHome() {
  const [{ d, locale }, supabase, me] = await Promise.all([getI18n(), createClient(), getMyPatient()]);
  const pt = d.cl.pt;
  if (!me) return <EmptyState title={d.errors.FORBIDDEN} />;
  const nowIso = new Date(Date.now() - 2 * 3600e3).toISOString();
  const [{ data: next }, { data: results }, { data: dues }] = await Promise.all([
    supabase.from('appointment_overview').select('*').eq('patient_id', me.id).in('status', ['booked', 'confirmed', 'checked_in', 'in_consultation'])
      .gte('starts_at', nowIso).order('starts_at').limit(3),
    supabase.from('lab_orders').select('*').eq('patient_id', me.id).eq('status', 'resulted').order('resulted_at', { ascending: false }).limit(3),
    supabase.from('invoices').select('*').eq('patient_id', me.id).in('status', ['issued', 'partially_paid']).order('created_at', { ascending: false }),
  ]);
  const upcoming = (next ?? []) as AppointmentOverview[];
  const first = upcoming[0];
  const L = locale === 'ar';
  const Go = L ? ArrowLeft : ArrowRight;
  const quick = [
    { href: '/patient/book', icon: CalendarPlus, label: pt.quick.book, tone: 'bg-accent text-white' },
    { href: '/patient/appointments', icon: CalendarClock, label: pt.quick.appts, tone: 'bg-brand/[.07] text-brand' },
    { href: '/patient/records', icon: FileHeart, label: pt.quick.records, tone: 'bg-brand/[.07] text-brand' },
    { href: '/patient/records?tab=results', icon: FlaskConical, label: pt.quick.results, tone: 'bg-brand/[.07] text-brand' },
    { href: '/patient/records?tab=docs', icon: FileText, label: pt.quick.docs, tone: 'bg-brand/[.07] text-brand' },
    { href: '/patient/invoices', icon: ReceiptText, label: pt.quick.invoices, tone: 'bg-brand/[.07] text-brand' },
  ];

  return (
    <div className="space-y-6">
      <LiveRefresh appointmentId={first?.id} fallbackSeconds={first && ['checked_in', 'in_consultation'].includes(first.status) ? 30 : 300} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{fmt(pt.hello, { name: me.full_name.split(' ')[0] })}</h1>
        <p className="mt-1 text-sm text-stone-450">{pt.welcome}</p>
      </div>

      {me.allergies && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <AlertTriangle className="h-4 w-4 shrink-0" /><span className="font-medium">{pt.allergiesAlert}:</span> {me.allergies}
        </div>
      )}

      {/* next appointment */}
      {first ? (
        <Link href={`/patient/appointments/${first.id}`} className="texture-lines group block overflow-hidden rounded-3xl bg-brand p-5 text-white shadow-lift sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-white/70">{pt.next}</span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs">{d.cl.status[first.status]}</span>
          </div>
          {first.status === 'in_consultation' ? (
            <div className="mt-4 rounded-2xl bg-accent px-4 py-3 text-lg font-semibold">{fmt(pt.yourTurn, { room: (L ? first.clinic_location_ar : first.clinic_location_en) ?? (L ? first.clinic_name_ar : first.clinic_name_en) })}</div>
          ) : first.status === 'checked_in' ? (
            <div className="mt-4 rounded-2xl bg-white/15 px-4 py-3 text-lg font-semibold">{fmt(pt.waitingNow, { q: first.queue_no ?? '—' })}</div>
          ) : null}
          <div className="mt-4 flex items-center gap-4">
            <Avatar name={first.doctor_name_ar} photo={first.doctor_photo} size="lg" className="bg-white/10 text-white" />
            <div className="min-w-0 flex-1">
              <div className="text-2xl font-bold">{fmtTime(first.starts_at, locale)}</div>
              <div className="text-sm text-white/80">{fmtDay(first.starts_at, locale)}</div>
              <div className="mt-1 truncate text-sm font-medium">{L ? first.doctor_name_ar : first.doctor_name_en ?? first.doctor_name_ar} · {L ? first.clinic_name_ar : first.clinic_name_en}</div>
              {(L ? first.clinic_location_ar : first.clinic_location_en) && <div className="flex items-center gap-1 text-xs text-white/70"><MapPin className="h-3 w-3" />{L ? first.clinic_location_ar : first.clinic_location_en}</div>}
            </div>
            <Go className="h-5 w-5 shrink-0 text-white/60 transition group-hover:translate-x-0.5" />
          </div>
        </Link>
      ) : (
        <Card className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent"><CalendarPlus className="h-6 w-6" /></span>
          <div className="flex-1"><div className="font-semibold">{pt.bookCta}</div><div className="text-sm text-stone-450">{pt.bookCtaSub}</div></div>
          <LinkButton href="/patient/book" variant="accent">{pt.bookCta}</LinkButton>
        </Card>
      )}

      {/* quick actions */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {quick.map((q) => (
          <Link key={q.href} href={q.href} className="flex flex-col items-center gap-2 rounded-2xl border border-sand-200 bg-white p-3 text-center shadow-card transition hover:border-brand/30">
            <span className={cx('grid h-11 w-11 place-items-center rounded-xl', q.tone)}><q.icon className="h-5 w-5" /></span>
            <span className="text-xs font-medium leading-tight">{q.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {upcoming.length > 1 && (
          <Card>
            <CardHeader title={pt.upcoming} />
            <ul className="divide-y divide-sand-100">
              {upcoming.slice(1).map((a) => (
                <li key={a.id}>
                  <Link href={`/patient/appointments/${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-sand-50">
                    <div className="w-20 text-sm font-semibold tabular-nums">{fmtTime(a.starts_at, locale)}<div className="text-xs font-normal text-stone-450">{fmtDay(a.starts_at, locale, { day: 'numeric', month: 'short' })}</div></div>
                    <div className="min-w-0 flex-1 text-sm"><div className="truncate font-medium">{L ? a.doctor_name_ar : a.doctor_name_en ?? a.doctor_name_ar}</div><div className="truncate text-xs text-stone-450">{L ? a.clinic_name_ar : a.clinic_name_en}</div></div>
                    <ApptBadge status={a.status} d={d} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card>
          <CardHeader title={pt.recentResults} action={<Link href="/patient/records?tab=results" className="text-sm text-brand hover:underline">{d.admin.viewAll}</Link>} />
          {!results?.length ? <EmptyState icon={<FlaskConical className="h-5 w-5" />} title={d.cl.rec.noResults} /> : (
            <ul className="divide-y divide-sand-100">
              {(results as TestOrder[]).map((t) => (
                <li key={t.id} className="px-5 py-3 text-sm">
                  <div className="flex items-center gap-2"><span className="flex-1 font-medium">{t.test_name}</span><FlagBadge flag={t.result_flag} d={d} /></div>
                  {t.result_text && <p className="mt-0.5 line-clamp-2 text-xs text-stone-450">{t.result_text}</p>}
                  <div className="mt-0.5 text-[11px] text-stone-450">{fmtDate(t.resulted_at, locale)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {!!dues?.length && (
          <Card className="border-amber-200">
            <CardHeader title={pt.dueInvoices} subtitle={pt.payAtDesk} />
            <ul className="divide-y divide-sand-100">
              {(dues as Invoice[]).map((i) => (
                <li key={i.id}>
                  <Link href={`/print/invoice/${i.id}`} target="_blank" className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-sand-50">
                    <span className="font-mono text-xs" dir="ltr">{i.inv_no}</span>
                    <span className="flex-1 text-stone-450">{fmtDate(i.created_at, locale)}</span>
                    <Money v={Number(i.patient_amount) - Number(i.paid_amount)} l={locale} className="font-semibold text-rose-700" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {me.insurance_companies && (
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-teal-700 to-brand p-5 text-white">
              <div className="flex items-center justify-between"><span className="text-xs text-white/70">{pt.insuranceCard}</span><ShieldPlus className="h-5 w-5 text-white/70" /></div>
              <div className="mt-3 text-lg font-semibold">{L ? me.insurance_companies.name_ar : me.insurance_companies.name_en ?? me.insurance_companies.name_ar}</div>
              <div className="mt-4 flex justify-between text-sm">
                <div><div className="text-[11px] text-white/60">{d.cl.f.memberNo}</div><div className="font-mono" dir="ltr">{me.insurance_member_no ?? '—'}</div></div>
                <div><div className="text-[11px] text-white/60">{d.cl.f.insClass}</div><div>{me.insurance_class ?? '—'}</div></div>
                <div><div className="text-[11px] text-white/60">{d.cl.f.insExpiry}</div><div>{fmtDate(me.insurance_expiry, locale)}</div></div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
