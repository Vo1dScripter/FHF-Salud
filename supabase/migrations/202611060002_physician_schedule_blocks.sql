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
