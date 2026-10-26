import Link from 'next/link';
import {
  Banknote, CalendarClock, CalendarDays, Clock, Globe2, Hourglass, Inbox, ShieldPlus, Star, Stethoscope, UserCheck, UserPlus, UserX,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { riyadhDay } from '@/lib/clinic-data';
import { DailyArea, SimpleBars, StatusDonut } from '@/components/charts';
import { fmtDay, Money } from '@/components/clinic-ui';
import { LiveRefresh } from '@/components/live';
import { Card, CardHeader, PageHeader, StatCard, cx } from '@/components/ui';
import type { AppointmentStatus } from '@/lib/types';

export const metadata = { title: 'لوحة التحكم' };
type Load = { doctor_id: string; doctor_name_ar: string; doctor_name_en: string | null; clinic_name_ar: string; clinic_name_en: string; total: number; waiting: number; in_room: number; done: number; now_serving: number | null };

export default async function AdminDashboard() {
  const [{ d, locale }, supabase] = await Promise.all([getI18n(), createClient()]);
  const a = d.cl.adm;
  const k = a.kpi;
  const [{ data: dash }, { data: load }, { data: rep }] = await Promise.all([
    supabase.rpc('clinic_dashboard'),
    supabase.rpc('today_by_doctor'),
    supabase.rpc('report_summary', { p_from: riyadhDay(-29).day, p_to: riyadhDay().day }),
  ]);
  const x = (dash ?? {}) as Record<string, number | null>;
  const r = (rep ?? { daily: [], by_status: {}, by_clinic: [] }) as { daily: { day: string; appointments: number; collected: number }[]; by_status: Record<string, number>; by_clinic: { name_ar: string; name_en: string; appointments: number }[] };
  const L = locale === 'ar';

  return (
    <div>
      <LiveRefresh tables={['appointments', 'payments']} fallbackSeconds={120} />
      <PageHeader eyebrow={fmtDay(new Date(), locale)} title={d.nav.dashboard} subtitle={a.overview} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard tone="brand" label={k.todayTotal} value={x.today_total ?? 0} icon={<CalendarDays className="h-4 w-4" />} hint={`${d.cl.desk.upcoming}: ${x.today_upcoming ?? 0}`} />
        <StatCard label={k.waiting} value={x.today_waiting ?? 0} icon={<Hourglass className="h-4 w-4" />} tone={(x.today_waiting ?? 0) > 5 ? 'warn' : 'default'} hint={`${k.inRoom}: ${x.today_in_room ?? 0}`} />
        <StatCard label={k.completed} value={x.today_completed ?? 0} icon={<UserCheck className="h-4 w-4" />} tone="good" hint={`${d.cl.desk.noShow}: ${x.today_no_show ?? 0}`} />
        <StatCard label={k.avgWait} value={x.avg_wait_min !== null && x.avg_wait_min !== undefined ? `${x.avg_wait_min} ${d.cl.f.minutes}` : '—'} icon={<Clock className="h-4 w-4" />} />
        <StatCard label={k.collectedToday} value={<Money v={x.collected_today} l={locale} />} icon={<Banknote className="h-4 w-4" />} />
        <StatCard label={k.collectedMonth} value={<Money v={x.collected_month} l={locale} />} icon={<Banknote className="h-4 w-4" />} hint={<>{d.cl.bill.kpi.billedMonth}: <Money v={x.billed_month} l={locale} /></>} />
        <StatCard label={k.rating} value={x.rating_30 ?? '—'} icon={<Star className="h-4 w-4" />} tone="good" hint={`${x.ratings_count_30 ?? 0}`} />
        <StatCard label={k.noShowRate} value={`${x.no_show_rate_30 ?? 0}%`} icon={<UserX className="h-4 w-4" />} tone={(x.no_show_rate_30 ?? 0) > 12 ? 'warn' : 'default'} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/reception/requests', icon: Inbox, label: k.requests, v: x.open_requests ?? 0, tone: (x.open_requests ?? 0) > 0 },
          { href: '/billing/claims', icon: ShieldPlus, label: k.claimsOpen, v: <Money v={x.claims_open_amount} l={locale} />, tone: false },
          { href: '/reception/appointments', icon: CalendarClock, label: k.week, v: x.week_booked ?? 0, tone: false },
          { href: '/reception/patients', icon: UserPlus, label: k.newPatients, v: x.new_patients_30 ?? 0, tone: false },
        ].map((q) => (
          <Link key={q.href} href={q.href} className={cx('flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-card transition hover:border-brand/30', q.tone ? 'border-accent/50' : 'border-sand-200')}>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-sand-100 text-ink/70"><q.icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1 text-sm text-stone-450">{q.label}</span>
            <span className="text-lg font-semibold tabular-nums">{q.v}</span>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={a.apptsDaily} subtitle={a.last30} action={<span className="inline-flex items-center gap-1 text-xs text-stone-450"><Globe2 className="h-3.5 w-3.5" />{k.online}: {x.online_share_30 ?? 0}%</span>} />
          <div className="p-4"><DailyArea data={r.daily} series={[{ key: 'appointments', label: a.appts }]} /></div>
        </Card>
        <Card>
          <CardHeader title={a.byDoctorToday} />
          <ul className="max-h-[300px] divide-y divide-sand-100 overflow-y-auto">
            {((load ?? []) as Load[]).map((l) => (
              <li key={l.doctor_id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <Stethoscope className="h-4 w-4 shrink-0 text-stone-450" />
                <div className="min-w-0 flex-1"><div className="truncate font-medium">{L ? l.doctor_name_ar : l.doctor_name_en ?? l.doctor_name_ar}</div><div className="truncate text-xs text-stone-450">{L ? l.clinic_name_ar : l.clinic_name_en}</div></div>
                <div className="w-24">
                  <div className="h-1.5 overflow-hidden rounded-full bg-sand-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${l.total ? Math.round((l.done / l.total) * 100) : 0}%` }} /></div>
                  <div className="mt-0.5 text-end text-[11px] tabular-nums text-stone-450">{l.done}/{l.total}{l.waiting ? ` · ⏳${l.waiting}` : ''}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title={a.revenueDaily} subtitle={a.last30} />
          <div className="p-4"><DailyArea data={r.daily} series={[{ key: 'collected', label: a.collected, color: 'accent' }]} /></div>
        </Card>
        <Card>
          <CardHeader title={d.cl.f.status} subtitle={a.last30} />
          <div className="p-5"><StatusDonut data={Object.entries(r.by_status).map(([key, count]) => ({ key: key as AppointmentStatus, count }))} /></div>
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader title={a.byClinic} subtitle={a.last30} />
          <div className="p-4"><SimpleBars data={r.by_clinic.map((c) => ({ key: L ? c.name_ar : c.name_en, count: c.appointments }))} /></div>
        </Card>
      </div>
    </div>
  );
}
