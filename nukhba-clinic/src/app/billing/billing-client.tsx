'use client';

import { useState, useTransition } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { ActionForm, SubmitButton, useI18n } from '@/components/client';
import { Field, Input, Select, Textarea, buttonClass, cx } from '@/components/ui';
import {
  addInvoiceItem, cancelInvoice, issueInvoice, recordPayment, removeInvoiceItem, saveInsurer, saveService, setInvoiceTerms,
  submitPendingClaims, updateClaim, voidPayment,
} from '@/app/actions/billing';
import { translateError } from '@/lib/i18n';
import { CLAIM_STATUSES, PAY_METHODS } from '@/lib/constants';
import type { ClaimStatus, Insurer, Service } from '@/lib/types';

export function RemoveItem({ id }: { id: string }) {
  const { d } = useI18n();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button type="button" disabled={pending} aria-label={d.common.delete} className="text-stone-450 hover:text-rose-600"
        onClick={() => start(async () => { const r = await removeInvoiceItem(id); if (r.error) setErr(translateError(d, r.error)); })}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </button>
      {err && <span className="text-xs text-rose-700">{err}</span>}
    </>
  );
}

export function AddItemForm({ invoiceId, services, finance }: { invoiceId: string; services: Pick<Service, 'id' | 'name_ar' | 'name_en' | 'kind' | 'price'>[]; finance: boolean }) {
  const { d, locale } = useI18n();
  const b = d.cl.bill;
  const [custom, setCustom] = useState(false);
  const kinds = ['procedure', 'lab', 'radiology', 'other'] as const;
  return (
    <ActionForm action={addInvoiceItem} resetOnSuccess className="flex flex-wrap items-end gap-2 rounded-xl bg-sand-50 p-3">
      <input type="hidden" name="invoice_id" value={invoiceId} />
      {!custom ? (
        <Field label={b.service} className="min-w-0 flex-1">
          <Select name="service_id" required defaultValue="">
            <option value="" disabled>—</option>
            {kinds.map((k) => (
              <optgroup key={k} label={d.cl.serviceKind[k]}>
                {services.filter((s) => s.kind === k).map((s) => <option key={s.id} value={s.id}>{locale === 'ar' ? s.name_ar : s.name_en ?? s.name_ar} · {s.price}</option>)}
              </optgroup>
            ))}
          </Select>
        </Field>
      ) : (
        <>
          <Field label={b.description} className="min-w-0 flex-1"><Input name="description" required /></Field>
          <Field label={d.cl.inv.price} className="w-28"><Input name="price" type="number" step="0.01" min="0" required /></Field>
        </>
      )}
      <Field label={d.cl.inv.qty} className="w-20"><Input name="qty" type="number" step="1" min="1" defaultValue={1} /></Field>
      <SubmitButton><Plus className="h-4 w-4" />{b.addItem}</SubmitButton>
      {finance && <button type="button" onClick={() => setCustom(!custom)} className={buttonClass('ghost')}>{custom ? b.service : b.customItem}</button>}
    </ActionForm>
  );
}

export function TermsForm({ invoiceId, payer, discount, approvalNo, notes, hasInsurance, finance, locked }: {
  invoiceId: string; payer: 'self' | 'insurance'; discount: number; approvalNo: string | null; notes: string | null; hasInsurance: boolean; finance: boolean; locked: boolean;
}) {
  const { d } = useI18n();
  const b = d.cl.bill;
  const [p, setP] = useState(payer);
  return (
    <ActionForm action={setInvoiceTerms} className="space-y-3">
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <div className="grid grid-cols-2 gap-2">
        {(['self', 'insurance'] as const).map((x) => (
          <label key={x} className={cx('flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm', p === x ? 'border-brand bg-brand/[.06] font-semibold text-brand' : 'border-sand-200', (locked || (x === 'insurance' && !hasInsurance)) && 'pointer-events-none opacity-50')}>
            <input type="radio" name="payer" value={x} checked={p === x} onChange={() => setP(x)} className="sr-only" />{d.cl.payer[x]}
          </label>
        ))}
      </div>
      {p === 'insurance' && <Field label={b.approvalNo}><Input name="approval_no" dir="ltr" defaultValue={approvalNo ?? ''} /></Field>}
      <Field label={b.discount} hint={!finance ? d.errors.FORBIDDEN : undefined}>
        <Input name="discount" type="number" step="0.01" min="0" defaultValue={discount} readOnly={!finance || locked} />
      </Field>
      <Field label={d.cl.f.notes}><Textarea name="notes" defaultValue={notes ?? ''} className="min-h-[56px]" /></Field>
      <SubmitButton size="sm" variant="outline">{b.saveTerms}</SubmitButton>
    </ActionForm>
  );
}

export function IssueButton({ invoiceId }: { invoiceId: string }) {
  const { d } = useI18n();
  return (
    <ActionForm action={issueInvoice}>
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <SubmitButton variant="primary">{d.cl.bill.issue}</SubmitButton>
    </ActionForm>
  );
}

export function PaymentForm({ invoiceId, balance }: { invoiceId: string; balance: number }) {
  const { d } = useI18n();
  const b = d.cl.bill;
  const [amount, setAmount] = useState(balance.toFixed(2));
  const [method, setMethod] = useState('mada');
  return (
    <ActionForm action={recordPayment} className="space-y-3">
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <input type="hidden" name="method" value={method} />
      <div className="grid grid-cols-3 gap-1.5">
        {PAY_METHODS.map((m) => (
          <button key={m} type="button" onClick={() => setMethod(m)}
            className={cx('h-10 rounded-xl border text-xs font-medium', method === m ? 'border-accent bg-accent text-white' : 'border-sand-200 bg-white')}>{d.cl.method[m]}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input name="amount" type="number" step="0.01" min="0.01" max={balance} value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg font-semibold" />
        <button type="button" onClick={() => setAmount(balance.toFixed(2))} className={buttonClass('ghost', 'md', 'shrink-0 text-xs')}>{b.payFull}</button>
      </div>
      <Input name="reference" placeholder={b.reference} dir="ltr" />
      <SubmitButton variant="accent" size="lg" className="w-full">{b.pay}</SubmitButton>
    </ActionForm>
  );
}

export function VoidPaymentForm({ id }: { id: string }) {
  const { d } = useI18n();
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-xs text-rose-700 hover:underline">{d.cl.bill.void}</button>;
  return (
    <ActionForm action={voidPayment} className="mt-2 flex gap-2">
      <input type="hidden" name="id" value={id} />
      <Input name="reason" required placeholder={d.cl.bill.voidReason} className="h-9 text-sm" />
      <SubmitButton size="sm" variant="danger">{d.common.confirm}</SubmitButton>
    </ActionForm>
  );
}

export function CancelInvoiceForm({ invoiceId }: { invoiceId: string }) {
  const { d } = useI18n();
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={buttonClass('ghost', 'sm', 'text-rose-700')}>{d.cl.bill.cancelInvoice}</button>;
  return (
    <ActionForm action={cancelInvoice} className="flex gap-2">
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <Input name="reason" required placeholder={d.cl.bill.cancelReason} className="h-9 text-sm" />
      <SubmitButton size="sm" variant="danger">{d.common.confirm}</SubmitButton>
    </ActionForm>
  );
}

export function ClaimForm({ invoiceId, status, insuranceAmount }: { invoiceId: string; status: ClaimStatus; insuranceAmount: number }) {
  const { d } = useI18n();
  const b = d.cl.bill;
  const [st, setSt] = useState<ClaimStatus>(status === 'pending' ? 'submitted' : status);
  return (
    <ActionForm action={updateClaim} className="space-y-2">
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <Select name="claim_status" value={st} onChange={(e) => setSt(e.target.value as ClaimStatus)}>
        {CLAIM_STATUSES.map((s) => <option key={s} value={s}>{d.cl.claim[s]}</option>)}
      </Select>
      {st === 'partially_approved' && <Input name="approved" type="number" step="0.01" min="0" max={insuranceAmount} placeholder={b.approvedAmount} required />}
      {(st === 'rejected' || st === 'partially_approved') && <Input name="note" placeholder={b.claimNote} required={st === 'rejected'} />}
      <SubmitButton size="sm" className="w-full">{b.claimUpdate}</SubmitButton>
    </ActionForm>
  );
}

export function SubmitAllClaims({ insurerId, count }: { insurerId: string; count: number }) {
  const { d } = useI18n();
  if (!count) return null;
  return (
    <ActionForm action={submitPendingClaims}>
      <input type="hidden" name="insurer_id" value={insurerId} />
      <SubmitButton size="sm" variant="outline">{d.cl.bill.submitClaim} ({count})</SubmitButton>
    </ActionForm>
  );
}

export function InsurerForm({ insurer }: { insurer?: Insurer }) {
  const { d } = useI18n();
  const b = d.cl.bill;
  return (
    <ActionForm action={saveInsurer} resetOnSuccess={!insurer} className="grid gap-3 sm:grid-cols-3">
      {insurer && <input type="hidden" name="id" value={insurer.id} />}
      <Field label={b.nameAr} required><Input name="name_ar" required defaultValue={insurer?.name_ar} /></Field>
      <Field label={b.nameEn}><Input name="name_en" dir="ltr" defaultValue={insurer?.name_en ?? ''} /></Field>
      <Field label={b.code}><Input name="code" dir="ltr" defaultValue={insurer?.code ?? ''} /></Field>
      <Field label={b.coverage} required><Input name="coverage_percent" type="number" min="0" max="100" step="0.5" required defaultValue={insurer?.coverage_percent ?? 80} /></Field>
      <Field label={b.maxCopay}><Input name="max_copay" type="number" min="0" step="1" defaultValue={insurer?.max_copay ?? ''} /></Field>
      <Field label={d.cl.f.phone}><Input name="phone" defaultValue={insurer?.phone ?? ''} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="requires_approval" defaultChecked={insurer?.requires_approval} className="h-4 w-4 rounded border-sand-300 text-brand" />{b.requiresApproval}</label>
      {insurer && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={insurer.is_active} className="h-4 w-4 rounded border-sand-300 text-brand" />{d.common.active}</label>}
      <div className="sm:col-span-3"><SubmitButton size="sm">{d.common.save}</SubmitButton></div>
    </ActionForm>
  );
}

export function ServiceForm({ service, clinics }: { service?: Service; clinics: { id: string; name_ar: string; name_en: string }[] }) {
  const { d, locale } = useI18n();
  const b = d.cl.bill;
  return (
    <ActionForm action={saveService} resetOnSuccess={!service} className="grid gap-3 sm:grid-cols-6">
      {service && <input type="hidden" name="id" value={service.id} />}
      <Field label={b.code} required className="sm:col-span-1"><Input name="code" dir="ltr" required defaultValue={service?.code} /></Field>
      <Field label={b.nameAr} required className="sm:col-span-2"><Input name="name_ar" required defaultValue={service?.name_ar} /></Field>
      <Field label={b.nameEn} className="sm:col-span-2"><Input name="name_en" dir="ltr" defaultValue={service?.name_en ?? ''} /></Field>
      <Field label={b.price} required className="sm:col-span-1"><Input name="price" type="number" step="0.01" min="0" required defaultValue={service?.price} /></Field>
      <Field label={b.kind} className="sm:col-span-2">
        <Select name="kind" defaultValue={service?.kind ?? 'procedure'}>
          {(['procedure', 'lab', 'radiology', 'other'] as const).map((k) => <option key={k} value={k}>{d.cl.serviceKind[k]}</option>)}
        </Select>
      </Field>
      <Field label={d.cl.f.clinic} className="sm:col-span-2">
        <Select name="clinic_id" defaultValue={service?.clinic_id ?? ''}>
          <option value="">{d.cl.f.allClinics}</option>
          {clinics.map((c) => <option key={c.id} value={c.id}>{locale === 'ar' ? c.name_ar : c.name_en}</option>)}
        </Select>
      </Field>
      {service && <label className="flex items-center gap-2 self-end pb-3 text-sm sm:col-span-1"><input type="checkbox" name="is_active" defaultChecked={service.is_active} className="h-4 w-4 rounded border-sand-300 text-brand" />{d.common.active}</label>}
      <div className="self-end sm:col-span-1"><SubmitButton>{d.common.save}</SubmitButton></div>
    </ActionForm>
  );
}
