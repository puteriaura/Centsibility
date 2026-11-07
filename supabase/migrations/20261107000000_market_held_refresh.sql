-- Pick shared quotes by symbol so multiple holders never duplicate a refresh.
create or replace function public.market_held_refresh_candidates(p_cutoff timestamptz)
returns table(symbol text, kind text)
language sql stable set search_path = ''
as $$
  select s.symbol, s.kind
  from public.market_symbols s
  left join public.market_quotes q on q.symbol = s.symbol
  where (q.fetched_at is null or q.fetched_at <= p_cutoff)
    and exists (
      select 1 from public.investments i
      where i.symbol = s.symbol and i.mode = 'market' and i.status = 'active'
    )
  order by q.fetched_at asc nulls first, s.symbol
  limit 6
$$;

revoke all on function public.market_held_refresh_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.market_held_refresh_candidates(timestamptz) to service_role;

-- The Edge Function checks the NYSE session, including holidays and early closes.
do $migration$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     or not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise notice 'pg_cron or pg_net not installed; market-held-refresh not scheduled';
    return;
  end if;
  execute $schedule$
    select cron.schedule(
      'market-held-refresh',
      '*/15 13-21 * * 1-5',
      $job$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'market_refresh_url'),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-market-refresh-token', (select decrypted_secret from vault.decrypted_secrets where name = 'market_refresh_token')
          ),
          body := '{"mode":"held"}'::jsonb,
          timeout_milliseconds := 60000
        )
      $job$
    )
  $schedule$;
end
$migration$;
