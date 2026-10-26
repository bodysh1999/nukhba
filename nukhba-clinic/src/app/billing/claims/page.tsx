import Link from 'next/link';
import { ShieldPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n, requireRole } from '@/lib/session';
import { CLAIM_STATUSES } from '@/lib/constants';
import { ClaimBadge, Money } from '@/components/clinic-ui';
import { Card, CardHeader, EmptyState, PageHeader, Select, buttonClass, cx } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import type { ClaimStatus, Invoice } from '@/lib/types';
import { ClaimForm, SubmitAllClaims } from '../billing-client';

export const metadata = { title: 'مطالبات التأمين' };
type Row = Invoice & { patients: { full_name: string; file_no: string; insurance_member_no: string | null } | null };

export default async function ClaimsPage({ searchParams }: { searchParams: Promise<{ insurer?: string; status?: string }> }) {
  await requireRole(['admin', 'accountant']);
  const sp = await searchParams;
  const [{ d, locale }, supabase] = await Promise.all([getI18n(), createClient()]);
  const b = d.cl.bill;
  const [{ data: insurers }, { data: agg }] = await Promise.all([
    supabase.from('insurance_companies').select('id, name_ar, name_en').order('name_ar'),
    supabase.from('invoices').select('insurance_company_id, claim_status, insurance_amount').eq('payer', 'insurance').not('status', 'in', '(draft,cancelled)').limit(10000),
  ]);
  const stats = new Map<string, { open: number; amount: number; pending: number; rejected: number }>();
  for (const r of agg ?? []) {
    const s = stats.get(r.insurance_company_id) ?? { open: 0, amount: 0, pending: 0, rejected: 0 };
    if (['pending', 'submitted'].includes(r.claim_status)) { s.open++; s.amount += Number(r.insurance_amount); }
    if (r.claim_status === 'pending') s.pending++;
    if (r.claim_status === 'rejected') s.rejected++;
    stats.set(r.insurance_company_id, s);
  }
  const status = (CLAIM_STATUSES as string[]).includes(sp.status ?? '') ? sp.status! : 'open';
  let q = supabase.from('invoices').select('*, patients(full_name, file_no, insurance_member_no)').eq('payer', 'insurance').not('status', 'in', '(draft,cancelled)')
    .order('created_at', { ascending: true }).limit(80);
  q = status === 'open' ? q.in('claim_status', ['pending', 'submitted']) : q.eq('claim_status', status);
  if (sp.insurer) q = q.eq('insurance_company_id', sp.insurer);
  const { data } = await q;
  const rows = (data ?? []) as Row[];
  const link = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ insurer: sp.insurer, status: sp.status, ...extra }).filter(([, v]) => v) as [string, string][]);
    return `/billing/claims${p.toString() ? `?${p}` : ''}`;
  };
  const days = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400e3);
  return (
    <div>
      <PageHeader title={b.claims} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(insurers ?? []).map((i) => {
          const s = stats.get(i.id) ?? { open: 0, amount: 0, pending: 0, rejected: 0 };
          return (
            <Card key={i.id} className={cx('p-4', sp.insurer === i.id && 'ring-2 ring-brand')}>
              <Link href={link({ insurer: sp.insurer === i.id ? undefined : i.id })} className="flex items-center gap-2 font-semibold hover:text-brand"><ShieldPlus className="h-4 w-4 text-teal-700" />{locale === 'ar' ? i.name_ar : i.name_en ?? i.name_ar}</Link>
              <div className="mt-2 flex items-end justify-between">
                <div><div className="text-xs text-stone-450">{b.amountOpen} · {s.open}</div><Money v={s.amount} l={locale} className="text-lg font-semibold" /></div>
                <div className="text-end text-xs text-stone-450">{b.rejectedN}: {s.rejected}</div>
              </div>
              <div className="mt-3"><SubmitAllClaims insurerId={i.id} count={s.pending} /></div>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader title={sp.insurer ? (insurers ?? []).find((i) => i.id === sp.insurer)?.name_ar ?? '' : b.claimsBy}
          action={
            <form action="/billing/claims" className="flex gap-2">
              {sp.insurer && <input type="hidden" name="insurer" value={sp.insurer} />}
              <Select name="status" defaultValue={status} className="h-9 w-44 text-sm">
                <option value="open">{b.open}</option>
                {CLAIM_STATUSES.map((s) => <option key={s} value={s}>{d.cl.claim[s]}</option>)}
              </Select>
              <button className={buttonClass('outline', 'sm', 'h-9')}>{d.common.apply}</button>
            </form>
          } />
        {rows.length === 0 ? <EmptyState icon={<ShieldPlus className="h-5 w-5" />} title={d.common.noData} /> : (
          <ul className="divide-y divide-sand-100">
            {rows.map((r) => (
              <li key={r.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto_220px] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/billing/invoices/${r.id}`} className="font-mono text-xs font-semibold text-brand" dir="ltr">{r.inv_no}</Link>
                    <span className="font-medium">{r.patients?.full_name}</span>
                    <ClaimBadge status={r.claim_status as ClaimStatus} d={d} />
                  </div>
                  <div className="mt-0.5 text-xs text-stone-450">
                    {fmtDate(r.created_at, locale)} · {b.daysOld}: {days(r.created_at)} {d.common.days}
                    {r.patients?.insurance_member_no && <> · <span dir="ltr">{r.patients.insurance_member_no}</span></>}
                    {r.approval_no && <> · {b.approvalNo}: <span dir="ltr">{r.approval_no}</span></>}
                  </div>
                  {r.claim_note && <div className="mt-1 text-xs text-rose-700">{r.claim_note}</div>}
                </div>
                <div className="text-end"><Money v={r.insurance_amount} l={locale} className="font-semibold" />{r.claim_approved_amount !== null && <div className="text-xs text-stone-450">{b.approvedAmount}: <Money v={r.claim_approved_amount} l={locale} /></div>}</div>
                <ClaimForm invoiceId={r.id} status={r.claim_status as ClaimStatus} insuranceAmount={Number(r.insurance_amount)} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
