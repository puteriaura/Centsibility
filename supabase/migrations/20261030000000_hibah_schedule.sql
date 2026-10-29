-- 20261030000000_hibah_schedule.sql
-- Pays due scheduled Hibah every 15 minutes from the database. Until now the only trigger was
-- visitors' browsers calling parent-finance execute-scheduled-hibahs, so allowances waited for
-- someone to open the app. execute_due_hibahs claims rows with FOR UPDATE SKIP LOCKED, so this
-- job and any remaining browser trigger cannot pay the same gift twice. Requires pg_cron; where
-- it is not installed (for example the local PGlite replay) this only raises a notice.
-- Remove with: select cron.unschedule('execute-due-hibahs');
do $migration$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not installed; execute-due-hibahs not scheduled';
    return;
  end if;
  execute $schedule$
    select cron.schedule('execute-due-hibahs', '*/15 * * * *', 'select public.execute_due_hibahs()')
  $schedule$;
end
$migration$;
