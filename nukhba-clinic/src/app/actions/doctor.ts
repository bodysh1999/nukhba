'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { act, must, numOrNull, str, strOrNull, UserError } from '@/lib/actions';
import type { ActionResult } from '@/lib/types';

const refresh = () => revalidatePath('/', 'layout');

export async function startConsultation(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let visit: string | null = null;
  const res = await act(async () => {
    const supabase = await createClient();
    visit = must(await supabase.rpc('start_consultation', { p_id: str(fd, 'id') })) as string;
    refresh();
  });
  if (visit && !res?.error) redirect(`/doctor/visits/${visit}`);
  return res;
}

/** Saves the clinical fields of an open visit (RLS: only the treating doctor, only while open) */
export async function saveVisit(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    const supabase = await createClient();
    const { data, error } = await supabase.from('visits').update({
      bp_systolic: numOrNull(fd, 'bp_systolic'), bp_diastolic: numOrNull(fd, 'bp_diastolic'), pulse: numOrNull(fd, 'pulse'),
      temperature: numOrNull(fd, 'temperature'), resp_rate: numOrNull(fd, 'resp_rate'), spo2: numOrNull(fd, 'spo2'),
      weight_kg: numOrNull(fd, 'weight_kg'), height_cm: numOrNull(fd, 'height_cm'),
      chief_complaint: strOrNull(fd, 'chief_complaint'), history: strOrNull(fd, 'history'), examination: strOrNull(fd, 'examination'),
      diagnosis: strOrNull(fd, 'diagnosis'), icd10_code: strOrNull(fd, 'icd10_code')?.toUpperCase() ?? null, plan: strOrNull(fd, 'plan'),
      patient_advice: strOrNull(fd, 'patient_advice'), follow_up_in_days: numOrNull(fd, 'follow_up_in_days'),
    }).eq('id', str(fd, 'id')).select('id');
    if (error) throw new Error(error.message.includes('check constraint') ? 'INVALID_INPUT' : error.message);
    if (!data?.length) throw new UserError(d.errors.FORBIDDEN);
    if (fd.has('private_note')) must(await supabase.rpc('save_private_note', { p_visit: str(fd, 'id'), p_body: str(fd, 'private_note') }));
    refresh();
    if (str(fd, 'then') === 'sign') {
      must(await supabase.rpc('complete_visit', { p_visit: str(fd, 'id') }));
      refresh();
      return { ok: true, message: d.cl.dr.signed };
    }
    return { ok: true, message: d.cl.dr.saved };
  });
}

export async function reopenVisit(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('reopen_visit', { p_visit: str(fd, 'id'), p_reason: str(fd, 'reason') }));
    refresh();
  });
}

export async function addRx(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async (d) => {
    if (str(fd, 'drug_name').length < 2) throw new UserError(d.errors.REQUIRED);
    const supabase = await createClient();
    must(await supabase.from('prescription_items').insert({
      visit_id: str(fd, 'visit_id'), drug_name: str(fd, 'drug_name'), dose: strOrNull(fd, 'dose'), frequency: strOrNull(fd, 'frequency'),
      duration: strOrNull(fd, 'duration'), route: strOrNull(fd, 'route'), instructions: strOrNull(fd, 'instructions'),
    }));
    refresh();
    return { ok: true };
  });
}

export async function removeRx(id: string) {
  const supabase = await createClient();
  await supabase.from('prescription_items').delete().eq('id', id);
  refresh();
}

export async function orderTest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('order_test', { p_visit: str(fd, 'visit_id'), p_service: strOrNull(fd, 'service_id'), p_test_name: strOrNull(fd, 'test_name') }));
    refresh();
    return { ok: true };
  });
}

export async function cancelTest(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_test', { p_order: id });
  refresh();
  return error ? { error: error.message } : { ok: true };
}

export async function recordResult(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('record_test_result', {
      p_order: str(fd, 'id'), p_text: str(fd, 'result_text'), p_flag: str(fd, 'result_flag') || 'normal', p_file: strOrNull(fd, 'result_file'),
    }));
    refresh();
  });
}

export async function issueDocument(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('issue_medical_document', {
      p_visit: str(fd, 'visit_id'), p_kind: str(fd, 'kind'), p_from: strOrNull(fd, 'from_date'), p_to: strOrNull(fd, 'to_date'),
      p_body: strOrNull(fd, 'body'), p_referral_to: strOrNull(fd, 'referral_to'),
    }));
    refresh();
    return { ok: true };
  });
}

export async function revokeDocument(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('revoke_medical_document', { p_id: str(fd, 'id') }));
    refresh();
  });
}

export async function updateAlerts(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return act(async () => {
    const supabase = await createClient();
    must(await supabase.rpc('update_patient_alerts', {
      p_patient: str(fd, 'patient_id'), p_allergies: str(fd, 'allergies'), p_chronic: str(fd, 'chronic_conditions'), p_meds: str(fd, 'current_medications'),
    }));
    refresh();
  });
}
