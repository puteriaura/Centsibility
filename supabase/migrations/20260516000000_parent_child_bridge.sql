-- Create child_creation_keys table
create table public.child_creation_keys (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  hashed_key text not null,
  salt text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.child_creation_keys enable row level security;
create policy "parent rw keys" on public.child_creation_keys for all using (auth.uid() = parent_id);

-- Alter kids table
alter table public.kids 
  add column username text unique,
  add column hashed_pin text,
  add column bridge_key_hash text,
  add column failed_login_attempts int not null default 0,
  add column locked_until timestamptz;

alter table public.kids alter column login_code drop not null;
