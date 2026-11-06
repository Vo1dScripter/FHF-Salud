-- Solo lectura. Ejecutar en el proyecto academico confirmado antes de aplicar.
select current_database(), version();
select table_schema,table_name from information_schema.tables
 where table_schema in ('public','supabase_migrations') order by 1,2;
select version,name from supabase_migrations.schema_migrations order by version;
select tablename,rowsecurity from pg_tables where schemaname='public';
select conrelid::regclass,conname,pg_get_constraintdef(oid)
 from pg_constraint where connamespace='public'::regnamespace order by 1,2;
select schemaname,tablename,policyname,roles,cmd,qual,with_check
 from pg_policies where schemaname='public' order by tablename,policyname;
-- Contar registros antes de decidir conversiones; nunca seleccionar datos personales para evidencia.
select 'patients' as tabla,count(*) from public.patients
union all select 'physicians',count(*) from public.physicians
union all select 'appointments',count(*) from public.appointments;
