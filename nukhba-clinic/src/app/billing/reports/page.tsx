import { BarChart3, Banknote, CalendarCheck, Clock, Star, UserPlus, UserX } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, requireRole } from '@/lib/session';
import { riyadhDay } from '@/lib/clinic-data';
import { DailyArea, SimpleBars, StatusDonut } from '@/components/charts';
import { ExportExcelButton, PrintPdfButton } from '@/components/export-button';
import { Money } from '@/components/clinic-ui';
import { Card, CardHeader, Input, PageHeader, StatCard, buttonClass } from '@/components/ui';
import type { AppointmentStatus } from '@/lib/types';

export const metadata = { title: 'التقارير' };
type R = {
  appointments: number; completed: number; no_show: number; cancelled: number; new_patients: number; online: number; avg_wait_min: number | null;
  billed: number; vat: number; discounts: number; insurance_billed: number; patient_billed: number; collected: number; rating: number | null;
  by_status: Record<string, number>; by_method: Record<string, number>; daily: { day: string; appointments: number; collected: number }[];
  by_clinic: { name_ar: string; name_en: string; appointments: number; completed: number; no_show: number; billed: number }[];
  by_doctor: { name_ar: string; name_en: string; clinic_ar: string; clinic_en: string; appointments: number; completed: number; no_show: number; avg_wait: number | null; rating: number | null; billed: number }[];
  by_insurer: { name_ar: string; name_en: string; invoices: number; amount: number; approved: number | null; rejected: number; open: number | null }[];
  top_diagnoses: { diagnosis: string; code: string; count: number }[];
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireRole(['admin', 'accountant']);
  const sp = await searchParams;
  const [{ d, locale }, supabase] = await Promise.all([getI18n(), createClient()]);
  const a = d.cl.adm;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? '') ? sp.to! : riyadhDay().day;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? '') ? sp.from! : riyadhDay(-29).day;
  const { data, error } = await supabase.rpc('report_summary', { p_from: from, p_to: to });
  const r = data as R | null;
  const L = locale === 'ar';
  if (!r) return <div><PageHeader title={a.reports} /><Card className="p-6 text-sm text-rose-700">{error?.message}</Card></div>;
  const showRate = r.appointments ? Math.round((r.no_show / Math.max(1, r.completed + r.no_show)) * 1000) / 10 : 0;

  return (
    <div>
      <PageHeader title={a.reports} subtitle={`${from} → ${to}`}
        actions={<>
          <ExportExcelButton filename={`report-${from}-${to}`} sheets={[
            { name: a.byDoctor, rows: r.by_doctor.map((x) => ({ [d.cl.f.doctor]: L ? x.name_ar : x.name_en, [d.cl.f.clinic]: L ? x.clinic_ar : x.clinic_en, [a.appts]: x.appointments, [a.completedN]: x.completed, [a.noShowN]: x.no_show, [a.avgWaitMin]: x.avg_wait, [a.kpi.rating]: x.rating, [a.billed]: Number(x.billed) })) },
            { name: a.byClinic, rows: r.by_clinic.map((x) => ({ [d.cl.f.clinic]: L ? x.name_ar : x.name_en, [a.appts]: x.appointments, [a.completedN]: x.completed, [a.noShowN]: x.no_show, [a.billed]: Number(x.billed) })) },
            { name: a.byInsurer, rows: r.by_insurer.map((x) => ({ [d.cl.f.insurer]: L ? x.name_ar : x.name_en, [a.count]: x.invoices, [a.billed]: Number(x.amount), [a.approved]: Number(x.approved ?? 0), [a.rejected]: x.rejected, [a.openAmt]: Number(x.open ?? 0) })) },
            { name: 'Daily', rows: r.daily.map((x) => ({ [d.cl.f.date]: x.day, [a.appts]: x.appointments, [a.collected]: Number(x.collected) })) },
          ]} />
          <PrintPdfButton />
        </>} />
      <form className="no-print mb-6 flex flex-wrap items-end gap-2" action="/billing/reports">
        <label className="text-xs text-stone-450">{a.from}<Input type="date" name="from" defaultValue={from} className="mt-1 w-44" /></label>
        <label className="text-xs text-stone-450">{a.to}<Input type="date" name="to" defaultValue={to} className="mt-1 w-44" /></label>
        <button className={buttonClass('primary')}>{d.common.apply}</button>
      </form>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard tone="brand" label={a.collected} value={<Money v={r.collected} l={locale} />} icon={<Banknote className="h-4 w-4" />} hint={<>{a.billed}: <Money v={r.billed} l={locale} /></>} />
        <StatCard label={a.appts} value={r.appointments} icon={<CalendarCheck className="h-4 w-4" />} hint={`${a.completedN}: ${r.completed}`} />
        <StatCard label={a.kpi.noShowRate.replace(/\s*\(.*\)/, '')} value={`${showRate}%`} icon={<UserX className="h-4 w-4" />} tone={showRate > 12 ? 'warn' : 'default'} hint={`${r.no_show}`} />
        <StatCard label={a.kpi.rating} value={r.rating ?? '—'} icon={<Star className="h-4 w-4" />} tone="good" />
        <StatCard label={a.insBilled} value={<Money v={r.insurance_billed} l={locale} />} />
        <StatCard label={a.ptBilled} value={<Money v={r.patient_billed} l={locale} />} />
        <StatCard label={a.vat} value={<Money v={r.vat} l={locale} />} hint={<>{a.discounts}: <Money v={r.discounts} l={locale} /></>} />
        <StatCard label={a.kpi.avgWait} value={r.avg_wait_min !== null ? `${r.avg_wait_min} ${d.cl.f.minutes}` : '—'} icon={<Clock className="h-4 w-4" />} hint={<span className="inline-flex items-center gap-1"><UserPlus className="h-3 w-3" />{r.new_patients}</span>} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2"><CardHeader title={a.apptsDaily} /><div className="p-4"><DailyArea data={r.daily} series={[{ key: 'appointments', label: a.appts }]} /></div></Card>
        <Card className="lg:col-span-2"><CardHeader title={a.revenueDaily} /><div className="p-4"><DailyArea data={r.daily} series={[{ key: 'collected', label: a.collected, color: 'accent' }]} /></div></Card>
        <Card><CardHeader title={d.cl.f.status} /><div className="p-5"><StatusDonut data={Object.entries(r.by_status).map(([key, count]) => ({ key: key as AppointmentStatus, count }))} /></div></Card>
        <Card><CardHeader title={a.byMethod} /><div className="p-4"><SimpleBars color="accent" unit={d.common.sar} data={Object.entries(r.by_method).map(([key, count]) => ({ key: d.cl.method[key as keyof typeof d.cl.method] ?? key, count: Number(count) }))} /></div></Card>
        <Card><CardHeader title={a.byClinic} /><div className="p-4"><SimpleBars data={r.by_clinic.map((x) => ({ key: L ? x.name_ar : x.name_en, count: x.appointments }))} /></div></Card>
        <Card><CardHeader title={a.topDx} /><div className="p-4"><SimpleBars color="accent" data={r.top_diagnoses.map((x) => ({ key: `${x.code} ${x.diagnosis}`.slice(0, 28), count: x.count }))} /></div></Card>
      </div>

      <Card className="mt-6 overflow-x-auto">
        <CardHeader title={<span className="flex items-center gap-2"><BarChart3 className="h-4 w-4" />{a.byDoctor}</span>} />
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-sand-50 text-xs text-stone-450"><tr>
            <th className="px-4 py-2.5 text-start font-medium">{d.cl.f.doctor}</th><th className="px-3 py-2.5 font-medium">{a.appts}</th><th className="px-3 py-2.5 font-medium">{a.completedN}</th>
            <th className="px-3 py-2.5 font-medium">{a.noShowN}</th><th className="px-3 py-2.5 font-medium">{a.avgWaitMin}</th><th className="px-3 py-2.5 font-medium">{a.kpi.rating}</th><th className="px-4 py-2.5 text-end font-medium">{a.billed}</th>
          </tr></thead>
          <tbody className="divide-y divide-sand-100">
            {r.by_doctor.map((x) => (
              <tr key={x.name_ar}>
                <td className="px-4 py-2.5"><div className="font-medium">{L ? x.name_ar : x.name_en}</div><div className="text-xs text-stone-450">{L ? x.clinic_ar : x.clinic_en}</div></td>
                <td className="px-3 py-2.5 text-center tabular-nums">{x.appointments}</td><td className="px-3 py-2.5 text-center tabular-nums">{x.completed}</td>
                <td className="px-3 py-2.5 text-center tabular-nums">{x.no_show}</td><td className="px-3 py-2.5 text-center tabular-nums">{x.avg_wait ?? '—'}</td>
                <td className="px-3 py-2.5 text-center tabular-nums">{x.rating ?? '—'}</td><td className="px-4 py-2.5 text-end"><Money v={x.billed} l={locale} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="mt-6 overflow-x-auto">
        <CardHeader title={a.byInsurer} />
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-sand-50 text-xs text-stone-450"><tr>
            <th className="px-4 py-2.5 text-start font-medium">{d.cl.f.insurer}</th><th className="px-3 py-2.5 font-medium">{a.count}</th><th className="px-3 py-2.5 text-end font-medium">{a.billed}</th>
            <th className="px-3 py-2.5 text-end font-medium">{a.approved}</th><th className="px-3 py-2.5 font-medium">{a.rejected}</th><th className="px-4 py-2.5 text-end font-medium">{a.openAmt}</th>
          </tr></thead>
          <tbody className="divide-y divide-sand-100">
            {r.by_insurer.map((x) => (
              <tr key={x.name_ar}>
                <td className="px-4 py-2.5 font-medium">{L ? x.name_ar : x.name_en}</td><td className="px-3 py-2.5 text-center">{x.invoices}</td>
                <td className="px-3 py-2.5 text-end"><Money v={x.amount} l={locale} /></td><td className="px-3 py-2.5 text-end"><Money v={x.approved ?? 0} l={locale} /></td>
                <td className="px-3 py-2.5 text-center">{x.rejected}</td><td className="px-4 py-2.5 text-end"><Money v={x.open ?? 0} l={locale} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
