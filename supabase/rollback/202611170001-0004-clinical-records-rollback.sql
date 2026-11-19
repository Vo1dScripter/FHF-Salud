-- ROLLBACK SOLO PARA BASE LOCAL DE DESARROLLO.
-- NUNCA ejecutar en Supabase remoto.
-- Revierte las migraciones 202611170001 a 202611170004.
-- Protege los expedientes, revisiones, asociaciones y datos personales.

begin;

lock table public.patients,
           public.patient_physicians,
           public.clinical_records,
           public.clinical_record_revisions
in access exclusive mode;

do $$
declare
  n_revisiones bigint;
  n_expedientes bigint;
  n_asociaciones bigint;
  n_datos_personales bigint;
begin
  select count(*) into n_revisiones
  from public.clinical_record_revisions;

  select count(*) into n_expedientes
  from public.clinical_records;

  select count(*) into n_asociaciones
  from public.patient_physicians;

  select count(*) into n_datos_personales
  from public.patients
  where birth_date is not null
     or sex is not null
     or phone is not null;

  if n_revisiones > 0
     or n_expedientes > 0
     or n_asociaciones > 0
     or n_datos_personales > 0 then

    raise exception
      'Rollback detenido: % revisiones, % expedientes, % asociaciones y % pacientes con datos personales.',
      n_revisiones,
      n_expedientes,
      n_asociaciones,
      n_datos_personales;
  end if;
end;
$$;

drop function if exists public.open_clinical_record(uuid);

drop function if exists public.save_clinical_revision(
  uuid, integer, text, text, text, text, text, text);

drop function if exists public.register_patient(
  text, date, text, text);

drop policy if exists patients_select_physician_associated
  on public.patients;

drop table if exists public.clinical_record_revisions;
drop table if exists public.clinical_records;
drop table if exists public.patient_physicians;

drop function if exists public.clinical_revisions_immutable();
drop function if exists public.clinical_actor_physician();

drop trigger if exists patients_touch_updated_at
  on public.patients;

drop function if exists public.clinical_touch_updated_at();

alter table public.patients
  drop column if exists birth_date,
  drop column if exists sex,
  drop column if exists phone,
  drop column if exists updated_at;

commit;