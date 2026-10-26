import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** PDPL right of access: a machine-readable copy of everything the system holds about the signed-in user */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
  const uid = user.id;
  const pick = async <T,>(q: PromiseLike<{ data: T | null }>) => (await q).data;

  const [profile, patient, employee, doctor, consents, requests, notifications] = await Promise.all([
    pick(supabase.from('profiles').select('*').eq('id', uid).maybeSingle()),
    pick(supabase.from('patients').select('*').eq('profile_id', uid).maybeSingle()),
    pick(supabase.from('employees').select('*').eq('profile_id', uid).maybeSingle()),
    pick(supabase.from('doctors').select('id, full_name_ar, full_name_en, specialty_ar, specialty_en, created_at').eq('profile_id', uid).maybeSingle()),
    pick(supabase.from('consents').select('purpose, granted, policy_version, channel, created_at').eq('profile_id', uid).order('created_at')),
    pick(supabase.from('data_requests').select('ref_no, type, details, status, response, created_at, handled_at').eq('profile_id', uid)),
    pick(supabase.from('notifications').select('type, payload, read_at, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(1000)),
  ]);

  const out: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    account: { email: user.email, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at },
    profile, consents, data_requests: requests, notifications,
  };

  if (patient) {
    const pid = (patient as { id: string }).id;
    const [appointments, visits, documents, invoices, ratings] = await Promise.all([
      pick(supabase.from('appointments').select('id, starts_at, ends_at, status, visit_type, reason, created_at').eq('patient_id', pid).order('starts_at')),
      pick(supabase.from('visits').select('id, appointment_id, chief_complaint, diagnosis, icd10_code, patient_advice, bp_systolic, bp_diastolic, pulse, temperature, spo2, weight_kg, height_cm, signed_at, prescription_items(drug_name, dose, frequency, duration, instructions), lab_orders(test_name, status, result_text, resulted_at)').eq('patient_id', pid).order('created_at')),
      pick(supabase.from('medical_documents').select('ref_no, kind, from_date, to_date, issued_at, revoked_at').eq('patient_id', pid)),
      pick(supabase.from('invoices').select('inv_no, status, total, patient_amount, insurance_amount, issued_at, invoice_items(description, qty, unit_price), payments(receipt_no, amount, method, received_at)').eq('patient_id', pid).order('created_at')),
      pick(supabase.from('appointment_ratings').select('appointment_id, score, comment, created_at').eq('patient_id', pid)),
    ]);
    Object.assign(out, { patient, appointments, visits, medical_documents: documents, invoices, ratings });
  }
  if (employee) {
    const e = employee as { id: string };
    const [salary, priv, attendance, hr] = await Promise.all([
      pick(supabase.from('employee_salaries').select('*').eq('employee_id', e.id).maybeSingle()),
      pick(supabase.from('employee_private').select('*').eq('employee_id', e.id).maybeSingle()),
      pick(supabase.from('attendance').select('work_date, check_in_at, check_out_at, in_lat, in_lng, out_lat, out_lng, source').eq('employee_id', e.id).order('work_date')),
      pick(supabase.from('hr_requests').select('ref_no, type, status, start_date, end_date, work_date, hours, reason, created_at, decided_at').eq('employee_id', e.id).order('created_at')),
    ]);
    Object.assign(out, { employee, salary, private: priv, attendance, hr_requests: hr });
  }
  if (doctor) out.doctor = doctor;

  await supabase.rpc('submit_data_request', { p_type: 'access', p_details: null }); // recorded in the rights log

  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
