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
