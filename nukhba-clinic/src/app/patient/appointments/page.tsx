import Link from 'next/link';
import { CalendarClock, CalendarPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { ApptBadge, ClinicIcon, fmtDay, fmtTime, Stars } from '@/components/clinic-ui';
import { Card, EmptyState, LinkButton, PageHeader, cx } from '@/components/ui';
import type { AppointmentOverview } from '@/lib/types';
import { getMyPatient } from '../data';

export const metadata = { title: 'مواعيدي' };

export default async function MyAppointments({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const [{ d, locale }, supabase, me] = await Promise.all([getI18n(), createClient(), getMyPatient()]);
  if (!me) return null;
  const { data } = await supabase.from('appointment_overview').select('*').eq('patient_id', me.id).order('starts_at', { ascending: false }).limit(100);
  const all = (data ?? []) as AppointmentOverview[];
  const active = ['booked', 'confirmed', 'checked_in', 'in_consultation'];
  const past = sp.tab === 'past';
  const list = past ? all.filter((a) => !active.includes(a.status)) : all.filter((a) => active.includes(a.status)).reverse();
  const L = locale === 'ar';
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={d.cl.pt.nav.appts} actions={<LinkButton href="/patient/book" variant="accent"><CalendarPlus className="h-4 w-4" />{d.cl.book.title}</LinkButton>} />
      <div className="mb-4 grid grid-cols-2 rounded-full bg-sand-100 p-1 text-sm">
        {[[false, d.cl.pt.upcoming, '/patient/appointments'], [true, d.cl.pt.past, '/patient/appointments?tab=past']].map(([p, label, href]) => (
          <Link key={String(href)} href={String(href)} className={cx('rounded-full py-2 text-center', past === p ? 'bg-white font-semibold text-brand shadow-sm' : 'text-ink/60')}>{String(label)}</Link>
        ))}
      </div>
      {list.length === 0 ? <Card><EmptyState icon={<CalendarClock className="h-5 w-5" />} title={d.cl.pt.noAppts} /></Card> : (
        <div className="space-y-3">
          {list.map((a) => (
            <Link key={a.id} href={`/patient/appointments/${a.id}`}>
              <Card className="flex items-center gap-4 p-4 transition hover:border-brand/30">
                <div className="w-20 shrink-0 rounded-2xl bg-brand/[.06] py-2 text-center">
                  <div className="text-xs text-stone-450">{fmtDay(a.starts_at, locale, { weekday: 'short' })}</div>
                  <div className="text-xl font-bold tabular-nums text-brand">{fmtDay(a.starts_at, locale, { day: 'numeric' })}</div>
                  <div className="text-xs text-stone-450">{fmtDay(a.starts_at, locale, { month: 'short' })}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold"><span className="tabular-nums">{fmtTime(a.starts_at, locale)}</span><ApptBadge status={a.status} d={d} /></div>
                  <div className="mt-1 truncate font-medium">{L ? a.doctor_name_ar : a.doctor_name_en ?? a.doctor_name_ar}</div>
                  <div className="flex items-center gap-1 truncate text-xs text-stone-450"><ClinicIcon name={a.clinic_icon} className="h-3.5 w-3.5" />{L ? a.clinic_name_ar : a.clinic_name_en}</div>
                </div>
                {a.rating_score ? <Stars score={a.rating_score} /> : null}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
