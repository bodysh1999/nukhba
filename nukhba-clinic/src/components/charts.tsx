'use client';

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useI18n } from './client';
import { APPT_HEX } from '@/lib/constants';
import type { AppointmentStatus } from '@/lib/types';

const BRAND = 'rgb(var(--brand))';
const ACCENT = 'rgb(var(--accent))';
const GRID = '#E9F1F2';
const AXIS = '#64797E';
const tooltipStyle = { borderRadius: 12, border: '1px solid #DAE6E8', fontSize: 12, fontFamily: 'inherit' };

/** Two series over days: bars for counts, area for money (or counts) */
export function DailyArea({ data, series }: { data: { day: string; [k: string]: number | string }[]; series: { key: string; label: string; color?: 'brand' | 'accent' }[] }) {
  const { locale } = useI18n();
  const rows = data.map((x) => ({ ...x, label: String(x.day).slice(5).replace('-', '/') }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color === 'accent' ? ACCENT : BRAND} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color === 'accent' ? ACCENT : BRAND} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} reversed={locale === 'ar'} minTickGap={16} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} width={44} orientation={locale === 'ar' ? 'right' : 'left'} />
        <Tooltip contentStyle={tooltipStyle} />
        {series.map((s) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color === 'accent' ? ACCENT : BRAND} strokeWidth={2} fill={`url(#g-${s.key})`} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StatusDonut({ data }: { data: { key: AppointmentStatus; count: number }[] }) {
  const { d } = useI18n();
  const rows = data.filter((x) => x.count > 0).map((x) => ({ name: d.cl.status[x.key], value: x.count, color: APPT_HEX[x.key] }));
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!total) return <Empty />;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
              {rows.map((r) => <Cell key={r.name} fill={r.color} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><div className="text-2xl font-semibold tabular-nums">{total}</div></div></div>
      </div>
      <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} /><span className="flex-1 truncate">{r.name}</span><span className="font-semibold tabular-nums">{r.value}</span></li>
        ))}
      </ul>
    </div>
  );
}

export function SimpleBars({ data, color = 'brand', unit }: { data: { key: string; count: number }[]; color?: 'brand' | 'accent'; unit?: string }) {
  const { locale } = useI18n();
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} reversed={locale === 'ar'} />
        <YAxis type="category" dataKey="key" width={130} tick={{ fontSize: 12, fill: '#102A30' }} axisLine={false} tickLine={false} orientation={locale === 'ar' ? 'right' : 'left'} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: GRID }} formatter={(v: unknown) => [`${Number(v).toLocaleString('en-US')}${unit ? ` ${unit}` : ''}`, '']} />
        <Bar dataKey="count" fill={color === 'accent' ? ACCENT : BRAND} radius={[6, 6, 6, 6]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty() {
  const { d } = useI18n();
  return <div className="grid h-40 place-items-center text-sm text-stone-450">{d.common.noData}</div>;
}
