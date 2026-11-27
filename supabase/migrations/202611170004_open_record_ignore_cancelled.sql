-- PRY06 RF-07/RF-12: una cita cancelada no concede acceso al expediente.
create or replace function public.open_clinical_record(p_patient_id uuid)
returns table (out_patient_id uuid, out_record_id uuid, was_created boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_physician uuid := public.clinical_actor_physician();
  new_record uuid;
begin
  if auth.uid() is null then
    raise exception 'La sesión no es válida.' using errcode = '42501';
  end if;
  if actor_physician is null then
    raise exception 'Solo un médico autorizado puede abrir expedientes.'
      using errcode = '42501';
  end if;
  if p_patient_id is null then
    raise exception 'El paciente indicado no es válido.'
      using errcode = 'PT400';
  end if;
  if not exists (select 1 from public.patients where id = p_patient_id) then
    raise exception 'El paciente no existe.' using errcode = 'PT404';
  end if;
  if not exists (
    select 1
    from public.appointments as appointment
    where appointment.patient_id = p_patient_id
      and appointment.physician_id = actor_physician
      and appointment.status <> 'cancelled'
  ) then
    raise exception 'No tienes una cita vigente con este paciente.'
      using errcode = '42501';
  end if;

  insert into public.patient_physicians (patient_id, physician_id, created_by)
  values (p_patient_id, actor_physician, auth.uid())
  on conflict (patient_id, physician_id) do nothing;

  insert into public.clinical_records (patient_id, created_by_physician_id)
  values (p_patient_id, actor_physician)
  on conflict (patient_id) do nothing
  returning id into new_record;

  if new_record is not null then
    return query select p_patient_id, new_record, true;
  else
    return query
      select p_patient_id, record.id, false
      from public.clinical_records as record
      where record.patient_id = p_patient_id;
  end if;
end;
$$;

revoke all on function public.open_clinical_record(uuid) from public, anon;
grant execute on function public.open_clinical_record(uuid) to authenticated;
