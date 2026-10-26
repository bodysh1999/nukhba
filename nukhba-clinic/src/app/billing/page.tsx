import Link from 'next/link';
import { Banknote, FilePlus2, Landmark, ReceiptText, ShieldPlus, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, getI18n } from '@/lib/session';
import { ClaimBadge, InvoiceBadge, Money } from '@/components/clinic-ui';
import { Card, EmptyState, Input, LinkButton, PageHeader, Select, StatCard, buttonClass } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import type { Invoice, InvoiceStatus } from '@/lib/types';

export const metadata = { title: 'الفواتير' };
const STATUSES: InvoiceStatus[] = ['draft', 'issued', 'partially_paid', 'paid', 'cancelled'];
type Row = Invoice & { patients: { full_name: string; file_no: string } | null; insurance_companies: { name_ar: string; name_en: string | null } | null };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string; payer?: string; from?: string; to?: string; q?: string }> }) {
  const sp = await searchParams;
  const [{ d, locale }, supabase, me] = await Promise.all([getI18n(), createClient(), getCurrentProfile()]);
  const b = d.cl.bill;
  const fin = me?.role === 'admin' || me?.role === 'accountant';
  let q = supabase.from('invoices').select('*, patients!inner(full_name, file_no), insurance_companies(name_ar, name_en)').order('created_at', { ascending: false }).limit(150);
  if (sp.status && STATUSES.includes(sp.status as InvoiceStatus)) q = q.eq('status', sp.status);
  else if (!sp.status) q = q.neq('status', 'cancelled');
  if (sp.payer === 'self' || sp.payer === 'insurance') q = q.eq('payer', sp.payer);
  if (sp.from) q = q.gte('created_at', `${sp.from}T00:00:00+03:00`);
  if (sp.to) q = q.lte('created_at', `${sp.to}T23:59:59+03:00`);
  const term = (sp.q ?? '').trim().replace(/[,()%*]/g, ' ').trim();
  if (term) q = /^INV/i.test(term) ? q.ilike('inv_no', `%${term}%`) : q.or(`full_name.ilike.%${term}%,file_no.ilike.%${term}%`, { referencedTable: 'patients' });
  const [{ data }, { data: dash }] = await Promise.all([q, supabase.rpc('clinic_dashboard')]);
  const rows = (data ?? []) as Row[];
  const k = (dash ?? {}) as Record<string, number>;
  return (
    <div>
      <PageHeader title={b.invoices} actions={<LinkButton href="/billing/new" variant="accent"><FilePlus2 className="h-4 w-4" />{b.walkIn}</LinkButton>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {fin ? <>
          <StatCard tone="brand" label={b.kpi.today} value={<Money v={k.collected_today} l={locale} />} icon={<Wallet className="h-4 w-4" />} />
          <StatCard label={b.kpi.month} value={<Money v={k.collected_month} l={locale} />} icon={<Banknote className="h-4 w-4" />} />
          <StatCard label={b.kpi.claimsOpen} value={<Money v={k.claims_open_amount} l={locale} />} hint={`${k.claims_open_count ?? 0}`} icon={<ShieldPlus className="h-4 w-4" />} />
          <StatCard label={b.kpi.balance} value={<Money v={k.patient_balance} l={locale} />} hint={`${k.unpaid_count ?? 0} ${b.kpi.unpaid}`} icon={<Landmark className="h-4 w-4" />} tone="warn" />
        </> : <StatCard label={b.kpi.unpaid} value={k.unpaid_count ?? 0} icon={<ReceiptText className="h-4 w-4" />} tone="warn" />}
      </div>
      <form className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_150px_140px_150px_150px_auto]" action="/billing">
        <Input name="q" defaultValue={sp.q} placeholder={b.filters.search} />
        <Select name="status" defaultValue={sp.status ?? ''}><option value="">{b.filters.all}</option>{STATUSES.map((s) => <option key={s} value={s}>{d.cl.invs[s]}</option>)}</Select>
        <Select name="payer" defaultValue={sp.payer ?? ''}><option value="">{b.filters.payer}</option><option value="self">{d.cl.payer.self}</option><option value="insurance">{d.cl.payer.insurance}</option></Select>
        <Input type="date" name="from" defaultValue={sp.from} aria-label={b.filters.from} />
        <Input type="date" name="to" defaultValue={sp.to} aria-label={b.filters.to} />
        <button className={buttonClass('primary')}>{d.common.apply}</button>
      </form>
      <Card className="overflow-x-auto">
        {rows.length === 0 ? <EmptyState icon={<ReceiptText className="h-5 w-5" />} title={d.cl.inv.noInvoices} /> : (
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-sand-50 text-xs text-stone-450">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{d.cl.inv.no}</th>
                <th className="px-4 py-3 text-start font-medium">{d.cl.f.patient}</th>
                <th className="px-4 py-3 text-start font-medium">{b.payer}</th>
                <th className="px-4 py-3 text-end font-medium">{d.cl.inv.total}</th>
                <th className="px-4 py-3 text-end font-medium">{d.cl.inv.ptShare}</th>
                <th className="px-4 py-3 text-end font-medium">{d.cl.inv.balance}</th>
                <th className="px-4 py-3 text-start font-medium">{d.cl.f.status}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {rows.map((i) => (
                <tr key={i.id} className="hover:bg-sand-50">
                  <td className="px-4 py-3"><Link href={`/billing/invoices/${i.id}`} className="font-mono text-xs font-semibold text-brand hover:underline" dir="ltr">{i.inv_no}</Link><div className="text-xs text-stone-450">{fmtDate(i.created_at, locale)}</div></td>
                  <td className="px-4 py-3">{i.patients?.full_name}<div className="text-xs text-stone-450" dir="ltr">{i.patients?.file_no}</div></td>
                  <td className="px-4 py-3">{i.payer === 'insurance' ? <span className="text-teal-800">{locale === 'ar' ? i.insurance_companies?.name_ar : i.insurance_companies?.name_en ?? i.insurance_companies?.name_ar}</span> : d.cl.payer.self}
                    {i.payer === 'insurance' && <div className="mt-0.5"><ClaimBadge status={i.claim_status} d={d} /></div>}</td>
                  <td className="px-4 py-3 text-end"><Money v={i.total} l={locale} /></td>
                  <td className="px-4 py-3 text-end"><Money v={i.patient_amount} l={locale} /></td>
                  <td className="px-4 py-3 text-end font-semibold">{['issued', 'partially_paid'].includes(i.status) ? <Money v={Number(i.patient_amount) - Number(i.paid_amount)} l={locale} className="text-rose-700" /> : '—'}</td>
                  <td className="px-4 py-3"><InvoiceBadge status={i.status} d={d} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
