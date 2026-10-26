import { CalendarClock, Plane } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { riyadhDay } from '@/lib/clinic-data';
import { WEEKDAYS } from '@/lib/constants';
import { ApptBadge, fmtDay, fmtTime } from '@/components/clinic-ui';
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import type { AppointmentOverview } from '@/lib/types';
import { getMyDoctor } from '../data';

export const metadata = { title: 'جدولي' };

export default async function MySchedule() {
  const [{ d, locale }, supabase, me] = await Promise.all([getI18n(), createClient(), getMyDoctor()]);
  if (!me) return <EmptyState title={d.errors.FORBIDDEN} />;
  const from = riyadhDay(1).from, to = riyadhDay(7).to;
  const [{ data: shifts }, { data: off }, { data: appts }] = await Promise.all([
    supabase.from('doctor_schedules').select('*').eq('doctor_id', me.id).order('start_time'),
    supabase.from('doctor_time_off').select('*').eq('doctor_id', me.id).gte('to_date', riyadhDay().day).order('from_date'),
    supabase.from('appointment_overview').select('*').eq('doctor_id', me.id).gte('starts_at', from).lte('starts_at', to).in('status', ['booked', 'confirmed']).order('starts_at'),
  ]);
  const byDay = new Map<string, AppointmentOverview[]>();
  for (const a of (appts ?? []) as AppointmentOverview[]) {
    const k = new Date(new Date(a.starts_at).getTime() + 3 * 3600e3).toISOString().slice(0, 10);
    byDay.set(k, [...(byDay.get(k) ?? []), a]);
  }
  const t = (x: string) => x.slice(0, 5);
  return (
    <div>
      <PageHeader title={d.cl.dr.schedule} />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={d.cl.dr.weekHours} />
            <ul className="divide-y divide-sand-100">
              {WEEKDAYS.map((w) => {
                const s = (shifts ?? []).filter((x) => x.weekday === w);
                return (
                  <li key={w} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="font-medium">{d.cl.weekday[w]}</span>
                    <span className="text-stone-450" dir="ltr">{s.length ? s.map((x) => `${t(x.start_time)}–${t(x.end_time)}`).join(' · ') : '—'}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card>
            <CardHeader title={d.cl.dr.timeOff} />
            {!off?.length ? <EmptyState icon={<Plane className="h-5 w-5" />} title={d.common.noData} /> : (
              <ul className="divide-y divide-sand-100">
                {off.map((o) => <li key={o.id} className="px-5 py-2.5 text-sm">{fmtDate(o.from_date, locale)} → {fmtDate(o.to_date, locale)}{o.reason ? <span className="text-stone-450"> · {o.reason}</span> : null}</li>)}
              </ul>
            )}
          </Card>
        </div>
        <Card>
          <CardHeader title={d.cl.desk.upcoming} subtitle={`${appts?.length ?? 0}`} />
          {byDay.size === 0 ? <EmptyState icon={<CalendarClock className="h-5 w-5" />} title={d.common.noData} /> : (
            <div className="divide-y divide-sand-100">
              {[...byDay.entries()].map(([day, list]) => (
                <section key={day} className="px-5 py-3">
                  <h3 className="mb-2 text-sm font-semibold">{fmtDay(`${day}T12:00:00+03:00`, locale)} <span className="font-normal text-stone-450">· {list.length}</span></h3>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {list.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 rounded-lg bg-sand-50 px-3 py-1.5 text-sm">
                        <span className="w-16 tabular-nums text-stone-450">{fmtTime(a.starts_at, locale)}</span>
                        <span className="min-w-0 flex-1 truncate">{a.patient_name}</span>
                        <ApptBadge status={a.status} d={d} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
