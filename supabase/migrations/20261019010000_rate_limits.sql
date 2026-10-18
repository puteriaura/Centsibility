create table if not exists public.rate_limits (
  bucket text not null, key text not null, window_start timestamptz not null,
  hits int not null default 0, primary key (bucket, key, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from public, anon, authenticated;
grant all on public.rate_limits to service_role;

create or replace function public.rate_limit_hit(p_bucket text, p_key text, p_limit int, p_window_seconds int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_window timestamptz; v_hits int;
begin
  if p_limit is null or p_limit <= 0 or p_window_seconds is null or p_window_seconds <= 0 then
    raise exception 'invalid_limit';
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits as r (bucket, key, window_start, hits)
  values (p_bucket, p_key, v_window, 1)
  on conflict (bucket, key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  return jsonb_build_object('allowed', v_hits <= p_limit, 'hits', v_hits,
    'retryAfter', case when v_hits <= p_limit then 0 else
      greatest(1, ceil(extract(epoch from (v_window + make_interval(secs => p_window_seconds) - now())))::int) end);
end $$;
revoke all on function public.rate_limit_hit(text, text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, text, int, int) to service_role;

-- Serialize child creation per parent so concurrent requests cannot exceed the cap.
create or replace function public.enforce_child_cap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.parent_id::text, 0));
  if (select count(*) from public.kids where parent_id = new.parent_id) >= 10 then
    raise exception 'kid_limit';
  end if;
  return new;
end $$;
revoke all on function public.enforce_child_cap() from public, anon, authenticated;
grant execute on function public.enforce_child_cap() to service_role;
create trigger enforce_child_cap before insert on public.kids
for each row execute function public.enforce_child_cap();
