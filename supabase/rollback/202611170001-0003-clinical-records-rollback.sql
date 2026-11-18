-- ROLLBACK SOLO PARA BASE LOCAL DE DESARROLLO. NUNCA en Supabase remoto.
-- Revierte 202611170001..0003 en orden inverso y elimina las columnas nuevas
-- de patients. Esta fuera de supabase/migrations a proposito.
-- Se detiene si ya existen revisiones clinicas, para no perder datos.
begin;

do $$
declare
  n bigint := 0;
begin
  if to_regclass('public.clinical_record_revisions') is not null then
    execute 'select count(*) from public.clinical_record_revisions' into n;
  end if;
  if n > 0 then
    raise exception 'Rollback detenido: existen % revisiones clinicas.', n;
  end if;
end;
$$;

drop function if exists public.open_clinical_record(uuid);
drop function if exists public.save_clinical_revision(
  uuid, integer, text, text, text, text, text, text);
drop function if exists public.register_patient(text, date, text, text);
drop policy if exists patients_select_physician_associated on public.patients;
drop table if exists public.clinical_record_revisions;
drop table if exists public.clinical_records;
drop table if exists public.patient_physicians;
drop function if exists public.clinical_revisions_immutable();
drop function if exists public.clinical_actor_physician();
drop trigger if exists patients_touch_updated_at on public.patients;
drop function if exists public.clinical_touch_updated_at();
alter table public.patients
  drop column if exists birth_date,
  drop column if exists sex,
  drop column if exists phone,
  drop column if exists updated_at;

commit;
