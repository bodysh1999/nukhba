import Link from 'next/link';
import { CalendarPlus, Clock, Hourglass, ListOrdered, Phone, ShieldPlus, UserRoundCheck, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { riyadhDay } from '@/lib/clinic-data';
import { fmt } from '@/lib/i18n';
import { ApptBadge, ClinicIcon, fmtDay, fmtTime, Money } from '@/components/clinic-ui';
import { LiveRefresh } from '@/components/live';
import { Badge, Card, EmptyState, LinkButton, PageHeader, cx } from '@/components/ui';
import type { AppointmentOverview, AppointmentStatus } from '@/lib/types';
import { DeskRowActions } from './desk-client';

export const metadata = { title: 'الاستقبال' };

const TABS: { key: string; statuses: AppointmentStatus[] | null }[] = [
  { key: 'all', statuses: null },
  { key: 'upcoming', statuses: ['booked', 'confirmed'] },
  { key: 'waiting', statuses: ['checked_in'] },
  { key: 'inRoom', statuses: ['in_consultation'] },
  { key: 'done', statuses: ['completed'] },
  { key: 'noShow', statuses: ['no_show', 'cancelled'] },
];

export default async function ReceptionBoard({ searchParams }: { searchParams: Promise<{ tab?: string; doctor?: string }> }) {
  const sp = await searchParams;
  const [{ d, locale }, supabase] = await Promise.all([getI18n(), createClient()]);
  const k = d.cl.desk;
  const today = riyadhDay();
  const [{ data: rows }, { data: load }] = await Promise.all([
    supabase.from('appointment_overview').select('*').gte('starts_at', today.from).lte('starts_at', today.to).order('starts_at'),
    supabase.rpc('today_by_doctor'),
  ]);
  const all = (rows ?? []) as AppointmentOverview[];
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const list = all.filter((a) => (!tab.statuses || tab.statuses.includes(a.status)) && (!sp.doctor || a.doctor_id === sp.doctor));
  const count = (s: AppointmentStatus[]) => all.filter((a) => s.includes(a.status)).length;
  const now = Date.now();
  const label: Record<string, string> = { all: k.all, upcoming: k.upcoming, waiting: k.waiting, inRoom: k.inRoom, done: k.done, noShow: k.noShow };
  const counts: Record<string, number> = {
    all: all.filter((a) => a.status !== 'cancelled').length, upcoming: count(['booked', 'confirmed']), waiting: count(['checked_in']),
    inRoom: count(['in_consultation']), done: count(['completed']), noShow: count(['no_show', 'cancelled']),
  };
  const q = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { tab: sp.tab, doctor: sp.doctor, ...extra };
    Object.entries(merged).forEach(([key, v]) => v && v !== 'all' && p.set(key, v));
    const s = p.toString();
    return s ? `/reception?${s}` : '/reception';
  };
  type Load = { doctor_id: string; doctor_name_ar: string; doctor_name_en: string | null; clinic_name_ar: string; clinic_name_en: string; total: number; waiting: number; in_room: number; done: number; now_serving: number | null };

  return (
    <div>
      <LiveRefresh tables={['appointments']} fallbackSeconds={60} />
      <PageHeader
        eyebrow={fmtDay(new Date(), locale)}
        title={k.board}
        subtitle={fmt(k.todayCount, { n: counts.all })}
        actions={<>
          <LinkButton href="/reception/queue" variant="outline"><ListOrdered className="h-4 w-4" />{k.queue}</LinkButton>
          <LinkButton href="/reception/book" variant="accent"><CalendarPlus className="h-4 w-4" />{k.walkIn}</LinkButton>
        </>}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          {/* tabs */}
          <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {TABS.map((t) => (
              <Link key={t.key} href={q({ tab: t.key })}
                className={cx('flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition',
                  tab.key === t.key ? 'border-brand bg-brand text-white' : 'border-sand-200 bg-white text-ink/75 hover:border-brand/30')}>
                {label[t.key]}
                <span className={cx('rounded-full px-1.5 text-[11px] tabular-nums', tab.key === t.key ? 'bg-white/20' : 'bg-sand-100')}>{counts[t.key]}</span>
              </Link>
            ))}
          </div>

          <Card className="overflow-hidden">
            {list.length === 0 ? (
              <EmptyState icon={<Clock className="h-5 w-5" />} title={d.common.noData} />
            ) : (
              <ul className="divide-y divide-sand-100">
                {list.map((a) => {
                  const past = new Date(a.starts_at).getTime() < now;
                  const late = past && ['booked', 'confirmed'].includes(a.status) && now - new Date(a.starts_at).getTime() > 15 * 60e3;
                  const due = a.invoice_id && a.invoice_status !== 'paid' && a.patient_amount !== null ? Number(a.patient_amount) - Number(a.paid_amount ?? 0) : 0;
                  return (
                    <li key={a.id} className={cx('grid gap-3 px-4 py-3.5 sm:grid-cols-[72px_1fr_auto] sm:items-center sm:px-5', a.status === 'checked_in' && 'bg-amber-50/40', a.status === 'cancelled' && 'opacity-60')}>
                      <div className="flex items-center gap-3 sm:block">
                        <div className="text-[15px] font-semibold tabular-nums">{fmtTime(a.starts_at, locale)}</div>
                        {a.queue_no ? <div className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-brand/[.08] px-1.5 text-xs font-semibold text-brand">#{a.queue_no}</div> : null}
                        {late && <Badge className="bg-rose-50 text-rose-700 ring-rose-200 sm:mt-1">{k.late}</Badge>}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/reception/patients/${a.patient_id}`} className="truncate font-semibold hover:text-brand">{a.patient_name}</Link>
                          <ApptBadge status={a.status} d={d} />
                          {a.visit_type === 'follow_up' && <Badge className="bg-sand-100 text-ink/70 ring-sand-200">{d.cl.visitType.follow_up}</Badge>}
                          {a.insurance_name_ar && <Badge className="bg-teal-50 text-teal-800 ring-teal-200"><ShieldPlus className="h-3 w-3" />{locale === 'ar' ? a.insurance_name_ar : a.insurance_name_en ?? a.insurance_name_ar}</Badge>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-450">
                          <span dir="ltr">{a.file_no}</span>
                          <a href={`tel:${a.patient_phone}`} className="inline-flex items-center gap-1 hover:text-brand"><Phone className="h-3 w-3" /><span dir="ltr">{a.patient_phone}</span></a>
                          <span className="inline-flex items-center gap-1"><ClinicIcon name={a.clinic_icon} className="h-3.5 w-3.5" />{locale === 'ar' ? a.doctor_name_ar : a.doctor_name_en ?? a.doctor_name_ar}</span>
                          {a.status === 'checked_in' && a.waiting_minutes !== null && <span className="inline-flex items-center gap-1 text-amber-700"><Hourglass className="h-3 w-3" />{fmt(d.cl.f.waited, { n: Math.round(Number(a.waiting_minutes)) })}</span>}
                          {a.source === 'online' && <span className="text-sky-700">{d.cl.source.online}</span>}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {due > 0 && a.invoice_id && (
                          <Link href={`/billing/invoices/${a.invoice_id}`} className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700">
                            <Wallet className="h-3.5 w-3.5" />{k.collect} <Money v={due} l={locale} />
                          </Link>
                        )}
                        <DeskRowActions id={a.id} status={a.status} past={past} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* doctors' load */}
        <aside className="space-y-3">
          <Card>
            <div className="border-b border-sand-100 px-4 py-3 text-sm font-semibold">{d.cl.adm.byDoctorToday}</div>
            <ul className="divide-y divide-sand-100">
              {((load ?? []) as Load[]).map((l) => (
                <li key={l.doctor_id}>
                  <Link href={q({ doctor: sp.doctor === l.doctor_id ? undefined : l.doctor_id })}
                    className={cx('flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-sand-50', sp.doctor === l.doctor_id && 'bg-brand/[.05]')}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{locale === 'ar' ? l.doctor_name_ar : l.doctor_name_en ?? l.doctor_name_ar}</div>
                      <div className="truncate text-xs text-stone-450">{locale === 'ar' ? l.clinic_name_ar : l.clinic_name_en}</div>
                    </div>
                    <div className="flex items-center gap-1 text-xs tabular-nums">
                      {l.now_serving ? <span className="rounded-md bg-violet-50 px-1.5 py-0.5 font-semibold text-violet-800">#{l.now_serving}</span> : null}
                      <span title={k.waiting} className={cx('rounded-md px-1.5 py-0.5', l.waiting ? 'bg-amber-50 font-semibold text-amber-800' : 'text-stone-450')}>{l.waiting}</span>
                      <span title={k.done} className="inline-flex items-center gap-0.5 text-emerald-700"><UserRoundCheck className="h-3 w-3" />{l.done}/{l.total}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
