-- PRY06 RF-07 a RF-12: politicas RLS y funciones del expediente clinico.
-- Las escrituras clinicas solo ocurren mediante funciones SECURITY DEFINER
-- (con search_path fijo). No se concede INSERT/UPDATE/DELETE directo.
-- La identidad y el rol salen del JWT firmado, nunca del navegador.

-- 1. Actor autorizado: medico activo, verificado contra la tabla physicians.
create or replace function public.clinical_actor_physician()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select physician.id
  from public.physicians as physician
  where auth.uid() is not null
    and coalesce(public.appointment_role(), '') = 'physician'
    and physician.id::text = public.appointment_physician_id()
    and physician.active;
$$;

-- 2. Politicas de lectura: solo el medico asociado al paciente.
create policy patient_physicians_select_own
on public.patient_physicians
for select
to authenticated
using (
  public.clinical_actor_physician() is not null
  and physician_id = public.clinical_actor_physician()
);

create policy patients_select_physician_associated
on public.patients
for select
to authenticated
using (
  public.clinical_actor_physician() is not null
  and exists (
    select 1
    from public.patient_physicians as link
    where link.patient_id = patients.id
      and link.physician_id = public.clinical_actor_physician()
  )
);

create policy clinical_records_select_associated
on public.clinical_records
for select
to authenticated
using (
  public.clinical_actor_physician() is not null
  and exists (
    select 1
    from public.patient_physicians as link
    where link.patient_id = clinical_records.patient_id
      and link.physician_id = public.clinical_actor_physician()
  )
);

create policy clinical_record_revisions_select_associated
on public.clinical_record_revisions
for select
to authenticated
using (
  public.clinical_actor_physician() is not null
  and exists (
    select 1
    from public.clinical_records as record
    join public.patient_physicians as link
      on link.patient_id = record.patient_id
    where record.id = clinical_record_revisions.record_id
      and link.physician_id = public.clinical_actor_physician()
  )
);

grant select on public.patient_physicians to authenticated;
grant select on public.clinical_records to authenticated;
grant select on public.clinical_record_revisions to authenticated;

-- 3. RF-07: alta transaccional de paciente + asociacion + expediente.
create or replace function public.register_patient(
  p_display_name text,
  p_birth_date date default null,
  p_sex text default null,
  p_phone text default null
)
returns table (new_patient_id uuid, new_record_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_physician uuid := public.clinical_actor_physician();
  clean_name text := btrim(coalesce(p_display_name, ''));
  clean_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  created_patient uuid;
  created_record uuid;
begin
  if auth.uid() is null then
    raise exception 'La sesión no es válida.' using errcode = '42501';
  end if;
  if actor_physician is null then
    raise exception 'Solo un médico autorizado puede registrar pacientes.'
      using errcode = '42501';
  end if;
  if char_length(clean_name) not between 1 and 200 then
    raise exception 'El nombre del paciente no es válido.'
      using errcode = 'PT400';
  end if;
  if p_birth_date is not null
     and (p_birth_date < date '1900-01-01' or p_birth_date > current_date) then
    raise exception 'La fecha de nacimiento no es válida.'
      using errcode = 'PT400';
  end if;
  if p_sex is not null
     and p_sex not in ('female', 'male', 'other', 'unspecified') then
    raise exception 'El sexo indicado no es válido.' using errcode = 'PT400';
  end if;
  if clean_phone is not null and char_length(clean_phone) not between 7 and 20 then
    raise exception 'El teléfono no es válido.' using errcode = 'PT400';
  end if;

  if p_birth_date is not null and exists (
    select 1
    from public.patients as existing
    where lower(btrim(existing.display_name)) = lower(clean_name)
      and existing.birth_date = p_birth_date
  ) then
    raise exception 'Ya existe un paciente con el mismo nombre y fecha de nacimiento.'
      using errcode = 'PT409';
  end if;

  insert into public.patients (display_name, birth_date, sex, phone)
  values (clean_name, p_birth_date, p_sex, clean_phone)
  returning id into created_patient;

  insert into public.patient_physicians (patient_id, physician_id, created_by)
  values (created_patient, actor_physician, auth.uid());

  insert into public.clinical_records (patient_id, created_by_physician_id)
  values (created_patient, actor_physician)
  returning id into created_record;

  return query select created_patient, created_record;
end;
$$;

-- 4. RF-09 y RF-11: nueva revision inmutable con control de concurrencia.
-- p_expected_revision = 0 para la primera revision; despues, la vigente.
create or replace function public.save_clinical_revision(
  p_patient_id uuid,
  p_expected_revision integer,
  p_background text,
  p_allergies_status text,
  p_allergies text,
  p_diagnosis text,
  p_treatment text,
  p_change_reason text default null
)
returns public.clinical_record_revisions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_physician uuid := public.clinical_actor_physician();
  current_record public.clinical_records%rowtype;
  saved_revision public.clinical_record_revisions%rowtype;
  clean_background text := nullif(btrim(coalesce(p_background, '')), '');
  clean_allergies text := nullif(btrim(coalesce(p_allergies, '')), '');
  clean_diagnosis text := nullif(btrim(coalesce(p_diagnosis, '')), '');
  clean_treatment text := nullif(btrim(coalesce(p_treatment, '')), '');
  clean_reason text := nullif(btrim(coalesce(p_change_reason, '')), '');
  next_number integer;
begin
  if auth.uid() is null then
    raise exception 'La sesión no es válida.' using errcode = '42501';
  end if;
  if actor_physician is null then
    raise exception 'Solo un médico autorizado puede registrar información clínica.'
      using errcode = '42501';
  end if;
  if p_patient_id is null or p_expected_revision is null
     or p_expected_revision < 0 then
    raise exception 'Los datos de la revisión no son válidos.'
      using errcode = 'PT400';
  end if;
  if p_allergies_status is null
     or p_allergies_status not in ('not_recorded', 'none_reported', 'reported') then
    raise exception 'El estado de alergias no es válido.' using errcode = 'PT400';
  end if;
  if (p_allergies_status = 'reported') <> (clean_allergies is not null) then
    raise exception 'El estado de alergias no coincide con el texto indicado.'
      using errcode = 'PT400';
  end if;
  if char_length(coalesce(clean_background, '')) > 4000
     or char_length(coalesce(clean_allergies, '')) > 4000
     or char_length(coalesce(clean_diagnosis, '')) > 4000
     or char_length(coalesce(clean_treatment, '')) > 4000
     or char_length(coalesce(clean_reason, '')) > 500 then
    raise exception 'Alguno de los textos excede el límite permitido.'
      using errcode = 'PT400';
  end if;
  if clean_background is null and clean_allergies is null
     and clean_diagnosis is null and clean_treatment is null
     and p_allergies_status = 'not_recorded' then
    raise exception 'No hay información clínica para registrar.'
      using errcode = 'PT400';
  end if;

  if not exists (
    select 1
    from public.patient_physicians as link
    where link.patient_id = p_patient_id
      and link.physician_id = actor_physician
  ) then
    raise exception 'No tienes acceso al expediente de este paciente.'
      using errcode = '42501';
  end if;

  select *
  into current_record
  from public.clinical_records
  where patient_id = p_patient_id
  for update;

  if not found then
    raise exception 'El expediente no existe.' using errcode = 'PT404';
  end if;
  if current_record.current_revision <> p_expected_revision then
    raise exception 'El expediente cambió mientras se editaba.'
      using errcode = 'PT409';
  end if;

  next_number := current_record.current_revision + 1;
  if next_number > 1 and clean_reason is null then
    raise exception 'Indica el motivo del cambio.' using errcode = 'PT400';
  end if;

  insert into public.clinical_record_revisions (
    record_id, revision_number, background, allergies_status, allergies,
    diagnosis, treatment, change_reason, author_user_id, author_physician_id
  )
  values (
    current_record.id, next_number, clean_background, p_allergies_status,
    clean_allergies, clean_diagnosis, clean_treatment, clean_reason,
    auth.uid(), actor_physician
  )
  returning * into saved_revision;

  update public.clinical_records
  set current_revision = next_number
  where id = current_record.id;

  return saved_revision;
end;
$$;

-- 5. Privilegios minimos: solo usuarios autenticados ejecutan las funciones.
revoke all on function public.clinical_actor_physician() from public, anon;
grant execute on function public.clinical_actor_physician() to authenticated;

revoke all on function public.register_patient(text, date, text, text)
  from public, anon;
grant execute on function public.register_patient(text, date, text, text)
  to authenticated;

revoke all on function public.save_clinical_revision(
  uuid, integer, text, text, text, text, text, text
) from public, anon;
grant execute on function public.save_clinical_revision(
  uuid, integer, text, text, text, text, text, text
) to authenticated;
