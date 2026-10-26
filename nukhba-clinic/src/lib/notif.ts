import { fmt, type Dict } from './i18n';
import { fmtVisit } from './format';
import type { Locale } from './types';

/** Human text for a notification row (clinic types first, then HR / system types) */
export function notifText(d: Dict, type: string, payload: Record<string, unknown>, locale: Locale = 'ar') {
  const tpl = (d.cl.notif as Record<string, string>)[type] ?? (d.notif as Record<string, string>)[type] ?? type;
  const text = fmt(tpl, {
    ref: payload.ref_no ?? payload.ref, doctor: payload.doctor, queue: payload.queue_no, room: payload.room ?? payload.clinic,
    title: payload.title, name: payload.name, count: payload.count, days: payload.days, date: payload.date, from: payload.from, to: payload.to,
    level: payload.level, score: payload.score,
  });
  return payload.when ? `${text} · ${fmtVisit(String(payload.when), locale)}` : text;
}
