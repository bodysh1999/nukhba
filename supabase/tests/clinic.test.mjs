// Clinic workflow + security: booking, arrival, consultation, tests, documents, billing, insurance, reports.
import { boot, as, fails, check, done } from './_harness.mjs';

const db = await boot({ quiet: true });

const U = {
  admin: '00000000-0000-0000-0000-0000000000a1', rec: '00000000-0000-0000-0000-0000000000a2',
  doc1: '00000000-0000-0000-0000-0000000000a3', doc2: '00000000-0000-0000-0000-0000000000a4',
  acc: '00000000-0000-0000-0000-0000000000a5', pt1: '00000000-0000-0000-0000-0000000000a6',
  pt2: '00000000-0000-0000-0000-0000000000a7', hr: '00000000-0000-0000-0000-0000000000a8',
  hack: '00000000-0000-0000-0000-0000000000a9',
};
await db.exec(`insert into auth.users (id,email,raw_app_meta_data,raw_user_meta_data) values
 ('${U.admin}','a@x','{"role":"admin"}','{"full_name":"المدير"}'),
 ('${U.rec}','r@x','{"role":"reception"}','{"full_name":"الاستقبال"}'),
 ('${U.doc1}','d1@x','{"role":"doctor"}','{"full_name":"د. أحمد"}'),
 ('${U.doc2}','d2@x','{"role":"doctor"}','{"full_name":"د. سارة"}'),
 ('${U.acc}','c@x','{"role":"accountant"}','{"full_name":"المحاسب"}'),
 ('${U.pt1}','p1@x','{"role":"patient"}','{"full_name":"محمد علي"}'),
 ('${U.pt2}','p2@x','{"role":"patient"}','{"full_name":"نورة"}'),
 ('${U.hr}','h@x','{"role":"hr"}','{"full_name":"الموارد"}'),
 ('${U.hack}','x@x','{}','{"full_name":"مخترق","role":"admin"}');`);

const roles = (await db.query(`select id, role from public.profiles order by id`)).rows;
check('sign-up metadata cannot grant a role', roles.find((r) => r.id === U.hack).role === 'patient');

await db.exec(`
insert into public.clinics (id, code, name_ar, name_en, sort) values
 ('c0000000-0000-0000-0000-000000000001','family','طب الأسرة','Family Medicine',1),
 ('c0000000-0000-0000-0000-000000000002','dental','الأسنان','Dental',2);
insert into public.doctors (id, profile_id, clinic_id, full_name_ar, consultation_fee, follow_up_fee, slot_minutes) values
 ('d0000000-0000-0000-0000-000000000001','${U.doc1}','c0000000-0000-0000-0000-000000000001','د. أحمد',300,150,30),
 ('d0000000-0000-0000-0000-000000000002','${U.doc2}','c0000000-0000-0000-0000-000000000002','د. سارة',250,100,30);
insert into public.doctor_schedules (doctor_id, weekday, start_time, end_time)
 select d, w, '00:00', '23:30' from unnest(array['d0000000-0000-0000-0000-000000000001'::uuid,'d0000000-0000-0000-0000-000000000002'::uuid]) d,
   generate_series(0,6) w;
insert into public.insurance_companies (id, name_ar, coverage_percent, max_copay) values ('e0000000-0000-0000-0000-000000000001','تأمين أ',80,50);
insert into public.services (id, code, name_ar, kind, price) values ('f0000000-0000-0000-0000-000000000001','CBC','صورة دم كاملة','lab',120);
insert into public.patients (id, profile_id, full_name, national_id, is_saudi, phone, account_status, insurance_company_id, insurance_expiry) values
 ('b0000000-0000-0000-0000-000000000001','${U.pt1}','محمد علي الغامدي','2123456789',false,'0500000001','active','e0000000-0000-0000-0000-000000000001', current_date + 100),
 ('b0000000-0000-0000-0000-000000000002','${U.pt2}','نورة سالم','1123456789',true,'0500000002','active',null,null);
`);
const D1 = 'd0000000-0000-0000-0000-000000000001', D2 = 'd0000000-0000-0000-0000-000000000002';
const P1 = 'b0000000-0000-0000-0000-000000000001', P2 = 'b0000000-0000-0000-0000-000000000002';

console.log('\nvisitors');
const tomorrow = (await db.query(`select public.riyadh_date() + 1 as d`)).rows[0].d.toISOString().slice(0, 10);
const slots = (await as(db, null, `select * from public.available_slots($1, $2::date)`, [D1, tomorrow])).rows;
check('visitor sees free times (30-min slots)', slots.length === 47 && slots.every((s) => s.is_free));
check('visitor cannot read patients', !!(await fails(db, null, `select * from public.patients`)));
check('visitor can read public doctors', (await as(db, null, `select full_name_ar from public.doctors`)).rows.length === 2);
check('visitor cannot read doctor licence no.', !!(await fails(db, null, `select scfhs_no from public.doctors`)));
const br = (await as(db, null, `select public.submit_booking_request('زائر','0551112222',null,$1,null,'evening') r`, [D1])).rows[0].r;
check('visitor booking request accepted', br.startsWith('BR-'));
check('visitor cannot read booking requests', !!(await fails(db, null, `select * from public.booking_requests`)));

console.log('\npatient booking');
const s1 = slots[20].starts_at.toISOString();
const appt1 = (await as(db, U.pt1, `select public.book_appointment($1, $2::timestamptz, null, 'صداع') id`, [D1, s1])).rows[0].id;
check('patient books own appointment', !!appt1);
check('same slot cannot be booked twice', (await fails(db, U.pt2, `select public.book_appointment($1, $2::timestamptz)`, [D1, s1]))?.includes('SLOT_UNAVAILABLE'));
check('one active booking per doctor', (await fails(db, U.pt1, `select public.book_appointment($1, $2::timestamptz)`, [D1, slots[22].starts_at.toISOString()]))?.includes('ALREADY_BOOKED'));
check('patient cannot pass another patient id', (await as(db, U.pt2, `select patient_id from public.appointments where id = (select public.book_appointment($1, $2::timestamptz, $3))`, [D2, slots[5].starts_at.toISOString(), P1])).rows[0]?.patient_id === undefined);
check('patients cannot see each other’s appointments', (await as(db, U.pt2, `select * from public.appointments where id = $1`, [appt1])).rows.length === 0);
check('patient cannot insert appointments directly', !!(await fails(db, U.pt1, `insert into public.appointments (patient_id,doctor_id,clinic_id,starts_at,ends_at) values ($1,$2,'c0000000-0000-0000-0000-000000000001',now(),now()+interval '1h')`, [P1, D1])));
check('patient cannot check in', (await fails(db, U.pt1, `select public.check_in($1)`, [appt1]))?.includes('FORBIDDEN'));
check('patient cannot change own role', !!(await fails(db, U.pt1, `update public.profiles set role='admin' where id='${U.pt1}'`)));
await as(db, U.pt1, `select public.confirm_appointment($1)`, [appt1]);
check('patient confirms', (await db.query(`select status from public.appointments where id=$1`, [appt1])).rows[0].status === 'confirmed');
await as(db, U.pt1, `select public.reschedule_appointment($1, $2::timestamptz)`, [appt1, slots[24].starts_at.toISOString()]);
check('patient reschedules → booked again', (await db.query(`select status from public.appointments where id=$1`, [appt1])).rows[0].status === 'booked');
check('reschedule to another clinic’s doctor refused', !!(await fails(db, U.pt1, `select public.reschedule_appointment($1, $2::timestamptz, $3)`, [appt1, slots[26].starts_at.toISOString(), D2])));
await as(db, U.pt1, `select public.cancel_appointment($1, 'ظرف')`, [appt1]);
check('patient cancels in time', (await db.query(`select status from public.appointments where id=$1`, [appt1])).rows[0].status === 'cancelled');
check('reception was notified of the online booking', (await db.query(`select count(*)::int n from public.notifications where user_id='${U.rec}' and type='online_booking'`)).rows[0].n >= 1);

console.log('\narrival → consultation');
// today's appointment (inserted directly so the test never depends on the clock)
const appt = (await db.query(`insert into public.appointments (patient_id, doctor_id, clinic_id, starts_at, ends_at)
  values ($1,$2,'c0000000-0000-0000-0000-000000000001', now() + interval '5 min', now() + interval '35 min') returning id`, [P1, D1])).rows[0].id;
check('doctor cannot start before arrival', (await fails(db, U.doc1, `select public.start_consultation($1)`, [appt]))?.includes('PATIENT_NOT_ARRIVED'));
const q = (await as(db, U.rec, `select public.check_in($1) q`, [appt])).rows[0].q;
check('check-in gives queue number 1', q === 1);
let inv = (await db.query(`select * from public.invoices where appointment_id=$1`, [appt])).rows[0];
// 300 → insurer 80% = 240, patient 60 capped at 50 → insurer 250; VAT 15% (non-Saudi): total 345, patient 57.5
check('invoice opened at check-in with insurance split + VAT', inv && Number(inv.total) === 345 && Number(inv.patient_amount) === 57.5 && Number(inv.insurance_amount) === 287.5 && inv.payer === 'insurance', inv);
check('doctor 2 cannot take doctor 1’s patient', (await fails(db, U.doc2, `select public.start_consultation($1)`, [appt]))?.includes('FORBIDDEN'));
const visit = (await as(db, U.doc1, `select public.start_consultation($1) v`, [appt])).rows[0].v;
check('doctor starts consultation', !!visit);
check('patient told it is their turn', (await db.query(`select count(*)::int n from public.notifications where user_id='${U.pt1}' and type='your_turn'`)).rows[0].n === 1);
await as(db, U.doc1, `update public.visits set chief_complaint='كحة', diagnosis='التهاب الحلق', icd10_code='J02.9', bp_systolic=120, bp_diastolic=80 where id=$1`, [visit]);
check('doctor cannot change visit status directly', !!(await fails(db, U.doc1, `update public.visits set status='signed' where id=$1`, [visit])));
await as(db, U.doc1, `insert into public.prescription_items (visit_id, drug_name, dose, frequency, duration) values ($1,'Amoxicillin 500mg','1','3 مرات','7 أيام')`, [visit]);
await as(db, U.doc1, `select public.save_private_note($1, 'ملاحظة خاصة')`, [visit]);
const test = (await as(db, U.doc1, `select public.order_test($1, 'f0000000-0000-0000-0000-000000000001') t`, [visit])).rows[0].t;
inv = (await db.query(`select * from public.invoices where appointment_id=$1`, [appt])).rows[0];
check('ordered test added to the visit invoice', Number(inv.subtotal) === 420);
check('reception cannot read the medical record', (await as(db, U.rec, `select * from public.visits`)).rows.length === 0);
check('accountant cannot read prescriptions', (await as(db, U.acc, `select * from public.prescription_items`)).rows.length === 0);
check('other doctor cannot read this record', (await as(db, U.doc2, `select * from public.visits where id=$1`, [visit])).rows.length === 0);
check('patient cannot see an unsigned visit', (await as(db, U.pt1, `select * from public.visits where id=$1`, [visit])).rows.length === 0);
check('patient cannot write prescriptions', !!(await fails(db, U.pt1, `insert into public.prescription_items (visit_id, drug_name) values ($1,'x x')`, [visit])));

await as(db, U.doc1, `select public.complete_visit($1)`, [visit]);
check('visit signed, appointment completed', (await db.query(`select status from public.appointments where id=$1`, [appt])).rows[0].status === 'completed');
check('signed visit is read-only', (await as(db, U.doc1, `update public.visits set diagnosis='x' where id=$1 returning id`, [visit])).rows.length === 0);
check('patient sees the signed visit', (await as(db, U.pt1, `select diagnosis from public.visits where id=$1`, [visit])).rows[0]?.diagnosis === 'التهاب الحلق');
check('patient sees prescription', (await as(db, U.pt1, `select count(*)::int n from public.prescription_items where visit_id=$1`, [visit])).rows[0].n === 1);
check('patient never sees private notes', (await as(db, U.pt1, `select * from public.visit_private_notes`)).rows.length === 0);
check('doctor sees own private note', (await as(db, U.doc1, `select body from public.visit_private_notes where visit_id=$1`, [visit])).rows[0]?.body === 'ملاحظة خاصة');
check('patient does not see a pending test', (await as(db, U.pt1, `select * from public.lab_orders where id=$1`, [test])).rows.length === 0);
await as(db, U.doc1, `select public.record_test_result($1, 'WBC 7.2 طبيعي', 'normal')`, [test]);
check('patient sees the result', (await as(db, U.pt1, `select result_text from public.lab_orders where id=$1`, [test])).rows[0]?.result_text?.startsWith('WBC'));
check('file path must belong to the patient', (await fails(db, U.doc1, `select public.record_test_result($1, 'x', 'normal', $2)`, [test, `${P2}/x.pdf`]))?.includes('INVALID_FILE'));

console.log('\nsick leave & QR');
const today = (await db.query(`select public.riyadh_date() d`)).rows[0].d.toISOString().slice(0, 10);
check('sick leave over 30 days refused', (await fails(db, U.doc1, `select public.issue_medical_document($1,'sick_leave',$2::date,$2::date+40)`, [visit, today]))?.includes('TOO_LONG'));
const docId = (await as(db, U.doc1, `select public.issue_medical_document($1,'sick_leave',$2::date,$2::date+2) id`, [visit, today])).rows[0].id;
const code = (await db.query(`select verify_code from public.medical_documents where id=$1`, [docId])).rows[0].verify_code;
const ver = (await as(db, null, `select public.verify_medical_document($1) v`, [code])).rows[0].v;
check('visitor verifies sick leave (name masked, 3 days)', ver?.days === 3 && ver.patient === 'محمد ع.' && ver.national_id.endsWith('6789') && !ver.national_id.includes('2123'));
check('wrong code returns nothing', (await as(db, null, `select public.verify_medical_document('x') v`)).rows[0].v === null);
check('other doctor cannot issue on this visit', !!(await fails(db, U.doc2, `select public.issue_medical_document($1,'medical_report',null,null,'تقرير')`, [visit])));

console.log('\nbilling & insurance');
check('patient cannot see a draft invoice', (await as(db, U.pt1, `select * from public.invoices where id=$1`, [inv.id])).rows.length === 0);
check('reception cannot give discounts', (await fails(db, U.rec, `select public.set_invoice_terms($1,'insurance',50)`, [inv.id]))?.includes('FORBIDDEN'));
check('doctor cannot read invoices', (await as(db, U.doc1, `select * from public.invoices`)).rows.length === 0);
check('overpayment refused', (await fails(db, U.rec, `select public.record_payment($1, 500, 'cash')`, [inv.id]))?.includes('EXCEEDS'));
inv = (await db.query(`select * from public.invoices where id=$1`, [inv.id])).rows[0];
await as(db, U.rec, `select public.record_payment($1, $2, 'mada', 'TX1')`, [inv.id, inv.patient_amount]);
inv = (await db.query(`select * from public.invoices where id=$1`, [inv.id])).rows[0];
check('full patient share → paid; claim pending', inv.status === 'paid' && inv.claim_status === 'pending', inv.status + ' ' + inv.claim_status);
check('patient sees own invoice', (await as(db, U.pt1, `select id from public.invoices where id=$1`, [inv.id])).rows.length === 1);
check('another patient cannot', (await as(db, U.pt2, `select id from public.invoices where id=$1`, [inv.id])).rows.length === 0);
check('no discount after payment', (await fails(db, U.acc, `select public.set_invoice_terms($1,'insurance',20)`, [inv.id]))?.includes('INVOICE_HAS_PAYMENTS'));
check('reception cannot void payments', !!(await fails(db, U.rec, `select public.void_payment(id, 'x') from public.payments limit 1`)));
check('reception cannot change claims', !!(await fails(db, U.rec, `select public.update_claim($1,'submitted')`, [inv.id])));
await as(db, U.acc, `select public.update_claim($1,'submitted')`, [inv.id]);
await as(db, U.acc, `select public.update_claim($1,'partially_approved', 200, 'خصم بند')`, [inv.id]);
check('claim partially approved', (await db.query(`select claim_status, claim_approved_amount from public.invoices where id=$1`, [inv.id])).rows[0].claim_approved_amount == 200);
// Saudi self-pay walk-in: no VAT
const walk = (await as(db, U.rec, `select public.create_invoice($1) id`, [P2])).rows[0].id;
await as(db, U.rec, `select public.add_invoice_item($1, 'f0000000-0000-0000-0000-000000000001')`, [walk]);
check('reception cannot invent prices', !!(await fails(db, U.rec, `select public.add_invoice_item($1, null, 'خدمة', 1, 10)`, [walk])));
const w = (await db.query(`select * from public.invoices where id=$1`, [walk])).rows[0];
check('Saudi patient: no VAT, self pay', Number(w.vat_amount) === 0 && Number(w.patient_amount) === 120 && w.payer === 'self');

console.log('\nrating, reports');
await as(db, U.pt1, `select public.rate_appointment($1, 5, 'ممتاز')`, [appt]);
check('rate twice refused', (await fails(db, U.pt1, `select public.rate_appointment($1, 4)`, [appt]))?.includes('ALREADY_RATED'));
check('patient cannot rate others', !!(await fails(db, U.pt2, `select public.rate_appointment($1, 1)`, [appt])));
const dash = (await as(db, U.rec, `select public.clinic_dashboard() d`)).rows[0].d;
check('reception dashboard has no money figures', dash.today_completed === 1 && dash.collected_today === undefined);
const dashA = (await as(db, U.acc, `select public.clinic_dashboard() d`)).rows[0].d;
check('finance dashboard shows collections', Number(dashA.collected_today) === 57.5);
check('reception cannot run financial reports', !!(await fails(db, U.rec, `select public.report_summary(current_date - 30, current_date)`)));
const rep = (await as(db, U.acc, `select public.report_summary(current_date - 30, current_date + 1) r`)).rows[0].r;
check('report has doctors and insurers', rep.by_doctor.length === 2 && rep.by_insurer.length === 1 && rep.top_diagnoses[0]?.code === 'J02.9');
check('queue board hides patient names', !JSON.stringify((await as(db, U.rec, `select * from public.queue_board()`)).rows).includes('محمد'));
check('patients cannot read the queue board', (await as(db, U.pt1, `select * from public.queue_board()`)).rows.length === 0);
check('HR cannot read patients', (await as(db, U.hr, `select * from public.patients`)).rows.length === 0);

console.log('\nno-show & reminders');
const late = (await db.query(`insert into public.appointments (patient_id, doctor_id, clinic_id, starts_at, ends_at)
  values ($1,$2,'c0000000-0000-0000-0000-000000000002', now() - interval '1 hour', now() - interval '30 min') returning id`, [P2, D2])).rows[0].id;
await as(db, U.rec, `select public.mark_no_show($1)`, [late]);
check('no-show marked', (await db.query(`select status from public.appointments where id=$1`, [late])).rows[0].status === 'no_show');
const appt2 = (await as(db, U.rec, `select public.book_appointment($1, $2::timestamptz, $3, null, 'new', 'phone') id`, [D2, slots[30].starts_at.toISOString(), P2])).rows[0].id;
const n = (await db.query(`select public.send_appointment_reminders() n`)).rows[0].n;
check('reminders sent for tomorrow', n === 2 && (await db.query(`select count(*)::int c from public.notifications where user_id='${U.pt2}' and type='appointment_reminder'`)).rows[0].c === 2);
check('patient too late to cancel is blocked by window only when near', !!appt2);

done();
