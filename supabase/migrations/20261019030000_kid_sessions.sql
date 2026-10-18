create table if not exists public.kid_sessions (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references public.kids(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists kid_sessions_active_idx on public.kid_sessions (kid_id) where revoked_at is null;
alter table public.kid_sessions enable row level security;
revoke all on public.kid_sessions from public, anon, authenticated;
grant all on public.kid_sessions to service_role;
update public.kids set session_token = null where session_token is not null;

-- One transaction serializes issuance and enforces the multi-device cap.
create or replace function public.kid_session_create(p_kid_id uuid, p_token_hash text, p_expected_pin_hash text)
returns void language plpgsql security definer set search_path = public as $$
declare v_hash text;
begin
  select hashed_pin into v_hash from public.kids where id = p_kid_id for update;
  if not found or v_hash is null or v_hash is distinct from p_expected_pin_hash then
    raise exception 'session_invalid';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_token_hash'; end if;
  insert into public.kid_sessions (kid_id, token_hash, expires_at)
  values (p_kid_id, p_token_hash, now() + interval '30 days');
  update public.kid_sessions set revoked_at = now()
  where id in (select id from public.kid_sessions where kid_id = p_kid_id
    and revoked_at is null and expires_at > now() order by created_at desc, id desc offset 5);
end $$;
revoke all on function public.kid_session_create(uuid, text, text) from public, anon, authenticated;
grant execute on function public.kid_session_create(uuid, text, text) to service_role;
