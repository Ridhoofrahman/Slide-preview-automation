-- Slack notifications, step 2 of 2: call the Edge Function notify-slack every minute.
-- Run after sql/notifications.sql and after notify-slack is deployed (JWT verification off) with its secrets.
-- The cron secret is NOT in this file: it lives in Supabase Vault under the name 'notify_cron_secret' and must be
-- the same value as the function secret NOTIFY_CRON_SECRET. Create it once in the SQL Editor (do not commit it):
--   select vault.create_secret('<the same long random string>', 'notify_cron_secret');
-- Safe to run again. To stop: select cron.unschedule('slideshot-notify-slack');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('slideshot-notify-slack') where exists (select 1 from cron.job where jobname = 'slideshot-notify-slack');
select cron.schedule('slideshot-notify-slack', '* * * * *', $job$
  select net.http_post(
    url     := 'https://famrojncimymwugjlivz.supabase.co/functions/v1/notify-slack',
    headers := jsonb_build_object('Content-Type', 'application/json',
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notify_cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000)
$job$);

-- Check the last runs:  select status, return_message, start_time from cron.job_run_details
--                         where jobid = (select jobid from cron.job where jobname = 'slideshot-notify-slack') order by start_time desc limit 10;
-- Function replies:     select id, status_code, content from net._http_response order by id desc limit 10;
