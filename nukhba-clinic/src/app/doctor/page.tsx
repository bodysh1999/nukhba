import Link from 'next/link';
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, Hourglass, Stethoscope, UsersRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { riyadhDay } from '@/lib/clinic-data';
import { fmt } from '@/lib/i18n';
import { ApptBadge, Avatar, fmtDay, fmtTime, PatientLine } from '@/components/clinic-ui';
import { LiveRefresh } from '@/components/live';
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard } from '@/components/ui';
import type { AppointmentOverview } from '@/lib/types';
import { CallPatient } from './encounter-client';
import { getMyDoctor } from './data';

export const metadata = { title: 'قائمة اليوم' };

export default async function DoctorToday() {
  const [{ d, locale }, supabase, me] = await Promise.all([getI18n(), createClient(), getMyDoctor()]);
  const k = d.cl.dr;
  if (!me) return <EmptyState title={d.errors.FORBIDDEN} />;
  const t = riyadhDay();
  const { data } = await supabase.from('appointment_overview').select('*').eq('doctor_id', me.id)
    .gte('starts_at', t.from).lte('starts_at', t.to).neq('status', 'cancelled').order('starts_at');
  const rows = (data ?? []) as AppointmentOverview[];
  const ids = [...new Set(rows.map((r) => r.patient_id))];
  const { data: alerts } = ids.length
    ? await supabase.from('patients').select('id, allergies, chronic_conditions').in('id', ids)
    : { data: [] as { id: string; allergies: string | null; chronic_conditions: string | null }[] };
  const alertOf = (id: string) => (alerts ?? []).find((a) => a.id === id);
  const inRoom = rows.filter((r) => r.status === 'in_consultation');
  const waiting = rows.filter((r) => r.status === 'checked_in').sort((a, b) => (a.queue_no ?? 0) - (b.queue_no ?? 0));
  const upcoming = rows.filter((r) => r.status === 'booked' || r.status === 'confirmed');
  const done = rows.filter((r) => r.status === 'completed' || r.status === 'no_show');
  const waits = rows.filter((r) => r.called_at && r.checked_in_at).map((r) => (new Date(r.called_at!).getTime() - new Date(r.checked_in_at!).getTime()) / 60000);
  const avgWait = waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : null;
  const Go = locale === 'ar' ? ArrowLeft : ArrowRight;

  const Row = ({ a, action }: { a: AppointmentOverview; action?: React.ReactNode }) => {
    const al = alertOf(a.patient_id);
    return (
      <li className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
        {a.queue_no ? <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/[.08] text-sm font-bold text-brand">#{a.queue_no}</span>
          : <span className="w-10 shrink-0 text-center text-xs font-medium tabular-nums text-stone-450">{fmtTime(a.starts_at, locale)}</span>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/doctor/patients/${a.patient_id}`} className="truncate font-semibold hover:text-brand">{a.patient_name}</Link>
            {a.visit_type === 'follow_up' && <Badge className="bg-sand-100 text-ink/70 ring-sand-200">{d.cl.visitType.follow_up}</Badge>}
            {al?.allergies && <Badge className="bg-rose-50 text-rose-800 ring-rose-200"><AlertTriangle className="h-3 w-3" />{al.allergies}</Badge>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-stone-450">
            <PatientLine p={a} d={d} />
            {a.reason && <span>· {a.reason}</span>}
            {a.status === 'checked_in' && a.waiting_minutes !== null && <span className="text-amber-700">· {fmt(d.cl.f.waited, { n: Math.round(Number(a.waiting_minutes)) })}</span>}
          </div>
        </div>
        {action}
      </li>
    );
  };

  return (
    <div>
      <LiveRefresh tables={['appointments']} fallbackSeconds={60} />
      <PageHeader eyebrow={fmtDay(new Date(), locale)} title={k.queue} subtitle={locale === 'ar' ? me.full_name_ar : me.full_name_en ?? me.full_name_ar} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={k.waiting} value={waiting.length} icon={<Hourglass className="h-4 w-4" />} tone={waiting.length ? 'warn' : 'default'} />
        <StatCard label={k.upcoming} value={upcoming.length} icon={<CalendarClock className="h-4 w-4" />} />
        <StatCard label={k.seenToday} value={done.filter((x) => x.status === 'completed').length} icon={<CheckCircle2 className="h-4 w-4" />} tone="good" />
        <StatCard label={k.avgWait} value={avgWait === null ? '—' : `${avgWait} ${d.cl.f.minutes}`} icon={<UsersRound className="h-4 w-4" />} />
      </div>

      {inRoom.map((a) => (
        <Link key={a.id} href={a.visit_id ? `/doctor/visits/${a.visit_id}` : '#'} className="mb-4 flex items-center gap-4 rounded-2xl border-2 border-violet-200 bg-violet-50 p-4 transition hover:border-violet-300">
          <Avatar name={a.patient_name} gender={a.patient_gender} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-violet-700">{d.cl.status.in_consultation}</div>
            <div className="truncate font-semibold">{a.patient_name}</div>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-violet-800">{k.continue}<Go className="h-4 w-4" /></span>
        </Link>
      ))}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={k.waiting} subtitle={k.startHint} />
          {waiting.length === 0 ? <EmptyState icon={<Stethoscope className="h-5 w-5" />} title={k.noQueue} /> : (
            <ul className="divide-y divide-sand-100">{waiting.map((a, i) => <Row key={a.id} a={a} action={<CallPatient id={a.id} primary={i === 0} />} />)}</ul>
          )}
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title={k.upcoming} />
            {upcoming.length === 0 ? <EmptyState title={d.common.noData} /> : (
              <ul className="divide-y divide-sand-100">{upcoming.map((a) => <Row key={a.id} a={a} action={<ApptBadge status={a.status} d={d} />} />)}</ul>
            )}
          </Card>
          <Card>
            <CardHeader title={k.completed} />
            {done.length === 0 ? <EmptyState title={d.common.noData} /> : (
              <ul className="divide-y divide-sand-100">{done.map((a) => (
                <Row key={a.id} a={a} action={a.visit_id ? <Link href={`/doctor/visits/${a.visit_id}`} className="text-sm text-brand hover:underline">{d.cl.f.open}</Link> : <ApptBadge status={a.status} d={d} />} />
              ))}</ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
