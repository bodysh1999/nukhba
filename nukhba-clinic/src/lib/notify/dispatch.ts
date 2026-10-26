import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { getDict, fmt } from '@/lib/i18n';
import type { Locale } from '@/lib/types';
import { anyProviderConfigured, send, type Channel } from './providers';

type Claimed = {
  outbox_id: string; channel: Channel; type: string; appointment_id: string | null; payload: Record<string, unknown>;
  phone: string | null; email: string | null; full_name: string | null; locale: string | null; role: string | null;
};

function siteUrl() {
  const u = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  return u.replace(/\/$/, '');
}

/** In-app link for the person receiving the message */
function linkFor(n: Claimed) {
  const base = siteUrl();
  if (!base) return '';
  if (typeof n.payload?.link === 'string' && n.payload.link.startsWith('/')) return base + n.payload.link;
  if (!n.appointment_id) return base;
  if (n.role === 'patient') return `${base}/patient/appointments/${n.appointment_id}`;
  if (n.role === 'doctor') return `${base}/doctor`;
  return `${base}/reception`;
}

export function messageFor(n: Pick<Claimed, 'type' | 'payload' | 'locale' | 'full_name'> & Partial<Claimed>, company: string) {
  const locale = (n.locale === 'en' ? 'en' : 'ar') as Locale;
  const d = getDict(locale);
  const p = n.payload ?? {};
  const tpl = (d.cl.notif as Record<string, string>)[n.type] ?? (d.notif as Record<string, string>)[n.type] ?? n.type;
  const extra: string[] = [];
  if (typeof p.when === 'string') {
    extra.push(new Date(p.when).toLocaleString(locale === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB',
      { timeZone: 'Asia/Riyadh', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }));
  }
  if (typeof p.note === 'string' && p.note) extra.push(p.note);
  const body = fmt(tpl, {
    ref: p.ref_no ?? p.ref ?? '', name: p.name ?? '', doctor: p.doctor ?? '', queue: p.queue_no ?? '', room: p.room ?? p.clinic ?? '',
    level: p.level ?? '', count: p.count ?? '', score: p.score ?? '', title: p.title ?? '', days: p.days ?? '', date: p.date ?? '',
  }).replace(/\s+/g, ' ').trim();
  const link = n.outbox_id !== undefined ? linkFor(n as Claimed) : '';
  const text = [`${company}: ${body}`, ...extra.filter(Boolean), link].filter(Boolean).join('\n');
  return { text, subject: `${company} — ${body}` };
}

let draining = false;

/** Sends what is waiting in the outbox. Safe to call often: it does nothing when no provider is configured. */
export async function drainOutbox(limit = 20): Promise<{ sent: number; failed: number }> {
  const result = { sent: 0, failed: 0 };
  if (!anyProviderConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY || draining) return result;
  draining = true;
  try {
    const admin = createAdminClient();
    const [{ data: rows, error }, { data: s }] = await Promise.all([
      admin.rpc('claim_outbox', { p_limit: limit }),
      admin.from('company_settings').select('name_ar, name_en').eq('id', 1).maybeSingle(),
    ]);
    if (error) { console.error('[notify] claim', error.message); return result; }
    for (const n of (rows ?? []) as Claimed[]) {
      const company = (n.locale === 'en' ? s?.name_en : s?.name_ar)?.split(' ').slice(0, 2).join(' ') || 'Clinic';
      const to = n.channel === 'email' ? n.email : n.phone;
      if (!to) { await admin.rpc('finish_outbox', { p_id: n.outbox_id, p_status: 'skipped', p_error: 'NO_CONTACT' }); continue; }
      const msg = messageFor(n, company);
      const r = await send(n.channel, { to, ...msg });
      if (r.ok) result.sent++; else result.failed++;
      await admin.rpc('finish_outbox', {
        p_id: n.outbox_id,
        p_status: r.ok ? 'sent' : r.permanent ? 'skipped' : 'failed',
        p_error: r.ok ? null : r.error,
      });
    }
  } catch (e) {
    console.error('[notify]', (e as Error).message);
  } finally {
    draining = false;
  }
  return result;
}
