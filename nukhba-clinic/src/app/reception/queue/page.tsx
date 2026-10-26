import Link from 'next/link';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, getSettings } from '@/lib/session';
import { fmt } from '@/lib/i18n';
import { DEFAULT_LOGO } from '@/components/brand';
import { fmtDay } from '@/components/clinic-ui';
import { LiveRefresh } from '@/components/live';
import { cx } from '@/components/ui';
import { Clock } from './clock';

export const metadata = { title: 'شاشة الانتظار' };
type Row = { clinic_ar: string; clinic_en: string; location_ar: string | null; location_en: string | null; doctor_ar: string; doctor_en: string | null; now_serving: number | null; waiting: number; called_at: string | null };

/** Waiting-room TV: queue numbers only — never patient names */
export default async function QueueScreen() {
  const [{ d, locale }, s, supabase] = await Promise.all([getI18n(), getSettings(), createClient()]);
  const { data } = await supabase.rpc('queue_board');
  const rows = (data ?? []) as Row[];
  const L = locale === 'ar';
  const fresh = (iso: string | null) => !!iso && Date.now() - new Date(iso).getTime() < 90_000;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-brand text-white">
      <LiveRefresh tables={['appointments']} fallbackSeconds={20} />
      <div className="texture-lines absolute inset-0 opacity-40" />
      <header className="relative flex items-center justify-between gap-4 px-6 py-5 sm:px-10">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.logo_url || DEFAULT_LOGO} alt="" className="h-9 w-9" />
          </span>
          <div>
            <div className="font-display text-2xl font-bold">{L ? s.name_ar : s.name_en}</div>
            <div className="text-sm text-white/60">{fmtDay(new Date(), locale)}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="font-display text-4xl font-bold text-accent"><Clock locale={locale} /></div>
          <Link href="/reception" aria-label="close" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"><X className="h-5 w-5" /></Link>
        </div>
      </header>
      <main className="relative grid flex-1 auto-rows-fr gap-4 overflow-hidden p-6 pt-2 sm:grid-cols-2 sm:p-10 sm:pt-2 xl:grid-cols-3">
        {rows.length === 0 && <div className="col-span-full grid place-items-center text-2xl text-white/60">{d.cl.dr.noQueue}</div>}
        {rows.map((r, i) => (
          <section key={i} className={cx('flex flex-col justify-between rounded-3xl p-6 ring-1 transition', fresh(r.called_at) ? 'bg-accent text-white ring-accent shadow-lift' : 'bg-white/[.07] ring-white/10')}>
            <div>
              <div className="text-sm text-white/70">{L ? r.clinic_ar : r.clinic_en} {(L ? r.location_ar : r.location_en) ? `· ${L ? r.location_ar : r.location_en}` : ''}</div>
              <div className="mt-1 text-xl font-semibold">{L ? r.doctor_ar : r.doctor_en ?? r.doctor_ar}</div>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-white/60">{d.cl.desk.nowServing}</div>
                <div className="font-display text-7xl font-bold leading-none tabular-nums">{r.now_serving ?? '—'}</div>
              </div>
              <div className="rounded-full bg-white/10 px-4 py-2 text-sm">{fmt(d.cl.desk.waitingCount, { n: r.waiting })}</div>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
