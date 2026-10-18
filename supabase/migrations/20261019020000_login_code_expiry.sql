alter table public.kids add column if not exists login_code_expires_at timestamptz;
update public.kids set login_code_expires_at = now() + interval '7 days'
where login_code is not null and hashed_pin is null;
update public.kids set login_code = null where login_code is not null and hashed_pin is not null;
grant select (login_code_expires_at) on public.kids to authenticated;
