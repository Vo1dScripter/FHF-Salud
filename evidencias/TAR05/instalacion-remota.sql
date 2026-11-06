begin;

do $$ begin if exists(select 1 from pg_tables where schemaname = 'public') then raise exception 'Proyecto no vacio: inspeccionar antes de aplicar'; end if; end $$;

create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (version text primary key, name text, statements text[]);

alter table supabase_migrations.schema_migrations enable row level security;

revoke all on schema supabase_migrations from public, anon, authenticated;

revoke all on supabase_migrations.schema_migrations from public, anon, authenticated;

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


insert into supabase_migrations.schema_migrations(version,name,statements) values ('202610250001','reminder_infrastructure',array[$migration_source$-- Infrastructure only; creates no medical tables and schedules no active job.
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
$migration_source$]);

-- RF-01, RF-02 y RF-05: esquema propuesto de pacientes, médicos y citas.
--
-- Esta migración NO se ha ejecutado contra el proyecto remoto. Requiere
-- revisión y aprobación del responsable de datos antes de aplicarse.
--
-- Suposiciones conservadoras:
-- 1. La agenda la opera personal autenticado (admin/recepción). Los médicos
--    solo consultan su propia agenda; no se habilita autoservicio de pacientes.
-- 2. El rol se guarda en app_metadata del JWT (solo editable desde Auth Admin):
--    appointment_role = 'admin' | 'receptionist' | 'physician'.
--    Para physician se exige además physician_id con el UUID del médico.
-- 3. El estado inicial siempre es 'pending'. No hay políticas de UPDATE ni
--    DELETE porque confirmar, reprogramar y cancelar quedan fuera de alcance.
-- 4. La garantía contra solapamientos concurrentes es la restricción EXCLUDE,
--    no una consulta previa del frontend.
-- 5. No se crean usuarios ni datos de prueba. Pacientes y médicos deben
--    aprovisionarse por un proceso administrativo autorizado.

-- Supabase instala las extensiones en el esquema extensions y lo incluye en
-- search_path al aplicar migraciones. Si el proyecto ya la tiene en public,
-- `if not exists` conserva la instalación existente.
create extension if not exists btree_gist with schema extensions;

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint patients_display_name_check
    check (char_length(btrim(display_name)) between 1 and 200)
);

create table public.physicians (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint physicians_display_name_check
    check (char_length(btrim(display_name)) between 1 and 200)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null,
  physician_id uuid not null,
  starts_at timestamptz not null,
  duration_minutes smallint not null,
  -- Se mantiene por trigger: una columna generada exigiría una expresión
  -- inmutable y timestamptz + interval es estable, no inmutable.
  ends_at timestamptz not null,
  reason text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_patient_id_fkey
    foreign key (patient_id) references public.patients (id)
    on update restrict on delete restrict,
  constraint appointments_physician_id_fkey
    foreign key (physician_id) references public.physicians (id)
    on update restrict on delete restrict,
  constraint appointments_duration_check
    check (duration_minutes in (15, 30, 45, 60)),
  constraint appointments_status_check
    check (status in ('pending', 'confirmed', 'cancelled')),
  constraint appointments_reason_check
    check (char_length(btrim(reason)) between 1 and 500),
  constraint appointments_ends_at_check
    check (ends_at > starts_at),
  constraint appointments_no_overlap
    exclude using gist (
      physician_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (status <> 'cancelled')
);

create index appointments_physician_starts_idx
  on public.appointments (physician_id, starts_at);
create index appointments_patient_starts_idx
  on public.appointments (patient_id, starts_at);
create index appointments_status_starts_idx
  on public.appointments (status, starts_at);
create index appointments_physician_patient_idx
  on public.appointments (physician_id, patient_id);

create or replace function public.set_appointment_times()
returns trigger
language plpgsql
as $$
begin
  new.ends_at := new.starts_at + make_interval(mins => new.duration_minutes);
  new.updated_at := now();
  return new;
end;
$$;

create trigger appointments_set_times
before insert or update on public.appointments
for each row execute function public.set_appointment_times();

-- Helpers de autorización: leen exclusivamente el JWT firmado.
create or replace function public.appointment_role()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'appointment_role', '');
$$;

create or replace function public.appointment_physician_id()
returns text
language sql
stable
as $$
  -- UUID en minúsculas: las columnas uuid se serializan así y la comparación
  -- textual de las políticas no debe depender de mayúsculas en app_metadata.
  select lower(nullif(auth.jwt() -> 'app_metadata' ->> 'physician_id', ''));
$$;

alter table public.patients enable row level security;
alter table public.physicians enable row level security;
alter table public.appointments enable row level security;

create policy patients_select_staff
on public.patients
for select
to authenticated
using (
  public.appointment_role() in ('admin', 'receptionist')
);

-- Un médico solo puede resolver pacientes que tengan alguna cita con él.
-- La subconsulta está sujeta a la política de appointments, que ya limita
-- las filas del médico; no hay recursión entre ambas políticas.
create policy patients_select_physician_own_appointments
on public.patients
for select
to authenticated
using (
  public.appointment_role() = 'physician'
  and exists (
    select 1
    from public.appointments as appointment
    where appointment.patient_id = patients.id
      and appointment.physician_id::text = public.appointment_physician_id()
  )
);

create policy physicians_select_staff
on public.physicians
for select
to authenticated
using (
  public.appointment_role() in ('admin', 'receptionist')
);

create policy physicians_select_self
on public.physicians
for select
to authenticated
using (
  public.appointment_role() = 'physician'
  and id::text = public.appointment_physician_id()
);

create policy appointments_select_staff
on public.appointments
for select
to authenticated
using (
  public.appointment_role() in ('admin', 'receptionist')
  or (
    public.appointment_role() = 'physician'
    and physician_id::text = public.appointment_physician_id()
  )
);

create policy appointments_insert_staff
on public.appointments
for insert
to authenticated
with check (
  public.appointment_role() in ('admin', 'receptionist')
  and status = 'pending'
);

-- Sin políticas de UPDATE/DELETE: RF-03 y RF-04 quedan fuera de esta entrega.
-- Se revoca también authenticated para no depender de los privilegios por
-- defecto del proyecto y conceder solo lo necesario.
revoke all on public.patients from anon, authenticated;
revoke all on public.physicians from anon, authenticated;
revoke all on public.appointments from anon, authenticated;

grant select on public.patients to authenticated;
grant select on public.physicians to authenticated;
grant select, insert on public.appointments to authenticated;

comment on table public.patients is
  'Pacientes mínimos para agenda. Aprovisionamiento administrativo pendiente.';
comment on table public.physicians is
  'Médicos mínimos para agenda. Aprovisionamiento administrativo pendiente.';
comment on table public.appointments is
  'Citas RF-01/RF-02/RF-05. La restricción appointments_no_overlap protege concurrencia.';


insert into supabase_migrations.schema_migrations(version,name,statements) values ('202610250002','appointments',array[$migration_source$-- RF-01, RF-02 y RF-05: esquema propuesto de pacientes, médicos y citas.
--
-- Esta migración NO se ha ejecutado contra el proyecto remoto. Requiere
-- revisión y aprobación del responsable de datos antes de aplicarse.
--
-- Suposiciones conservadoras:
-- 1. La agenda la opera personal autenticado (admin/recepción). Los médicos
--    solo consultan su propia agenda; no se habilita autoservicio de pacientes.
-- 2. El rol se guarda en app_metadata del JWT (solo editable desde Auth Admin):
--    appointment_role = 'admin' | 'receptionist' | 'physician'.
--    Para physician se exige además physician_id con el UUID del médico.
-- 3. El estado inicial siempre es 'pending'. No hay políticas de UPDATE ni
--    DELETE porque confirmar, reprogramar y cancelar quedan fuera de alcance.
-- 4. La garantía contra solapamientos concurrentes es la restricción EXCLUDE,
--    no una consulta previa del frontend.
-- 5. No se crean usuarios ni datos de prueba. Pacientes y médicos deben
--    aprovisionarse por un proceso administrativo autorizado.

-- Supabase instala las extensiones en el esquema extensions y lo incluye en
-- search_path al aplicar migraciones. Si el proyecto ya la tiene en public,
-- `if not exists` conserva la instalación existente.
create extension if not exists btree_gist with schema extensions;

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint patients_display_name_check
    check (char_length(btrim(display_name)) between 1 and 200)
);

create table public.physicians (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint physicians_display_name_check
    check (char_length(btrim(display_name)) between 1 and 200)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null,
  physician_id uuid not null,
  starts_at timestamptz not null,
  duration_minutes smallint not null,
  -- Se mantiene por trigger: una columna generada exigiría una expresión
  -- inmutable y timestamptz + interval es estable, no inmutable.
  ends_at timestamptz not null,
  reason text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_patient_id_fkey
    foreign key (patient_id) references public.patients (id)
    on update restrict on delete restrict,
  constraint appointments_physician_id_fkey
    foreign key (physician_id) references public.physicians (id)
    on update restrict on delete restrict,
  constraint appointments_duration_check
    check (duration_minutes in (15, 30, 45, 60)),
  constraint appointments_status_check
    check (status in ('pending', 'confirmed', 'cancelled')),
  constraint appointments_reason_check
    check (char_length(btrim(reason)) between 1 and 500),
  constraint appointments_ends_at_check
    check (ends_at > starts_at),
  constraint appointments_no_overlap
    exclude using gist (
      physician_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (status <> 'cancelled')
);

create index appointments_physician_starts_idx
  on public.appointments (physician_id, starts_at);
create index appointments_patient_starts_idx
  on public.appointments (patient_id, starts_at);
create index appointments_status_starts_idx
  on public.appointments (status, starts_at);
create index appointments_physician_patient_idx
  on public.appointments (physician_id, patient_id);

create or replace function public.set_appointment_times()
returns trigger
language plpgsql
as $$
begin
  new.ends_at := new.starts_at + make_interval(mins => new.duration_minutes);
  new.updated_at := now();
  return new;
end;
$$;

create trigger appointments_set_times
before insert or update on public.appointments
for each row execute function public.set_appointment_times();

-- Helpers de autorización: leen exclusivamente el JWT firmado.
create or replace function public.appointment_role()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'appointment_role', '');
$$;

create or replace function public.appointment_physician_id()
returns text
language sql
stable
as $$
  -- UUID en minúsculas: las columnas uuid se serializan así y la comparación
  -- textual de las políticas no debe depender de mayúsculas en app_metadata.
  select lower(nullif(auth.jwt() -> 'app_metadata' ->> 'physician_id', ''));
$$;

alter table public.patients enable row level security;
alter table public.physicians enable row level security;
alter table public.appointments enable row level security;

create policy patients_select_staff
on public.patients
for select
to authenticated
using (
  public.appointment_role() in ('admin', 'receptionist')
);

-- Un médico solo puede resolver pacientes que tengan alguna cita con él.
-- La subconsulta está sujeta a la política de appointments, que ya limita
-- las filas del médico; no hay recursión entre ambas políticas.
create policy patients_select_physician_own_appointments
on public.patients
for select
to authenticated
using (
  public.appointment_role() = 'physician'
  and exists (
    select 1
    from public.appointments as appointment
    where appointment.patient_id = patients.id
      and appointment.physician_id::text = public.appointment_physician_id()
  )
);

create policy physicians_select_staff
on public.physicians
for select
to authenticated
using (
  public.appointment_role() in ('admin', 'receptionist')
);

create policy physicians_select_self
on public.physicians
for select
to authenticated
using (
  public.appointment_role() = 'physician'
  and id::text = public.appointment_physician_id()
);

create policy appointments_select_staff
on public.appointments
for select
to authenticated
using (
  public.appointment_role() in ('admin', 'receptionist')
  or (
    public.appointment_role() = 'physician'
    and physician_id::text = public.appointment_physician_id()
  )
);

create policy appointments_insert_staff
on public.appointments
for insert
to authenticated
with check (
  public.appointment_role() in ('admin', 'receptionist')
  and status = 'pending'
);

-- Sin políticas de UPDATE/DELETE: RF-03 y RF-04 quedan fuera de esta entrega.
-- Se revoca también authenticated para no depender de los privilegios por
-- defecto del proyecto y conceder solo lo necesario.
revoke all on public.patients from anon, authenticated;
revoke all on public.physicians from anon, authenticated;
revoke all on public.appointments from anon, authenticated;

grant select on public.patients to authenticated;
grant select on public.physicians to authenticated;
grant select, insert on public.appointments to authenticated;

comment on table public.patients is
  'Pacientes mínimos para agenda. Aprovisionamiento administrativo pendiente.';
comment on table public.physicians is
  'Médicos mínimos para agenda. Aprovisionamiento administrativo pendiente.';
comment on table public.appointments is
  'Citas RF-01/RF-02/RF-05. La restricción appointments_no_overlap protege concurrencia.';
$migration_source$]);

-- TAR05: la propuesta original se conserva en docs/sql-historico/.
-- No ejecutar dos modelos incompatibles sobre patients/physicians/appointments.
-- El contrato real utiliza starts_at/ends_at, active y roles app_metadata.
-- Esta version se conserva en la secuencia para no alterar numeros de historial.
-- Si el remoto tiene el modelo alternativo, detenerse para planificar su conversion
-- con respaldo; no eliminar tablas ni marcar migraciones como aplicadas a ciegas.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'appointments'
      and column_name = 'starts_at'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'appointments'
      and column_name = 'ends_at'
  ) then
    raise exception 'Esquema incompatible: se requiere auditar y convertir antes de continuar';
  end if;
end;
$$;


insert into supabase_migrations.schema_migrations(version,name,statements) values ('202610260001','citas_medicas_schema',array[$migration_source$-- TAR05: la propuesta original se conserva en docs/sql-historico/.
-- No ejecutar dos modelos incompatibles sobre patients/physicians/appointments.
-- El contrato real utiliza starts_at/ends_at, active y roles app_metadata.
-- Esta version se conserva en la secuencia para no alterar numeros de historial.
-- Si el remoto tiene el modelo alternativo, detenerse para planificar su conversion
-- con respaldo; no eliminar tablas ni marcar migraciones como aplicadas a ciegas.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'appointments'
      and column_name = 'starts_at'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'appointments'
      and column_name = 'ends_at'
  ) then
    raise exception 'Esquema incompatible: se requiere auditar y convertir antes de continuar';
  end if;
end;
$$;
$migration_source$]);

-- RF-03, RF-04 y RF-06: reprogramar, cancelar y confirmar citas.
--
-- La migración anterior dejó el esquema y la lectura. Esta migración añade:
--   * auditoría mínima de cancelación y confirmación;
--   * historial de eventos de la cita;
--   * funciones transaccionales que bloquean la fila, validan la versión y
--     aplican las reglas de estado;
--   * permisos de ejecución solo para personal autenticado.
--
-- No se conceden UPDATE ni DELETE directos sobre public.appointments. Las
-- funciones son el único camino de mutación y vuelven a aplicar autorización.
-- La restricción appointments_no_overlap sigue siendo la garantía atómica de
-- disponibilidad; las canceladas no bloquean el horario.

alter table public.appointments
  add column if not exists cancellation_reason text;
alter table public.appointments
  add column if not exists cancelled_at timestamptz;
alter table public.appointments
  add column if not exists cancelled_by uuid;
alter table public.appointments
  add column if not exists confirmed_at timestamptz;
alter table public.appointments
  add column if not exists confirmed_by uuid;

-- Compatibilidad con una eventual cancelación anterior a esta migración.
update public.appointments
set
  cancelled_at = coalesce(cancelled_at, updated_at, created_at),
  cancellation_reason = coalesce(
    nullif(btrim(cancellation_reason), ''),
    'Cancelación registrada antes de habilitar la auditoría'
  )
where status = 'cancelled'
  and (cancelled_at is null or cancellation_reason is null);

alter table public.appointments
  add constraint appointments_cancellation_fields_check
  check (
    (
      status = 'cancelled'
      and cancelled_at is not null
      and cancellation_reason is not null
      and char_length(btrim(cancellation_reason)) between 1 and 500
    )
    or (
      status <> 'cancelled'
      and cancelled_at is null
      and cancelled_by is null
      and cancellation_reason is null
    )
  );

create table public.appointment_events (
  id bigint generated always as identity primary key,
  appointment_id uuid not null,
  event_type text not null,
  previous_status text,
  new_status text,
  previous_starts_at timestamptz,
  new_starts_at timestamptz,
  previous_duration_minutes smallint,
  new_duration_minutes smallint,
  cancellation_reason text,
  actor_user_id uuid,
  occurred_at timestamptz not null default now(),
  constraint appointment_events_appointment_id_fkey
    foreign key (appointment_id) references public.appointments (id)
    on update restrict on delete restrict,
  constraint appointment_events_type_check
    check (
      event_type in ('created', 'confirmed', 'rescheduled', 'cancelled', 'updated')
    )
);

create index appointment_events_appointment_occurred_idx
  on public.appointment_events (appointment_id, occurred_at desc);

create or replace function public.record_appointment_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  event_name text;
begin
  if tg_op = 'INSERT' then
    event_name := 'created';
  elsif
    old.starts_at is distinct from new.starts_at
    or old.duration_minutes is distinct from new.duration_minutes
  then
    -- Tiene prioridad sobre el cambio de estado: reprogramar una confirmada
    -- también la devuelve a pending en la misma escritura.
    event_name := 'rescheduled';
  elsif old.status is distinct from new.status then
    event_name := case new.status
      when 'confirmed' then 'confirmed'
      when 'cancelled' then 'cancelled'
      else 'updated'
    end;
  else
    event_name := 'updated';
  end if;

  insert into public.appointment_events (
    appointment_id,
    event_type,
    previous_status,
    new_status,
    previous_starts_at,
    new_starts_at,
    previous_duration_minutes,
    new_duration_minutes,
    cancellation_reason,
    actor_user_id
  )
  values (
    new.id,
    event_name,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    case when tg_op = 'INSERT' then null else old.starts_at end,
    new.starts_at,
    case when tg_op = 'INSERT' then null else old.duration_minutes end,
    new.duration_minutes,
    new.cancellation_reason,
    auth.uid()
  );

  return new;
end;
$$;

create trigger appointments_record_event
after insert or update on public.appointments
for each row execute function public.record_appointment_event();

alter table public.appointment_events enable row level security;

create policy appointment_events_select_staff
on public.appointment_events
for select
to authenticated
using (
  public.appointment_role() in ('admin', 'receptionist')
);

create policy appointment_events_select_physician
on public.appointment_events
for select
to authenticated
using (
  public.appointment_role() = 'physician'
  and exists (
    select 1
    from public.appointments as appointment
    where appointment.id = appointment_events.appointment_id
      and appointment.physician_id::text = public.appointment_physician_id()
  )
);

revoke all on public.appointment_events from anon, authenticated;
grant select on public.appointment_events to authenticated;

create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_expected_updated_at timestamptz,
  p_starts_at timestamptz,
  p_duration_minutes smallint
)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_appointment public.appointments%rowtype;
  updated_appointment public.appointments%rowtype;
  next_status text;
begin
  if auth.uid() is null then
    raise exception 'La sesión no es válida.' using errcode = '42501';
  end if;
  if public.appointment_role() not in ('admin', 'receptionist') then
    raise exception 'Solo administración o recepción puede modificar citas.'
      using errcode = '42501';
  end if;
  if
    p_appointment_id is null
    or p_expected_updated_at is null
    or p_starts_at is null
    or p_duration_minutes not in (15, 30, 45, 60)
  then
    raise exception 'Los datos de la reprogramación no son válidos.'
      using errcode = 'PT400';
  end if;

  select *
  into current_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'La cita no existe.' using errcode = 'PT404';
  end if;
  if current_appointment.status = 'cancelled' then
    raise exception 'No se puede reprogramar una cita cancelada.'
      using errcode = 'PT422';
  end if;
  if current_appointment.updated_at is distinct from p_expected_updated_at then
    raise exception 'La cita cambió mientras se editaba.'
      using errcode = 'PT409';
  end if;
  if p_starts_at < now() - interval '1 minute' then
    raise exception 'La cita no puede quedar en el pasado.'
      using errcode = 'PT400';
  end if;

  -- Una cita confirmada vuelve a pendiente para validar el nuevo horario.
  next_status := case
    when current_appointment.status = 'confirmed' then 'pending'
    else current_appointment.status
  end;

  update public.appointments
  set
    starts_at = p_starts_at,
    duration_minutes = p_duration_minutes,
    status = next_status,
    confirmed_at = null,
    confirmed_by = null
  where id = p_appointment_id
  returning * into updated_appointment;

  return updated_appointment;
end;
$$;

create or replace function public.confirm_appointment(
  p_appointment_id uuid,
  p_expected_updated_at timestamptz
)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_appointment public.appointments%rowtype;
  updated_appointment public.appointments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'La sesión no es válida.' using errcode = '42501';
  end if;
  if public.appointment_role() not in ('admin', 'receptionist') then
    raise exception 'Solo administración o recepción puede modificar citas.'
      using errcode = '42501';
  end if;
  if p_appointment_id is null or p_expected_updated_at is null then
    raise exception 'Los datos de la confirmación no son válidos.'
      using errcode = 'PT400';
  end if;

  select *
  into current_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'La cita no existe.' using errcode = 'PT404';
  end if;
  if current_appointment.status = 'cancelled' then
    raise exception 'No se puede confirmar una cita cancelada.'
      using errcode = 'PT422';
  end if;
  if current_appointment.updated_at is distinct from p_expected_updated_at then
    raise exception 'La cita cambió mientras se editaba.'
      using errcode = 'PT409';
  end if;
  if current_appointment.status = 'confirmed' then
    return current_appointment;
  end if;

  update public.appointments
  set
    status = 'confirmed',
    confirmed_at = now(),
    confirmed_by = auth.uid()
  where id = p_appointment_id
  returning * into updated_appointment;

  return updated_appointment;
end;
$$;

create or replace function public.cancel_appointment(
  p_appointment_id uuid,
  p_expected_updated_at timestamptz,
  p_reason text
)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_appointment public.appointments%rowtype;
  updated_appointment public.appointments%rowtype;
  clean_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.uid() is null then
    raise exception 'La sesión no es válida.' using errcode = '42501';
  end if;
  if public.appointment_role() not in ('admin', 'receptionist') then
    raise exception 'Solo administración o recepción puede modificar citas.'
      using errcode = '42501';
  end if;
  if p_appointment_id is null or p_expected_updated_at is null then
    raise exception 'Los datos de la cancelación no son válidos.'
      using errcode = 'PT400';
  end if;

  select *
  into current_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'La cita no existe.' using errcode = 'PT404';
  end if;

  -- Reintentar una cancelación no cambia la fila ni duplica la auditoría.
  if current_appointment.status = 'cancelled' then
    return current_appointment;
  end if;
  if char_length(clean_reason) not between 1 and 500 then
    raise exception 'Indica un motivo de cancelación válido.'
      using errcode = 'PT400';
  end if;
  if current_appointment.updated_at is distinct from p_expected_updated_at then
    raise exception 'La cita cambió mientras se editaba.'
      using errcode = 'PT409';
  end if;

  update public.appointments
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_reason = clean_reason
  where id = p_appointment_id
  returning * into updated_appointment;

  return updated_appointment;
end;
$$;

revoke all on function public.reschedule_appointment(
  uuid,
  timestamptz,
  timestamptz,
  smallint
) from public;
revoke all on function public.confirm_appointment(
  uuid,
  timestamptz
) from public;
revoke all on function public.cancel_appointment(
  uuid,
  timestamptz,
  text
) from public;

grant execute on function public.reschedule_appointment(
  uuid,
  timestamptz,
  timestamptz,
  smallint
) to authenticated;
grant execute on function public.confirm_appointment(
  uuid,
  timestamptz
) to authenticated;
grant execute on function public.cancel_appointment(
  uuid,
  timestamptz,
  text
) to authenticated;

comment on table public.appointment_events is
  'Historial append-only de creación, confirmación, reprogramación y cancelación.';
comment on function public.reschedule_appointment(uuid, timestamptz, timestamptz, smallint) is
  'RF-03: reprograma bajo bloqueo y revalida disponibilidad con la restricción EXCLUDE.';
comment on function public.confirm_appointment(uuid, timestamptz) is
  'RF-06: confirma solo citas pendientes; rechaza canceladas.';
comment on function public.cancel_appointment(uuid, timestamptz, text) is
  'RF-04: conserva la fila, guarda el motivo y libera el horario.';


insert into supabase_migrations.schema_migrations(version,name,statements) values ('202610260003','appointment_actions',array[$migration_source$-- RF-03, RF-04 y RF-06: reprogramar, cancelar y confirmar citas.
--
-- La migración anterior dejó el esquema y la lectura. Esta migración añade:
--   * auditoría mínima de cancelación y confirmación;
--   * historial de eventos de la cita;
--   * funciones transaccionales que bloquean la fila, validan la versión y
--     aplican las reglas de estado;
--   * permisos de ejecución solo para personal autenticado.
--
-- No se conceden UPDATE ni DELETE directos sobre public.appointments. Las
-- funciones son el único camino de mutación y vuelven a aplicar autorización.
-- La restricción appointments_no_overlap sigue siendo la garantía atómica de
-- disponibilidad; las canceladas no bloquean el horario.

alter table public.appointments
  add column if not exists cancellation_reason text;
alter table public.appointments
  add column if not exists cancelled_at timestamptz;
alter table public.appointments
  add column if not exists cancelled_by uuid;
alter table public.appointments
  add column if not exists confirmed_at timestamptz;
alter table public.appointments
  add column if not exists confirmed_by uuid;

-- Compatibilidad con una eventual cancelación anterior a esta migración.
update public.appointments
set
  cancelled_at = coalesce(cancelled_at, updated_at, created_at),
  cancellation_reason = coalesce(
    nullif(btrim(cancellation_reason), ''),
    'Cancelación registrada antes de habilitar la auditoría'
  )
where status = 'cancelled'
  and (cancelled_at is null or cancellation_reason is null);

alter table public.appointments
  add constraint appointments_cancellation_fields_check
  check (
    (
      status = 'cancelled'
      and cancelled_at is not null
      and cancellation_reason is not null
      and char_length(btrim(cancellation_reason)) between 1 and 500
    )
    or (
      status <> 'cancelled'
      and cancelled_at is null
      and cancelled_by is null
      and cancellation_reason is null
    )
  );

create table public.appointment_events (
  id bigint generated always as identity primary key,
  appointment_id uuid not null,
  event_type text not null,
  previous_status text,
  new_status text,
  previous_starts_at timestamptz,
  new_starts_at timestamptz,
  previous_duration_minutes smallint,
  new_duration_minutes smallint,
  cancellation_reason text,
  actor_user_id uuid,
  occurred_at timestamptz not null default now(),
  constraint appointment_events_appointment_id_fkey
    foreign key (appointment_id) references public.appointments (id)
    on update restrict on delete restrict,
  constraint appointment_events_type_check
    check (
      event_type in ('created', 'confirmed', 'rescheduled', 'cancelled', 'updated')
    )
);

create index appointment_events_appointment_occurred_idx
  on public.appointment_events (appointment_id, occurred_at desc);

create or replace function public.record_appointment_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  event_name text;
begin
  if tg_op = 'INSERT' then
    event_name := 'created';
  elsif
    old.starts_at is distinct from new.starts_at
    or old.duration_minutes is distinct from new.duration_minutes
  then
    -- Tiene prioridad sobre el cambio de estado: reprogramar una confirmada
    -- también la devuelve a pending en la misma escritura.
    event_name := 'rescheduled';
  elsif old.status is distinct from new.status then
    event_name := case new.status
      when 'confirmed' then 'confirmed'
      when 'cancelled' then 'cancelled'
      else 'updated'
    end;
  else
    event_name := 'updated';
  end if;

  insert into public.appointment_events (
    appointment_id,
    event_type,
    previous_status,
    new_status,
    previous_starts_at,
    new_starts_at,
    previous_duration_minutes,
    new_duration_minutes,
    cancellation_reason,
    actor_user_id
  )
  values (
    new.id,
    event_name,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    case when tg_op = 'INSERT' then null else old.starts_at end,
    new.starts_at,
    case when tg_op = 'INSERT' then null else old.duration_minutes end,
    new.duration_minutes,
    new.cancellation_reason,
    auth.uid()
  );

  return new;
end;
$$;

create trigger appointments_record_event
after insert or update on public.appointments
for each row execute function public.record_appointment_event();

alter table public.appointment_events enable row level security;

create policy appointment_events_select_staff
on public.appointment_events
for select
to authenticated
using (
  public.appointment_role() in ('admin', 'receptionist')
);

create policy appointment_events_select_physician
on public.appointment_events
for select
to authenticated
using (
  public.appointment_role() = 'physician'
  and exists (
    select 1
    from public.appointments as appointment
    where appointment.id = appointment_events.appointment_id
      and appointment.physician_id::text = public.appointment_physician_id()
  )
);

revoke all on public.appointment_events from anon, authenticated;
grant select on public.appointment_events to authenticated;

create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_expected_updated_at timestamptz,
  p_starts_at timestamptz,
  p_duration_minutes smallint
)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_appointment public.appointments%rowtype;
  updated_appointment public.appointments%rowtype;
  next_status text;
begin
  if auth.uid() is null then
    raise exception 'La sesión no es válida.' using errcode = '42501';
  end if;
  if public.appointment_role() not in ('admin', 'receptionist') then
    raise exception 'Solo administración o recepción puede modificar citas.'
      using errcode = '42501';
  end if;
  if
    p_appointment_id is null
    or p_expected_updated_at is null
    or p_starts_at is null
    or p_duration_minutes not in (15, 30, 45, 60)
  then
    raise exception 'Los datos de la reprogramación no son válidos.'
      using errcode = 'PT400';
  end if;

  select *
  into current_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'La cita no existe.' using errcode = 'PT404';
  end if;
  if current_appointment.status = 'cancelled' then
    raise exception 'No se puede reprogramar una cita cancelada.'
      using errcode = 'PT422';
  end if;
  if current_appointment.updated_at is distinct from p_expected_updated_at then
    raise exception 'La cita cambió mientras se editaba.'
      using errcode = 'PT409';
  end if;
  if p_starts_at < now() - interval '1 minute' then
    raise exception 'La cita no puede quedar en el pasado.'
      using errcode = 'PT400';
  end if;

  -- Una cita confirmada vuelve a pendiente para validar el nuevo horario.
  next_status := case
    when current_appointment.status = 'confirmed' then 'pending'
    else current_appointment.status
  end;

  update public.appointments
  set
    starts_at = p_starts_at,
    duration_minutes = p_duration_minutes,
    status = next_status,
    confirmed_at = null,
    confirmed_by = null
  where id = p_appointment_id
  returning * into updated_appointment;

  return updated_appointment;
end;
$$;

create or replace function public.confirm_appointment(
  p_appointment_id uuid,
  p_expected_updated_at timestamptz
)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_appointment public.appointments%rowtype;
  updated_appointment public.appointments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'La sesión no es válida.' using errcode = '42501';
  end if;
  if public.appointment_role() not in ('admin', 'receptionist') then
    raise exception 'Solo administración o recepción puede modificar citas.'
      using errcode = '42501';
  end if;
  if p_appointment_id is null or p_expected_updated_at is null then
    raise exception 'Los datos de la confirmación no son válidos.'
      using errcode = 'PT400';
  end if;

  select *
  into current_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'La cita no existe.' using errcode = 'PT404';
  end if;
  if current_appointment.status = 'cancelled' then
    raise exception 'No se puede confirmar una cita cancelada.'
      using errcode = 'PT422';
  end if;
  if current_appointment.updated_at is distinct from p_expected_updated_at then
    raise exception 'La cita cambió mientras se editaba.'
      using errcode = 'PT409';
  end if;
  if current_appointment.status = 'confirmed' then
    return current_appointment;
  end if;

  update public.appointments
  set
    status = 'confirmed',
    confirmed_at = now(),
    confirmed_by = auth.uid()
  where id = p_appointment_id
  returning * into updated_appointment;

  return updated_appointment;
end;
$$;

create or replace function public.cancel_appointment(
  p_appointment_id uuid,
  p_expected_updated_at timestamptz,
  p_reason text
)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_appointment public.appointments%rowtype;
  updated_appointment public.appointments%rowtype;
  clean_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.uid() is null then
    raise exception 'La sesión no es válida.' using errcode = '42501';
  end if;
  if public.appointment_role() not in ('admin', 'receptionist') then
    raise exception 'Solo administración o recepción puede modificar citas.'
      using errcode = '42501';
  end if;
  if p_appointment_id is null or p_expected_updated_at is null then
    raise exception 'Los datos de la cancelación no son válidos.'
      using errcode = 'PT400';
  end if;

  select *
  into current_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'La cita no existe.' using errcode = 'PT404';
  end if;

  -- Reintentar una cancelación no cambia la fila ni duplica la auditoría.
  if current_appointment.status = 'cancelled' then
    return current_appointment;
  end if;
  if char_length(clean_reason) not between 1 and 500 then
    raise exception 'Indica un motivo de cancelación válido.'
      using errcode = 'PT400';
  end if;
  if current_appointment.updated_at is distinct from p_expected_updated_at then
    raise exception 'La cita cambió mientras se editaba.'
      using errcode = 'PT409';
  end if;

  update public.appointments
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_reason = clean_reason
  where id = p_appointment_id
  returning * into updated_appointment;

  return updated_appointment;
end;
$$;

revoke all on function public.reschedule_appointment(
  uuid,
  timestamptz,
  timestamptz,
  smallint
) from public;
revoke all on function public.confirm_appointment(
  uuid,
  timestamptz
) from public;
revoke all on function public.cancel_appointment(
  uuid,
  timestamptz,
  text
) from public;

grant execute on function public.reschedule_appointment(
  uuid,
  timestamptz,
  timestamptz,
  smallint
) to authenticated;
grant execute on function public.confirm_appointment(
  uuid,
  timestamptz
) to authenticated;
grant execute on function public.cancel_appointment(
  uuid,
  timestamptz,
  text
) to authenticated;

comment on table public.appointment_events is
  'Historial append-only de creación, confirmación, reprogramación y cancelación.';
comment on function public.reschedule_appointment(uuid, timestamptz, timestamptz, smallint) is
  'RF-03: reprograma bajo bloqueo y revalida disponibilidad con la restricción EXCLUDE.';
comment on function public.confirm_appointment(uuid, timestamptz) is
  'RF-06: confirma solo citas pendientes; rechaza canceladas.';
comment on function public.cancel_appointment(uuid, timestamptz, text) is
  'RF-04: conserva la fila, guarda el motivo y libera el horario.';
$migration_source$]);

-- TAR05: rechazo explicito de roles ausentes en RPC SECURITY DEFINER.
create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_expected_updated_at timestamptz,
  p_starts_at timestamptz,
  p_duration_minutes smallint
)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_appointment public.appointments%rowtype;
  updated_appointment public.appointments%rowtype;
  next_status text;
begin
  if auth.uid() is null then
    raise exception 'La sesión no es válida.' using errcode = '42501';
  end if;
  if coalesce(public.appointment_role(), '') not in ('admin', 'receptionist') then
    raise exception 'Solo administración o recepción puede modificar citas.'
      using errcode = '42501';
  end if;
  if
    p_appointment_id is null
    or p_expected_updated_at is null
    or p_starts_at is null
    or p_duration_minutes not in (15, 30, 45, 60)
  then
    raise exception 'Los datos de la reprogramación no son válidos.'
      using errcode = 'PT400';
  end if;

  select *
  into current_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'La cita no existe.' using errcode = 'PT404';
  end if;
  if current_appointment.status = 'cancelled' then
    raise exception 'No se puede reprogramar una cita cancelada.'
      using errcode = 'PT422';
  end if;
  if current_appointment.updated_at is distinct from p_expected_updated_at then
    raise exception 'La cita cambió mientras se editaba.'
      using errcode = 'PT409';
  end if;
  if p_starts_at < now() - interval '1 minute' then
    raise exception 'La cita no puede quedar en el pasado.'
      using errcode = 'PT400';
  end if;

  -- Una cita confirmada vuelve a pendiente para validar el nuevo horario.
  next_status := case
    when current_appointment.status = 'confirmed' then 'pending'
    else current_appointment.status
  end;

  update public.appointments
  set
    starts_at = p_starts_at,
    duration_minutes = p_duration_minutes,
    status = next_status,
    confirmed_at = null,
    confirmed_by = null
  where id = p_appointment_id
  returning * into updated_appointment;

  return updated_appointment;
end;
$$;

create or replace function public.confirm_appointment(
  p_appointment_id uuid,
  p_expected_updated_at timestamptz
)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_appointment public.appointments%rowtype;
  updated_appointment public.appointments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'La sesión no es válida.' using errcode = '42501';
  end if;
  if coalesce(public.appointment_role(), '') not in ('admin', 'receptionist') then
    raise exception 'Solo administración o recepción puede modificar citas.'
      using errcode = '42501';
  end if;
  if p_appointment_id is null or p_expected_updated_at is null then
    raise exception 'Los datos de la confirmación no son válidos.'
      using errcode = 'PT400';
  end if;

  select *
  into current_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'La cita no existe.' using errcode = 'PT404';
  end if;
  if current_appointment.status = 'cancelled' then
    raise exception 'No se puede confirmar una cita cancelada.'
      using errcode = 'PT422';
  end if;
  if current_appointment.updated_at is distinct from p_expected_updated_at then
    raise exception 'La cita cambió mientras se editaba.'
      using errcode = 'PT409';
  end if;
  if current_appointment.status = 'confirmed' then
    return current_appointment;
  end if;

  update public.appointments
  set
    status = 'confirmed',
    confirmed_at = now(),
    confirmed_by = auth.uid()
  where id = p_appointment_id
  returning * into updated_appointment;

  return updated_appointment;
end;
$$;

create or replace function public.cancel_appointment(
  p_appointment_id uuid,
  p_expected_updated_at timestamptz,
  p_reason text
)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_appointment public.appointments%rowtype;
  updated_appointment public.appointments%rowtype;
  clean_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.uid() is null then
    raise exception 'La sesión no es válida.' using errcode = '42501';
  end if;
  if coalesce(public.appointment_role(), '') not in ('admin', 'receptionist') then
    raise exception 'Solo administración o recepción puede modificar citas.'
      using errcode = '42501';
  end if;
  if p_appointment_id is null or p_expected_updated_at is null then
    raise exception 'Los datos de la cancelación no son válidos.'
      using errcode = 'PT400';
  end if;

  select *
  into current_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'La cita no existe.' using errcode = 'PT404';
  end if;

  -- Reintentar una cancelación no cambia la fila ni duplica la auditoría.
  if current_appointment.status = 'cancelled' then
    return current_appointment;
  end if;
  if char_length(clean_reason) not between 1 and 500 then
    raise exception 'Indica un motivo de cancelación válido.'
      using errcode = 'PT400';
  end if;
  if current_appointment.updated_at is distinct from p_expected_updated_at then
    raise exception 'La cita cambió mientras se editaba.'
      using errcode = 'PT409';
  end if;

  update public.appointments
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_reason = clean_reason
  where id = p_appointment_id
  returning * into updated_appointment;

  return updated_appointment;
end;
$$;


insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611060001','authorization_null_role',array[$migration_source$-- TAR05: rechazo explicito de roles ausentes en RPC SECURITY DEFINER.
create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_expected_updated_at timestamptz,
  p_starts_at timestamptz,
  p_duration_minutes smallint
)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_appointment public.appointments%rowtype;
  updated_appointment public.appointments%rowtype;
  next_status text;
begin
  if auth.uid() is null then
    raise exception 'La sesión no es válida.' using errcode = '42501';
  end if;
  if coalesce(public.appointment_role(), '') not in ('admin', 'receptionist') then
    raise exception 'Solo administración o recepción puede modificar citas.'
      using errcode = '42501';
  end if;
  if
    p_appointment_id is null
    or p_expected_updated_at is null
    or p_starts_at is null
    or p_duration_minutes not in (15, 30, 45, 60)
  then
    raise exception 'Los datos de la reprogramación no son válidos.'
      using errcode = 'PT400';
  end if;

  select *
  into current_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'La cita no existe.' using errcode = 'PT404';
  end if;
  if current_appointment.status = 'cancelled' then
    raise exception 'No se puede reprogramar una cita cancelada.'
      using errcode = 'PT422';
  end if;
  if current_appointment.updated_at is distinct from p_expected_updated_at then
    raise exception 'La cita cambió mientras se editaba.'
      using errcode = 'PT409';
  end if;
  if p_starts_at < now() - interval '1 minute' then
    raise exception 'La cita no puede quedar en el pasado.'
      using errcode = 'PT400';
  end if;

  -- Una cita confirmada vuelve a pendiente para validar el nuevo horario.
  next_status := case
    when current_appointment.status = 'confirmed' then 'pending'
    else current_appointment.status
  end;

  update public.appointments
  set
    starts_at = p_starts_at,
    duration_minutes = p_duration_minutes,
    status = next_status,
    confirmed_at = null,
    confirmed_by = null
  where id = p_appointment_id
  returning * into updated_appointment;

  return updated_appointment;
end;
$$;

create or replace function public.confirm_appointment(
  p_appointment_id uuid,
  p_expected_updated_at timestamptz
)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_appointment public.appointments%rowtype;
  updated_appointment public.appointments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'La sesión no es válida.' using errcode = '42501';
  end if;
  if coalesce(public.appointment_role(), '') not in ('admin', 'receptionist') then
    raise exception 'Solo administración o recepción puede modificar citas.'
      using errcode = '42501';
  end if;
  if p_appointment_id is null or p_expected_updated_at is null then
    raise exception 'Los datos de la confirmación no son válidos.'
      using errcode = 'PT400';
  end if;

  select *
  into current_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'La cita no existe.' using errcode = 'PT404';
  end if;
  if current_appointment.status = 'cancelled' then
    raise exception 'No se puede confirmar una cita cancelada.'
      using errcode = 'PT422';
  end if;
  if current_appointment.updated_at is distinct from p_expected_updated_at then
    raise exception 'La cita cambió mientras se editaba.'
      using errcode = 'PT409';
  end if;
  if current_appointment.status = 'confirmed' then
    return current_appointment;
  end if;

  update public.appointments
  set
    status = 'confirmed',
    confirmed_at = now(),
    confirmed_by = auth.uid()
  where id = p_appointment_id
  returning * into updated_appointment;

  return updated_appointment;
end;
$$;

create or replace function public.cancel_appointment(
  p_appointment_id uuid,
  p_expected_updated_at timestamptz,
  p_reason text
)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_appointment public.appointments%rowtype;
  updated_appointment public.appointments%rowtype;
  clean_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.uid() is null then
    raise exception 'La sesión no es válida.' using errcode = '42501';
  end if;
  if coalesce(public.appointment_role(), '') not in ('admin', 'receptionist') then
    raise exception 'Solo administración o recepción puede modificar citas.'
      using errcode = '42501';
  end if;
  if p_appointment_id is null or p_expected_updated_at is null then
    raise exception 'Los datos de la cancelación no son válidos.'
      using errcode = 'PT400';
  end if;

  select *
  into current_appointment
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'La cita no existe.' using errcode = 'PT404';
  end if;

  -- Reintentar una cancelación no cambia la fila ni duplica la auditoría.
  if current_appointment.status = 'cancelled' then
    return current_appointment;
  end if;
  if char_length(clean_reason) not between 1 and 500 then
    raise exception 'Indica un motivo de cancelación válido.'
      using errcode = 'PT400';
  end if;
  if current_appointment.updated_at is distinct from p_expected_updated_at then
    raise exception 'La cita cambió mientras se editaba.'
      using errcode = 'PT409';
  end if;

  update public.appointments
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_reason = clean_reason
  where id = p_appointment_id
  returning * into updated_appointment;

  return updated_appointment;
end;
$$;
$migration_source$]);

-- Quinta entidad funcional: ausencias/vacaciones/indisponibilidad del medico.
-- No cambia citas existentes. Bloquear un intervalo ocupado es rechazado.
create table public.physician_schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  physician_id uuid not null references public.physicians(id)
    on update restrict on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  constraint physician_schedule_blocks_interval_check check (ends_at > starts_at),
  constraint physician_schedule_blocks_no_overlap exclude using gist (
    physician_id with =, tstzrange(starts_at, ends_at, '[)') with &&
  )
);
create index physician_schedule_blocks_physician_starts_idx
  on public.physician_schedule_blocks(physician_id, starts_at);

-- Ambos caminos adquieren el mismo bloqueo por medico; serializa la creacion
-- de ausencias y reservas sin depender de una consulta previa en el navegador.
create function public.check_physician_schedule_block() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform 1 from public.physicians where id = new.physician_id for update;
  if tg_table_name = 'appointments' then
    if new.duration_minutes is null or new.duration_minutes not in (15,30,45,60) then
      return new; -- NOT NULL/CHECK conserva el error de integridad correspondiente.
    end if;
    if new.status <> 'cancelled' and exists (
      select 1 from public.physician_schedule_blocks b
      where b.physician_id = new.physician_id
        and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(new.starts_at,
          new.starts_at + make_interval(mins => new.duration_minutes),'[)')
    ) then
      raise exception 'El medico no esta disponible en ese horario.' using errcode = '23P01';
    end if;
  elsif new.ends_at <= new.starts_at then
    return new; -- CHECK valida el intervalo antes de construir un rango.
  elsif exists (
    select 1 from public.appointments a where a.physician_id = new.physician_id
      and a.status <> 'cancelled'
      and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')
  ) then
    raise exception 'El bloqueo se traslapa con una cita activa.' using errcode = '23P01';
  end if;
  return new;
end;
$$;
revoke all on function public.check_physician_schedule_block() from public, anon, authenticated;
create trigger appointments_check_schedule_block before insert or update
  on public.appointments for each row execute function public.check_physician_schedule_block();
create trigger physician_schedule_blocks_check_appointments before insert or update
  on public.physician_schedule_blocks for each row execute function public.check_physician_schedule_block();

alter table public.physician_schedule_blocks enable row level security;
revoke all on public.physician_schedule_blocks from anon, authenticated;
grant select, insert, update, delete on public.physician_schedule_blocks to authenticated;
create policy physician_schedule_blocks_staff on public.physician_schedule_blocks
  for all to authenticated
  using (public.appointment_role() in ('admin','receptionist'))
  with check (public.appointment_role() in ('admin','receptionist'));
create policy physician_schedule_blocks_self on public.physician_schedule_blocks
  for select to authenticated using (
    public.appointment_role() = 'physician' and physician_id::text = public.appointment_physician_id()
  );
comment on table public.physician_schedule_blocks is
  'Indisponibilidad administrativa del medico; no incluye expedientes ni datos clinicos. No elimina historial de citas.';


insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611060002','physician_schedule_blocks',array[$migration_source$-- Quinta entidad funcional: ausencias/vacaciones/indisponibilidad del medico.
-- No cambia citas existentes. Bloquear un intervalo ocupado es rechazado.
create table public.physician_schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  physician_id uuid not null references public.physicians(id)
    on update restrict on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  constraint physician_schedule_blocks_interval_check check (ends_at > starts_at),
  constraint physician_schedule_blocks_no_overlap exclude using gist (
    physician_id with =, tstzrange(starts_at, ends_at, '[)') with &&
  )
);
create index physician_schedule_blocks_physician_starts_idx
  on public.physician_schedule_blocks(physician_id, starts_at);

-- Ambos caminos adquieren el mismo bloqueo por medico; serializa la creacion
-- de ausencias y reservas sin depender de una consulta previa en el navegador.
create function public.check_physician_schedule_block() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform 1 from public.physicians where id = new.physician_id for update;
  if tg_table_name = 'appointments' then
    if new.duration_minutes is null or new.duration_minutes not in (15,30,45,60) then
      return new; -- NOT NULL/CHECK conserva el error de integridad correspondiente.
    end if;
    if new.status <> 'cancelled' and exists (
      select 1 from public.physician_schedule_blocks b
      where b.physician_id = new.physician_id
        and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(new.starts_at,
          new.starts_at + make_interval(mins => new.duration_minutes),'[)')
    ) then
      raise exception 'El medico no esta disponible en ese horario.' using errcode = '23P01';
    end if;
  elsif new.ends_at <= new.starts_at then
    return new; -- CHECK valida el intervalo antes de construir un rango.
  elsif exists (
    select 1 from public.appointments a where a.physician_id = new.physician_id
      and a.status <> 'cancelled'
      and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')
  ) then
    raise exception 'El bloqueo se traslapa con una cita activa.' using errcode = '23P01';
  end if;
  return new;
end;
$$;
revoke all on function public.check_physician_schedule_block() from public, anon, authenticated;
create trigger appointments_check_schedule_block before insert or update
  on public.appointments for each row execute function public.check_physician_schedule_block();
create trigger physician_schedule_blocks_check_appointments before insert or update
  on public.physician_schedule_blocks for each row execute function public.check_physician_schedule_block();

alter table public.physician_schedule_blocks enable row level security;
revoke all on public.physician_schedule_blocks from anon, authenticated;
grant select, insert, update, delete on public.physician_schedule_blocks to authenticated;
create policy physician_schedule_blocks_staff on public.physician_schedule_blocks
  for all to authenticated
  using (public.appointment_role() in ('admin','receptionist'))
  with check (public.appointment_role() in ('admin','receptionist'));
create policy physician_schedule_blocks_self on public.physician_schedule_blocks
  for select to authenticated using (
    public.appointment_role() = 'physician' and physician_id::text = public.appointment_physician_id()
  );
comment on table public.physician_schedule_blocks is
  'Indisponibilidad administrativa del medico; no incluye expedientes ni datos clinicos. No elimina historial de citas.';
$migration_source$]);

commit;

select version,name from supabase_migrations.schema_migrations order by version;