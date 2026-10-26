import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { dayBounds, getDoctors, riyadhDay } from '@/lib/clinic-data';
import { ALL_APPT_STATUSES } from '@/lib/constants';
import { ApptBadge, fmtDay, fmtTime } from '@/components/clinic-ui';
import { Card, EmptyState, Input, PageHeader, Select, buttonClass } from '@/components/ui';
import type { AppointmentOverview } from '@/lib/types';
import { DeskRowActions } from '../desk-client';

export const metadata = { title: 'المواعيد' };

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ day?: string; doctor?: string; status?: string }> }) {
  const sp = await searchParams;
  const [{ d, locale }, supabase, doctors] = await Promise.all([getI18n(), createClient(), getDoctors(false)]);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.day ?? '') ? sp.day! : riyadhDay().day;
  const b = dayBounds(day);
  let q = supabase.from('appointment_overview').select('*').gte('starts_at', b.from).lte('starts_at', b.to).order('starts_at');
  if (sp.doctor) q = q.eq('doctor_id', sp.doctor);
  if (sp.status && (ALL_APPT_STATUSES as string[]).includes(sp.status)) q = q.eq('status', sp.status);
  const { data } = await q;
  const rows = (data ?? []) as AppointmentOverview[];
  const shift = (n: number) => {
    const dt = new Date(`${day}T12:00:00+03:00`); dt.setUTCDate(dt.getUTCDate() + n);
    return `/reception/appointments?${new URLSearchParams({ day: dt.toISOString().slice(0, 10), ...(sp.doctor ? { doctor: sp.doctor } : {}), ...(sp.status ? { status: sp.status } : {}) })}`;
  };
  const Prev = locale === 'ar' ? ChevronRight : ChevronLeft;
  const Next = locale === 'ar' ? ChevronLeft : ChevronRight;
  const now = Date.now();
  return (
    <div>
      <PageHeader title={d.cl.desk.appointments} subtitle={fmtDay(`${day}T12:00:00+03:00`, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
      <form className="mb-4 flex flex-wrap items-center gap-2" action="/reception/appointments">
        <Link href={shift(-1)} className={buttonClass('outline', 'md', 'w-10 px-0')} aria-label="previous"><Prev className="h-4 w-4" /></Link>
        <Input type="date" name="day" defaultValue={day} className="w-44" />
        <Link href={shift(1)} className={buttonClass('outline', 'md', 'w-10 px-0')} aria-label="next"><Next className="h-4 w-4" /></Link>
        <Select name="doctor" defaultValue={sp.doctor ?? ''} className="w-56">
          <option value="">{d.cl.f.allDoctors}</option>
          {doctors.map((x) => <option key={x.id} value={x.id}>{locale === 'ar' ? x.full_name_ar : x.full_name_en ?? x.full_name_ar}</option>)}
        </Select>
        <Select name="status" defaultValue={sp.status ?? ''} className="w-40">
          <option value="">{d.common.all}</option>
          {ALL_APPT_STATUSES.map((s) => <option key={s} value={s}>{d.cl.status[s]}</option>)}
        </Select>
        <button className={buttonClass('primary')}>{d.common.apply}</button>
      </form>
      <Card className="overflow-x-auto">
        {rows.length === 0 ? <EmptyState icon={<CalendarDays className="h-5 w-5" />} title={d.common.noData} /> : (
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-sand-50 text-xs text-stone-450">
              <tr className="text-start">
                <th className="px-4 py-3 text-start font-medium">{d.cl.f.time}</th>
                <th className="px-4 py-3 text-start font-medium">{d.cl.f.patient}</th>
                <th className="px-4 py-3 text-start font-medium">{d.cl.f.doctor}</th>
                <th className="px-4 py-3 text-start font-medium">{d.cl.f.source}</th>
                <th className="px-4 py-3 text-start font-medium">{d.cl.f.status}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {rows.map((a) => (
                <tr key={a.id} className="align-middle">
                  <td className="px-4 py-3 font-medium tabular-nums">{fmtTime(a.starts_at, locale)}{a.queue_no ? <span className="ms-1 text-xs text-brand">#{a.queue_no}</span> : null}</td>
                  <td className="px-4 py-3">
                    <Link href={`/reception/patients/${a.patient_id}`} className="font-medium hover:text-brand">{a.patient_name}</Link>
                    <div className="text-xs text-stone-450" dir="ltr">{a.file_no} · {a.patient_phone}</div>
                  </td>
                  <td className="px-4 py-3">{locale === 'ar' ? a.doctor_name_ar : a.doctor_name_en ?? a.doctor_name_ar}<div className="text-xs text-stone-450">{locale === 'ar' ? a.clinic_name_ar : a.clinic_name_en}</div></td>
                  <td className="px-4 py-3 text-xs text-stone-450">{d.cl.source[a.source]}</td>
                  <td className="px-4 py-3"><ApptBadge status={a.status} d={d} /></td>
                  <td className="px-4 py-3">{day === riyadhDay().day ? <DeskRowActions id={a.id} status={a.status} past={new Date(a.starts_at).getTime() < now} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
