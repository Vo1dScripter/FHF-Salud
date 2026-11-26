-- PRY07 · Emilio Martínez · Integridad referencial y restricciones.
-- PostgreSQL 17 local y desechable. Solo datos ficticios.
-- Este archivo no se ejecuta contra Supabase remoto.
--
-- Cada caso se registra en public.pry07_results y el runner
-- scripts/pry07/verify-integrity-security.py genera el conteo real.

\set ON_ERROR_STOP on

drop table if exists public.pry07_results;
create table public.pry07_results (
  id text primary key,
  status text not null check (status in ('PASS', 'FAIL')),
  description text not null,
  detail text
);
grant select, insert, update on public.pry07_results to authenticated;
grant select, insert, update on public.pry07_results to anon;

create or replace function public.pry07_check(
  p_id text,
  p_description text,
  p_ok boolean,
  p_detail text default null
)
returns void
language plpgsql
as $$
begin
  insert into public.pry07_results (id, status, description, detail)
  values (
    p_id,
    case when p_ok then 'PASS' else 'FAIL' end,
    p_description,
    p_detail
  )
  on conflict (id) do update
  set status = excluded.status,
      description = excluded.description,
      detail = excluded.detail;
end;
$$;

create or replace function public.pry07_expect_error(
  p_id text,
  p_description text,
  p_sql text,
  p_expected_state text
)
returns void
language plpgsql
as $$
declare
  actual_state text;
  actual_message text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics
      actual_state = returned_sqlstate,
      actual_message = message_text;
    perform public.pry07_check(
      p_id,
      p_description,
      actual_state = p_expected_state,
      format('esperado=%s obtenido=%s mensaje=%s',
        p_expected_state, actual_state, actual_message)
    );
    return;
  end;
  perform public.pry07_check(
    p_id,
    p_description,
    false,
    format('sin error; esperado=%s', p_expected_state)
  );
end;
$$;

-- Identificadores y datos ficticios de esta corrida.
insert into public.patients (id, display_name) values
  ('7e000000-0000-4000-8000-000000000001', 'Paciente Ficticio Uno'),
  ('7e000000-0000-4000-8000-000000000002', 'Paciente Ficticio Dos');

insert into public.physicians (id, display_name) values
  ('7e000000-0000-4000-8000-0000000000a1', 'Dra. Ficticia Uno'),
  ('7e000000-0000-4000-8000-0000000000a2', 'Dr. Ficticio Dos');

insert into public.appointments (
  id, patient_id, physician_id, starts_at, duration_minutes, reason
) values (
  '7e000000-0000-4000-8000-000000000101',
  '7e000000-0000-4000-8000-000000000001',
  '7e000000-0000-4000-8000-0000000000a1',
  '2035-06-01T09:00:00Z',
  30,
  'Consulta ficticia válida'
);

insert into public.physician_schedule_blocks (
  id, physician_id, starts_at, ends_at, reason
) values (
  '7e000000-0000-4000-8000-000000000201',
  '7e000000-0000-4000-8000-0000000000a2',
  '2035-06-03T09:00:00Z',
  '2035-06-03T10:00:00Z',
  'Ausencia ficticia'
);

-- INT-01 · FK de paciente inexistente.
select public.pry07_expect_error(
  'INT-01',
  'Rechaza una cita con paciente inexistente (FK)',
  $q$insert into public.appointments (
    patient_id, physician_id, starts_at, duration_minutes, reason
  ) values (
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    '7e000000-0000-4000-8000-0000000000a1',
    '2035-06-04T09:00:00Z', 30, 'Paciente inexistente'
  )$q$,
  '23503'
);

-- INT-02 · FK de médico inexistente.
select public.pry07_expect_error(
  'INT-02',
  'Rechaza una cita con médico inexistente (FK)',
  $q$insert into public.appointments (
    patient_id, physician_id, starts_at, duration_minutes, reason
  ) values (
    '7e000000-0000-4000-8000-000000000001',
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    '2035-06-04T10:00:00Z', 30, 'Médico inexistente'
  )$q$,
  '23503'
);

-- INT-03 · Estado no permitido.
select public.pry07_expect_error(
  'INT-03',
  'Rechaza un estado de cita fuera del contrato',
  $q$insert into public.appointments (
    patient_id, physician_id, starts_at, duration_minutes, reason, status
  ) values (
    '7e000000-0000-4000-8000-000000000001',
    '7e000000-0000-4000-8000-0000000000a1',
    '2035-06-04T11:00:00Z', 30, 'Estado inválido', 'attended'
  )$q$,
  '23514'
);

-- INT-04 · Duración fuera de catálogo.
select public.pry07_expect_error(
  'INT-04',
  'Rechaza una duración distinta de 15, 30, 45 o 60',
  $q$insert into public.appointments (
    patient_id, physician_id, starts_at, duration_minutes, reason
  ) values (
    '7e000000-0000-4000-8000-000000000001',
    '7e000000-0000-4000-8000-0000000000a1',
    '2035-06-04T12:00:00Z', 20, 'Duración inválida'
  )$q$,
  '23514'
);

-- INT-05 · Clave primaria duplicada.
select public.pry07_expect_error(
  'INT-05',
  'Rechaza un paciente con clave primaria duplicada',
  $q$insert into public.patients (id, display_name)
    values ('7e000000-0000-4000-8000-000000000001', 'Duplicado')$q$,
  '23505'
);

-- INT-06 · Paciente con citas no se elimina.
select public.pry07_expect_error(
  'INT-06',
  'Impide borrar un paciente con citas asociadas (FK restrict)',
  $q$delete from public.patients
    where id = '7e000000-0000-4000-8000-000000000001'$q$,
  '23503'
);

-- INT-07 · Médico con citas no se elimina.
select public.pry07_expect_error(
  'INT-07',
  'Impide borrar un médico con citas asociadas (FK restrict)',
  $q$delete from public.physicians
    where id = '7e000000-0000-4000-8000-0000000000a1'$q$,
  '23503'
);

-- INT-08 · Alta válida: estado inicial, fin derivado y evento created.
select public.pry07_check(
  'INT-08',
  'Alta válida calcula ends_at, inicia pending y registra el evento created',
  (
    select count(*) = 1
    from public.appointments
    where id = '7e000000-0000-4000-8000-000000000101'
      and status = 'pending'
      and ends_at = '2035-06-01T09:30:00Z'::timestamptz
      and updated_at is not null
  ) and (
    select count(*) = 1
    from public.appointment_events
    where appointment_id = '7e000000-0000-4000-8000-000000000101'
      and event_type = 'created'
  ),
  'comprobado estado, ends_at y auditoría'
);

-- INT-09 · Motivo vacío.
select public.pry07_expect_error(
  'INT-09',
  'Rechaza un motivo de consulta vacío',
  $q$insert into public.appointments (
    patient_id, physician_id, starts_at, duration_minutes, reason
  ) values (
    '7e000000-0000-4000-8000-000000000002',
    '7e000000-0000-4000-8000-0000000000a2',
    '2035-06-05T09:00:00Z', 30, '   '
  )$q$,
  '23514'
);

-- INT-10 · Una operación rechazada no deja residuos.
do $$
declare
  appointments_before integer;
  events_before integer;
  appointments_after integer;
  events_after integer;
begin
  select count(*) into appointments_before from public.appointments;
  select count(*) into events_before from public.appointment_events;
  begin
    insert into public.appointments (
      patient_id, physician_id, starts_at, duration_minutes, reason
    ) values (
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      '7e000000-0000-4000-8000-0000000000a1',
      '2035-06-06T09:00:00Z', 30, 'Debe fallar por FK'
    );
  exception when foreign_key_violation then
    null;
  end;
  select count(*) into appointments_after from public.appointments;
  select count(*) into events_after from public.appointment_events;
  perform public.pry07_check(
    'INT-10',
    'Una inserción rechazada no modifica citas ni auditoría',
    appointments_before = appointments_after and events_before = events_after,
    format('citas=%s->%s eventos=%s->%s',
      appointments_before, appointments_after, events_before, events_after)
  );
end;
$$;

-- INT-11 · ends_at no se acepta desde el cliente.
insert into public.appointments (
  id, patient_id, physician_id, starts_at, duration_minutes, ends_at, reason
) values (
  '7e000000-0000-4000-8000-000000000102',
  '7e000000-0000-4000-8000-000000000001',
  '7e000000-0000-4000-8000-0000000000a1',
  '2035-06-07T09:00:00Z', 45, '1999-01-01T00:00:00Z',
  'Fin manipulado en el cliente'
);

select public.pry07_check(
  'INT-11',
  'El trigger recalcula ends_at aunque el cliente envíe otro valor',
  (
    select ends_at = '2035-06-07T09:45:00Z'::timestamptz
    from public.appointments
    where id = '7e000000-0000-4000-8000-000000000102'
  ),
  'ends_at recalculado desde starts_at y duration_minutes'
);

-- INT-12 · FK del historial.
select public.pry07_expect_error(
  'INT-12',
  'Rechaza un evento de historial con cita inexistente',
  $q$insert into public.appointment_events (appointment_id, event_type)
    values ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'created')$q$,
  '23503'
);

-- INT-13 · Cambios de FK rechazados.
select public.pry07_expect_error(
  'INT-13',
  'Rechaza mover una cita a un paciente inexistente',
  $q$update public.appointments
    set patient_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    where id = '7e000000-0000-4000-8000-000000000101'$q$,
  '23503'
);

select public.pry07_expect_error(
  'INT-14',
  'Rechaza mover una cita a un médico inexistente',
  $q$update public.appointments
    set physician_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    where id = '7e000000-0000-4000-8000-000000000101'$q$,
  '23503'
);

-- INT-15 · Estado inválido en actualización.
select public.pry07_expect_error(
  'INT-15',
  'Rechaza actualizar una cita a un estado inválido',
  $q$update public.appointments
    set status = 'no_show'
    where id = '7e000000-0000-4000-8000-000000000101'$q$,
  '23514'
);

-- INT-16 · Relaciones correctas entre paciente, médico y cita.
select public.pry07_check(
  'INT-16',
  'La cita conserva la relación con su paciente y su médico',
  (
    select count(*) = 1
    from public.appointments as appointment
    join public.patients as patient on patient.id = appointment.patient_id
    join public.physicians as physician on physician.id = appointment.physician_id
    where appointment.id = '7e000000-0000-4000-8000-000000000101'
      and patient.display_name = 'Paciente Ficticio Uno'
      and physician.display_name = 'Dra. Ficticia Uno'
  ),
  'join paciente/médico comprobado'
);

-- INT-17 · Bloqueo con intervalo inválido.
select public.pry07_expect_error(
  'INT-17',
  'Rechaza un bloqueo de agenda con fin anterior al inicio',
  $q$insert into public.physician_schedule_blocks (
    physician_id, starts_at, ends_at, reason
  ) values (
    '7e000000-0000-4000-8000-0000000000a1',
    '2035-06-08T10:00:00Z', '2035-06-08T09:00:00Z', 'Intervalo inválido'
  )$q$,
  '23514'
);

-- INT-18 · Bloqueo con médico inexistente.
select public.pry07_expect_error(
  'INT-18',
  'Rechaza un bloqueo de agenda con médico inexistente',
  $q$insert into public.physician_schedule_blocks (
    physician_id, starts_at, ends_at, reason
  ) values (
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    '2035-06-08T10:00:00Z', '2035-06-08T11:00:00Z', 'Médico inexistente'
  )$q$,
  '23503'
);

-- INT-19 · El historial impide borrar citas directamente.
select public.pry07_expect_error(
  'INT-19',
  'Impide borrar una cita que tiene historial (FK restrict)',
  $q$delete from public.appointments
    where id = '7e000000-0000-4000-8000-000000000101'$q$,
  '23503'
);

-- INT-20 · Médico con bloqueo no se elimina.
select public.pry07_expect_error(
  'INT-20',
  'Impide borrar un médico con bloqueos de agenda (FK restrict)',
  $q$delete from public.physicians
    where id = '7e000000-0000-4000-8000-0000000000a2'$q$,
  '23503'
);

\echo PRY07-RESULTS
select 'PRY07|'||id||'|'||status||'|'||description||'|'||
  replace(coalesce(detail, ''), '|', '/')
from public.pry07_results
order by id;
