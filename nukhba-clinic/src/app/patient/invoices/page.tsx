import Link from 'next/link';
import { Printer, ReceiptText, ShieldPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { InvoiceBadge, Money } from '@/components/clinic-ui';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { fmtDate } from '@/lib/format';
import type { Invoice } from '@/lib/types';
import { getMyPatient } from '../data';

export const metadata = { title: 'الفواتير' };

export default async function MyInvoices() {
  const [{ d, locale }, supabase, me] = await Promise.all([getI18n(), createClient(), getMyPatient()]);
  if (!me) return null;
  const { data } = await supabase.from('invoices').select('*').eq('patient_id', me.id).neq('status', 'cancelled').order('created_at', { ascending: false });
  const rows = (data ?? []) as Invoice[];
  const due = rows.reduce((s, i) => s + (['issued', 'partially_paid'].includes(i.status) ? Number(i.patient_amount) - Number(i.paid_amount) : 0), 0);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={d.cl.inv.title} subtitle={due > 0 ? <span className="text-rose-700">{d.cl.inv.due}: <Money v={due} l={locale} /> · {d.cl.pt.payAtDesk}</span> : undefined} />
      {rows.length === 0 ? <Card><EmptyState icon={<ReceiptText className="h-5 w-5" />} title={d.cl.inv.noInvoices} /></Card> : (
        <div className="space-y-3">
          {rows.map((i) => (
            <Link key={i.id} href={`/print/invoice/${i.id}`} target="_blank">
              <Card className="flex items-center gap-4 p-4 transition hover:border-brand/30">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/[.07] text-brand">{i.payer === 'insurance' ? <ShieldPlus className="h-5 w-5" /> : <ReceiptText className="h-5 w-5" />}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs font-semibold" dir="ltr">{i.inv_no}</div>
                  <div className="text-xs text-stone-450">{fmtDate(i.created_at, locale)} · {d.cl.payer[i.payer]}</div>
                </div>
                <div className="text-end">
                  <Money v={i.patient_amount} l={locale} className="font-semibold" />
                  <div className="mt-0.5"><InvoiceBadge status={i.status} d={d} /></div>
                </div>
                <Printer className="h-4 w-4 text-stone-450" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
