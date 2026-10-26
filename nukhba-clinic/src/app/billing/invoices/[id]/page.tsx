import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Printer, ShieldPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile, getI18n } from '@/lib/session';
import { getServices } from '@/lib/clinic-data';
import { fmt } from '@/lib/i18n';
import { ClaimBadge, InvoiceBadge, Money, PatientLine } from '@/components/clinic-ui';
import { Badge, Card, CardHeader, EmptyState, KeyValue, PageHeader, buttonClass, cx } from '@/components/ui';
import { fmtDate, fmtDateTime } from '@/lib/format';
import type { Invoice, Patient } from '@/lib/types';
import {
  AddItemForm, CancelInvoiceForm, ClaimForm, IssueButton, PaymentForm, RemoveItem, TermsForm, VoidPaymentForm,
} from '../../billing-client';

type Item = { id: string; description: string; qty: number; unit_price: number; line_total: number; lab_order_id: string | null };
type Pay = { id: string; receipt_no: string; amount: number; method: string; reference: string | null; received_at: string; voided_at: string | null; void_reason: string | null; profiles: { full_name: string } | null };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ d, locale }, supabase, me, services] = await Promise.all([getI18n(), createClient(), getCurrentProfile(), getServices()]);
  const { data } = await supabase.from('invoices').select('*, invoice_items(*), payments(*, profiles:received_by(full_name)), insurance_companies(name_ar, name_en, requires_approval)').eq('id', id).maybeSingle();
  if (!data) notFound();
  const inv = data as Invoice & { invoice_items: Item[]; payments: Pay[]; insurance_companies: { name_ar: string; name_en: string | null; requires_approval: boolean } | null };
  const [{ data: p }, { data: appt }] = await Promise.all([
    supabase.from('patients').select('*').eq('id', inv.patient_id).single(),
    inv.appointment_id ? supabase.from('appointment_overview').select('ref_no, starts_at, doctor_name_ar, doctor_name_en, clinic_name_ar, clinic_name_en').eq('id', inv.appointment_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const patient = p as Patient;
  const fin = me?.role === 'admin' || me?.role === 'accountant';
  const b = d.cl.bill;
  const iv = d.cl.inv;
  const balance = Math.max(0, Number(inv.patient_amount) - Number(inv.paid_amount));
  const closed = inv.status === 'cancelled';
  const hasPay = Number(inv.paid_amount) > 0;
  const insValid = !!patient.insurance_company_id && (!patient.insurance_expiry || patient.insurance_expiry >= new Date().toISOString().slice(0, 10));
  const sums: [string, number, string?][] = [
    [iv.subtotal, inv.subtotal], ...(Number(inv.discount) ? [[iv.discount, -Number(inv.discount)] as [string, number]] : []),
    [Number(inv.vat_rate) ? fmt(iv.vat, { r: Number(inv.vat_rate) }) : iv.vatExempt, inv.vat_amount], [iv.total, inv.total, 'font-semibold border-t border-sand-200 pt-2'],
    ...(inv.payer === 'insurance' ? [[iv.insShare, inv.insurance_amount, 'text-teal-800'] as [string, number, string]] : []),
    [iv.ptShare, inv.patient_amount, 'font-semibold'], [iv.paid, inv.paid_amount, 'text-emerald-700'],
  ];

  return (
    <div>
      <PageHeader
        eyebrow={<span dir="ltr">{inv.inv_no}</span>}
        title={<span className="flex flex-wrap items-center gap-3">{patient.full_name}<InvoiceBadge status={inv.status} d={d} /></span>}
        subtitle={<><Link href={`/reception/patients/${patient.id}`} className="hover:text-brand"><PatientLine p={patient} d={d} /></Link>{appt ? <> · {locale === 'ar' ? appt.doctor_name_ar : appt.doctor_name_en ?? appt.doctor_name_ar} · {fmtDate(appt.starts_at, locale)}</> : null}</>}
        actions={<>
          {inv.status === 'draft' && !closed && <IssueButton invoiceId={inv.id} />}
          {inv.status !== 'draft' && <Link href={`/print/invoice/${inv.id}`} target="_blank" className={buttonClass('outline')}><Printer className="h-4 w-4" />{b.printInvoice}</Link>}
        </>}
      />
      {closed && <p className="mb-4 rounded-xl bg-stone-100 p-3 text-sm text-stone-600">{d.cl.invs.cancelled}{inv.cancel_reason ? ` — ${inv.cancel_reason}` : ''}</p>}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title={iv.items} />
            {inv.invoice_items.length === 0 ? <EmptyState title={d.common.noData} /> : (
              <table className="w-full text-sm">
                <thead className="bg-sand-50 text-xs text-stone-450">
                  <tr><th className="px-5 py-2.5 text-start font-medium">{iv.item}</th><th className="px-3 py-2.5 font-medium">{iv.qty}</th><th className="px-3 py-2.5 text-end font-medium">{iv.price}</th><th className="px-5 py-2.5 text-end font-medium">{d.cl.f.total}</th><th className="w-8" /></tr>
                </thead>
                <tbody className="divide-y divide-sand-100">
                  {inv.invoice_items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-5 py-2.5">{it.description}{it.lab_order_id && <Badge className="ms-2 bg-sand-100 text-ink/60 ring-sand-200">{d.cl.testKind.lab}</Badge>}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{Number(it.qty)}</td>
                      <td className="px-3 py-2.5 text-end"><Money v={it.unit_price} l={locale} /></td>
                      <td className="px-5 py-2.5 text-end font-medium"><Money v={it.line_total} l={locale} /></td>
                      <td className="pe-3">{!closed && !hasPay && <RemoveItem id={it.id} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!closed && <div className="p-4"><AddItemForm invoiceId={inv.id} services={services.filter((s) => s.kind !== 'consultation' && s.kind !== 'follow_up')} finance={fin} /></div>}
          </Card>

          <Card>
            <CardHeader title={iv.payments} />
            {inv.payments.length === 0 ? <EmptyState title={d.common.noData} /> : (
              <ul className="divide-y divide-sand-100">
                {inv.payments.map((x) => (
                  <li key={x.id} className={cx('px-5 py-3 text-sm', x.voided_at && 'opacity-60')}>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-xs" dir="ltr">{x.receipt_no}</span>
                      <span>{d.cl.method[x.method as keyof typeof d.cl.method]}</span>
                      {x.reference && <span className="text-xs text-stone-450" dir="ltr">{x.reference}</span>}
                      <span className="text-xs text-stone-450">{fmtDateTime(x.received_at, locale)} · {x.profiles?.full_name}</span>
                      <Money v={x.amount} l={locale} className={cx('ms-auto font-semibold', x.voided_at && 'line-through')} />
                    </div>
                    {x.voided_at ? <div className="mt-1 text-xs text-rose-700">{b.voided}: {x.void_reason}</div> : fin && <VoidPaymentForm id={x.id} />}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <div className="space-y-1.5 text-sm">
              {sums.map(([label, v, cls]) => (
                <div key={label} className={cx('flex items-center justify-between', cls)}><span>{label}</span><Money v={v} l={locale} /></div>
              ))}
              <div className="flex items-center justify-between rounded-xl bg-brand px-3 py-2.5 text-white"><span>{iv.balance}</span><Money v={balance} l={locale} className="text-lg font-bold" /></div>
            </div>
          </Card>
          {!closed && balance > 0 && (
            <Card className="p-5">
              <h3 className="mb-3 font-semibold">{b.pay}</h3>
              <PaymentForm invoiceId={inv.id} balance={balance} />
            </Card>
          )}
          <Card className="p-5">
            <h3 className="mb-3 font-semibold">{b.terms}</h3>
            {inv.payer === 'insurance' && (
              <div className="mb-3 rounded-xl bg-teal-50 p-3 text-sm text-teal-900">
                <div className="flex items-center gap-1.5 font-medium"><ShieldPlus className="h-4 w-4" />{locale === 'ar' ? inv.insurance_companies?.name_ar : inv.insurance_companies?.name_en ?? inv.insurance_companies?.name_ar}</div>
                <div className="text-xs">{fmt(iv.coverage, { p: Number(inv.coverage_percent) })}{inv.max_copay ? ` · ${fmt(iv.cap, { a: Number(inv.max_copay) })}` : ''}</div>
              </div>
            )}
            {!closed ? (
              <TermsForm invoiceId={inv.id} payer={inv.payer} discount={Number(inv.discount)} approvalNo={inv.approval_no} notes={inv.notes} hasInsurance={insValid} finance={fin} locked={hasPay} />
            ) : (
              <div className="divide-y divide-sand-100 text-sm"><KeyValue label={b.payer}>{d.cl.payer[inv.payer]}</KeyValue></div>
            )}
          </Card>
          {inv.payer === 'insurance' && inv.status !== 'draft' && !closed && (
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{b.claims}</h3><ClaimBadge status={inv.claim_status} d={d} /></div>
              {inv.claim_approved_amount !== null && <div className="mb-2 text-sm">{b.approvedAmount}: <Money v={inv.claim_approved_amount} l={locale} className="font-semibold" /></div>}
              {inv.claim_note && <p className="mb-2 text-xs text-stone-450">{inv.claim_note}</p>}
              {fin && <ClaimForm invoiceId={inv.id} status={inv.claim_status} insuranceAmount={Number(inv.insurance_amount)} />}
            </Card>
          )}
          {fin && !closed && !hasPay && <div className="text-center"><CancelInvoiceForm invoiceId={inv.id} /></div>}
        </aside>
      </div>
    </div>
  );
}
