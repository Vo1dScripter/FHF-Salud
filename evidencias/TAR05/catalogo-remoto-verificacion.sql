select jsonb_build_object(
 'version',version(),
 'tables',(select jsonb_agg(jsonb_build_object('table',tablename,'rls',rowsecurity)) from pg_tables where schemaname='public'),
 'constraints',(select jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid))) from pg_constraint where connamespace='public'::regnamespace),
 'policies',(select jsonb_agg(jsonb_build_object('table',tablename,'policy',policyname,'roles',roles,'command',cmd)) from pg_policies where schemaname='public'),
 'migration_versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'reminder_job',(select jsonb_agg(jsonb_build_object('name',jobname,'active',active)) from cron.job where jobname='fhf-reminder-dispatch'),
 'test_cleanup',jsonb_build_object('patients',(select count(*) from patients),'physicians',(select count(*) from physicians),'appointments',(select count(*) from appointments),'events',(select count(*) from appointment_events),'blocks',(select count(*) from physician_schedule_blocks))
) as verified_catalog;
