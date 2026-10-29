-- 20261026000000_market_close_refresh.sql
-- Schedules the post-close market refresh (Edge Function market-refresh) every 15 minutes,
-- 17:00-23:59 UTC, Monday to Friday. This covers early closes (17:00 or 18:00 UTC) and normal
-- closes (20:00 UTC in US summer time, 21:00 UTC in winter). Runs with nothing due make no
-- provider call. Requires pg_cron and pg_net to be enabled first, and the Vault secrets
-- market_refresh_url and market_refresh_token created by the operator outside git. Where pg_cron
-- or pg_net is not installed (for example the local PGlite replay), this only raises a notice.
-- Remove with: select cron.unschedule('market-close-refresh');
do $migration$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     or not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise notice 'pg_cron or pg_net not installed; market-close-refresh not scheduled';
    return;
  end if;
  execute $schedule$
    select cron.schedule(
      'market-close-refresh',
      '*/15 17-23 * * 1-5',
      $job$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'market_refresh_url'),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-market-refresh-token', (select decrypted_secret from vault.decrypted_secrets where name = 'market_refresh_token')
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 60000
        )
      $job$
    )
  $schedule$;
end
$migration$;
