-- PRY07 · integridad: confirmación idempotente también entre transacciones.
--
-- Defecto reproducido: dos solicitudes simultáneas de confirmación envían el
-- mismo p_expected_updated_at. La primera confirma; la segunda espera el
-- bloqueo de fila y, al reanudar, encontraba una versión distinta y devolvía
-- PT409, aunque la cita ya estaba confirmada y no había nada que sobrescribir.
--
-- La corrección mínima es devolver la cita vigente cuando ya está confirmada
-- antes de comparar la versión. No se escribe ninguna fila en ese caso.
-- El control de versión sigue protegiendo la transición pending -> confirmed.

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

  -- Idempotencia real: si ya está confirmada no hay escritura ni conflicto de
  -- versión. Un reintento concurrente devuelve el mismo estado.
  if current_appointment.status = 'confirmed' then
    return current_appointment;
  end if;
  if current_appointment.updated_at is distinct from p_expected_updated_at then
    raise exception 'La cita cambió mientras se editaba.'
      using errcode = 'PT409';
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

revoke all on function public.confirm_appointment(
  uuid,
  timestamptz
) from public;
grant execute on function public.confirm_appointment(
  uuid,
  timestamptz
) to authenticated;

comment on function public.confirm_appointment(uuid, timestamptz) is
  'RF-06: confirma solo citas pendientes; rechaza canceladas. Reintentar una confirmación es idempotente incluso con una versión anterior, sin escribir la fila.';
