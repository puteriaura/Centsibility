import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { PGlite } from '@electric-sql/pglite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');

const BOOTSTRAP_SQL = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
alter table storage.objects enable row level security;
create publication supabase_realtime;
`;

// Same deferred versions excluded by the release preparation script.
const DEFERRED = new Set(['20261006100000', '20261009010000']);

export async function openDb({ includeDeferred = false } = {}) {
  const db = new PGlite();
  await db.exec(BOOTSTRAP_SQL);

  const files = fs.readdirSync(migrationsDir).sort();
  for (const file of files) {
    if (!file.endsWith('.sql') || (!includeDeferred && DEFERRED.has(file.split('_')[0]))) continue;
    const fullPath = path.join(migrationsDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.size === 0) continue;
    const sql = fs.readFileSync(fullPath, 'utf8');
    await db.exec(sql);
  }

  return db;
}

export async function seedParent(db) {
  const id = (await db.query(
    `insert into auth.users (email, raw_user_meta_data)
     values ($1, $2)
     returning id`,
    [`parent_${Math.random().toString(36).slice(2)}@example.com`, JSON.stringify({ display_name: 'Test Parent' })]
  )).rows[0].id;
  return id;
}

export async function seedKid(db, parentId, fields = {}) {
  const uid = Math.random().toString(36).slice(2, 8);
  const data = {
    parent_id: parentId,
    name: `Kid ${uid}`,
    login_code: `KID${uid.toUpperCase()}`,
    username: `kid_${uid}`,
    balance: 0,
    coins: 0,
    ...fields,
  };
  const keys = Object.keys(data);
  const vals = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const res = await db.query(
    `insert into public.kids (${keys.join(', ')}) values (${placeholders}) returning *`,
    vals
  );
  return res.rows[0];
}

export async function asRole(db, role, fn) {
  await db.query(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.query(`reset role`);
  }
}

export async function expectError(promise, code) {
  try {
    await promise;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes(code)) {
      throw new Error(`Expected error containing "${code}", but got: "${msg}"`);
    }
    return;
  }
  throw new Error(`Expected promise to reject with error containing "${code}", but resolved`);
}
