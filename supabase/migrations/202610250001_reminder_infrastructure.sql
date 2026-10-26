-- Infrastructure only; creates no medical tables and schedules no active job.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;
-- Configure a dedicated invocation secret in Vault before scheduling any job.
-- The future job must remain inactive until transactional claiming, authorization,
-- idempotency, bounded retries and protected subscriptions are implemented.

-- Provision a disabled job only. Never calls the endpoint during preparation.
do $migration$
declare reminder_job bigint;
begin
  select jobid into reminder_job from cron.job where jobname = 'fhf-reminder-dispatch';
  if reminder_job is null then
    select cron.schedule('fhf-reminder-dispatch', '*/5 * * * *', $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'fhf_reminder_function_url'),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-reminder-secret',
          (select decrypted_secret from vault.decrypted_secrets where name = 'fhf_reminder_dispatch_secret')),
        body := '{}'::jsonb,
        timeout_milliseconds := 10000
      );
    $job$) into reminder_job;
  end if;
  perform cron.alter_job(reminder_job, active := false);
end
$migration$;
