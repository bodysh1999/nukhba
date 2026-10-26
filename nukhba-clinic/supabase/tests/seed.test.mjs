// Runs the demo seed on top of the migrations and checks the result is coherent.
import fs from 'fs';
import { boot, as, check, done } from './_harness.mjs';

const db = await boot({ quiet: true });
await db.exec(`
alter table auth.users add column instance_id uuid, add column aud text, add column role text, add column encrypted_password text,
  add column email_confirmed_at timestamptz, add column created_at timestamptz, add column updated_at timestamptz,
  add column confirmation_token text, add column recovery_token text, add column email_change_token_new text, add column email_change text,
  add column email_change_token_current text, add column phone_change text, add column phone_change_token text, add column reauthentication_token text;
create table auth.identities (id uuid, user_id uuid, provider_id text, identity_data jsonb, provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
create schema extensions;
create function extensions.gen_salt(text) returns text language sql as $$ select 'salt' $$;
create function extensions.crypt(text, text) returns text language sql as $$ select md5($1 || $2) $$;
`);
const sql = fs.readFileSync(new URL('../seed/demo.sql', import.meta.url), 'utf8');
const t0 = Date.now();
const res = await db.exec(sql);
console.log('seed took', Date.now() - t0, 'ms →', JSON.stringify(res.at(-1).rows[0]));
const n = res.at(-1).rows[0];
check('patients', n.patients >= 60);
check('appointments', n.appointments > 500, n.appointments);
check('employees', n.employees >= 20);
const q = async (s) => (await db.query(s)).rows;
check('every completed appointment has a signed visit', (await q(`select count(*)::int c from appointments a left join visits v on v.appointment_id=a.id where a.status='completed' and (v.id is null or v.status<>'signed')`))[0].c === 0);
check('every completed visit is invoiced', (await q(`select count(*)::int c from appointments a left join invoices i on i.appointment_id=a.id where a.status='completed' and i.id is null`))[0].c === 0);
check('invoices balance', (await q(`select count(*)::int c from invoices where abs(total - insurance_amount - patient_amount) > 0.01`))[0].c === 0);
check('no double-booking', (await q(`select count(*)::int c from (select doctor_id, starts_at from appointments where status not in ('cancelled','no_show') group by 1,2 having count(*)>1) x`))[0].c === 0);
const pt = (await q(`select id from auth.users where email='patient@demo.example.com'`))[0].id;
const mine = await as(db, pt, `select status, count(*)::int n from appointment_overview group by 1`);
console.log('   demo patient:', JSON.stringify(mine.rows));
check('demo patient sees own history + upcoming', mine.rows.some((r) => r.status === 'completed') && mine.rows.some((r) => r.status === 'confirmed'));
check('demo patient has an unpaid invoice', (await as(db, pt, `select count(*)::int n from invoices where status='issued'`)).rows[0].n === 1);
const today = await q(`select status, count(*)::int n from appointments where riyadh_date(starts_at)=riyadh_date() group by 1`);
console.log('   today:', JSON.stringify(today));
const rec = (await q(`select id from auth.users where email='reception@demo.example.com'`))[0].id;
console.log('   dashboard:', JSON.stringify((await as(db, rec, `select clinic_dashboard() d`)).rows[0].d));
const acc = (await q(`select id from auth.users where email='accountant@demo.example.com'`))[0].id;
const rep = (await as(db, acc, `select report_summary(riyadh_date()-30, riyadh_date()) r`)).rows[0].r;
console.log('   30d: billed', rep.billed, 'collected', rep.collected, 'rating', rep.rating, 'insurers', rep.by_insurer.length);
check('report works on seeded data', Number(rep.billed) > 10000);
const d = (await q(`select id from auth.users where email='doctor.khalid@demo.example.com'`))[0].id;
check('doctor sees own patients only', (await as(db, d, `select count(distinct patient_id)::int n from visits`)).rows[0].n > 0);
done();
