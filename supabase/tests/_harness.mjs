// Runs the real migrations on an in-process PostgreSQL (PGlite) with stubs for Supabase's auth / storage schemas.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

export async function boot({ quiet = false } = {}) {
  const dir = new URL('../migrations', import.meta.url).pathname;
  const db = new PGlite();
  await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated; grant all on storage.objects to authenticated;
`);
  for (const f of fs.readdirSync(dir).sort()) {
    try { await db.exec(fs.readFileSync(path.join(dir, f), 'utf8')); if (!quiet) console.log('OK', f); }
    catch (e) { console.error('FAIL', f, e.message, e.position); process.exit(1); }
  }
  return db;
}

let failures = 0;
export function check(name, cond, extra) {
  if (cond) console.log('  ✓', name);
  else { failures++; console.error('  ✗', name, extra ?? ''); }
}
export function done() {
  if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
  console.log('\nall checks passed');
}

/** run SQL as a signed-in user (role authenticated + jwt sub) or as a visitor (anon) */
export async function as(db, uid, sql, params) {
  await db.exec(uid ? `set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`
                    : `set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  try { return await db.query(sql, params); }
  finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}
export async function fails(db, uid, sql, params) {
  try { await as(db, uid, sql, params); return null; } catch (e) { return e.message; }
}
