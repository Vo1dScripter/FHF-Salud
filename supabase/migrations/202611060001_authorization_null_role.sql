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
