'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { act, must, numOrNull, str, strOrNull, UserError } from '@/lib/actions';
import type { ActionResult } from '@/lib/types';

const refresh = () => revalidatePath('/', 'layout');

export async function createInvoice(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let id: string | null = null;
  const res = await act(async (d) => {
    if (!str(fd, 'patient_id')) throw new UserError(d.errors.PATIENT_REQUIRED);
    const supabase = await createClient();
    id = must(await supabase.rpc('create_invoice', { p_patient: str(fd, 'patient_id') })) as string;
  });
  if (id && !res?.error) redirect(`/billing/invoices/${id}`);
  return res;
}

export async function addInvoiceItem(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('add_invoice_item', {
      p_invoice: str(fd, 'invoice_id'), p_service: strOrNull(fd, 'service_id'), p_description: strOrNull(fd, 'description'),
      p_qty: numOrNull(fd, 'qty') ?? 1, p_price: numOrNull(fd, 'price'),
    }));
    refresh();
    return { ok: true };
  });
}

export async function removeInvoiceItem(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_invoice_item', { p_item: id });
  refresh();
  return error ? { error: error.message } : { ok: true };
}

export async function setInvoiceTerms(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('set_invoice_terms', {
      p_invoice: str(fd, 'invoice_id'), p_payer: str(fd, 'payer'), p_discount: numOrNull(fd, 'discount') ?? 0,
      p_approval_no: strOrNull(fd, 'approval_no'), p_notes: strOrNull(fd, 'notes'),
    }));
    refresh();
  });
}

export async function issueInvoice(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('issue_invoice', { p_invoice: str(fd, 'invoice_id') }));
    refresh();
  });
}

export async function recordPayment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const amount = numOrNull(fd, 'amount');
    if (!amount || amount <= 0) throw new UserError(d.errors.INVALID_PAYMENT_AMOUNT);
    const supabase = await createClient();
    must(await supabase.rpc('record_payment', {
      p_invoice: str(fd, 'invoice_id'), p_amount: amount, p_method: str(fd, 'method'), p_reference: strOrNull(fd, 'reference'),
    }));
    refresh();
    return { ok: true };
  });
}

export async function voidPayment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('void_payment', { p_payment: str(fd, 'id'), p_reason: str(fd, 'reason') }));
    refresh();
  });
}

export async function cancelInvoice(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('cancel_invoice', { p_invoice: str(fd, 'invoice_id'), p_reason: str(fd, 'reason') }));
    refresh();
  });
}

export async function updateClaim(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('update_claim', {
      p_invoice: str(fd, 'invoice_id'), p_status: str(fd, 'claim_status'), p_approved: numOrNull(fd, 'approved'), p_note: strOrNull(fd, 'note'),
    }));
    refresh();
  });
}

/** Bulk: submit every pending claim of one insurer */
export async function submitPendingClaims(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    const { data } = await supabase.from('invoices').select('id').eq('insurance_company_id', str(fd, 'insurer_id'))
      .eq('payer', 'insurance').eq('claim_status', 'pending').not('status', 'in', '(draft,cancelled)');
    for (const r of data ?? []) must(await supabase.rpc('update_claim', { p_invoice: r.id, p_status: 'submitted' }));
    refresh();
    return { ok: true };
  });
}

// ------------------------------------------------------------------ insurers & price list (finance; RLS enforces)
export async function saveInsurer(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    if (!str(fd, 'name_ar')) throw new UserError(d.errors.REQUIRED);
    const cov = numOrNull(fd, 'coverage_percent');
    if (cov === null || cov < 0 || cov > 100) throw new UserError(d.errors.INVALID_INPUT);
    const row = {
      name_ar: str(fd, 'name_ar'), name_en: strOrNull(fd, 'name_en'), code: strOrNull(fd, 'code')?.toUpperCase() ?? null,
      coverage_percent: cov, max_copay: numOrNull(fd, 'max_copay'), requires_approval: fd.get('requires_approval') === 'on',
      phone: strOrNull(fd, 'phone'), email: strOrNull(fd, 'email'), is_active: fd.has('is_active') ? fd.get('is_active') === 'on' : true,
    };
    const supabase = await createClient();
    const id = str(fd, 'id');
    must(id ? await supabase.from('insurance_companies').update(row).eq('id', id) : await supabase.from('insurance_companies').insert(row));
    refresh();
    return { ok: true };
  });
}

export async function saveService(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    if (!str(fd, 'name_ar') || !str(fd, 'code')) throw new UserError(d.errors.REQUIRED);
    const price = numOrNull(fd, 'price');
    if (price === null || price < 0) throw new UserError(d.errors.INVALID_INPUT);
    const row = {
      code: str(fd, 'code').toUpperCase(), name_ar: str(fd, 'name_ar'), name_en: strOrNull(fd, 'name_en'),
      kind: ['procedure', 'lab', 'radiology', 'other'].includes(str(fd, 'kind')) ? str(fd, 'kind') : 'procedure',
      clinic_id: strOrNull(fd, 'clinic_id'), price, is_active: fd.has('is_active') ? fd.get('is_active') === 'on' : true,
    };
    const supabase = await createClient();
    const id = str(fd, 'id');
    must(id ? await supabase.from('services').update(row).eq('id', id) : await supabase.from('services').insert(row));
    refresh();
    return { ok: true };
  });
}
