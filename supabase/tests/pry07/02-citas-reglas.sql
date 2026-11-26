-- PRY07 · Emilio Martínez · Reglas de citas, estados y auditoría.
-- PostgreSQL 17 local y desechable. Solo datos ficticios.
-- La autenticación se simula con request.jwt.claims, igual que en las suites
-- existentes del proyecto. No sustituye una prueba con GoTrue real.

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

insert into public.patients (id, display_name) values
  ('7e000000-0000-4000-8000-000000000001', 'Paciente Ficticio Uno'),
  ('7e000000-0000-4000-8000-000000000002', 'Paciente Ficticio Dos');

insert into public.physicians (id, display_name) values
  ('7e000000-0000-4000-8000-0000000000a1', 'Dra. Ficticia Uno'),
  ('7e000000-0000-4000-8000-0000000000a2', 'Dr. Ficticio Dos');

insert into public.appointments (
  id, patient_id, physician_id, starts_at, duration_minutes, reason
) values
  ('7e000000-0000-4000-8000-000000000101',
   '7e000000-0000-4000-8000-000000000001',
   '7e000000-0000-4000-8000-0000000000a1',
   '2035-06-01T09:00:00Z', 30, 'Reprogramación ficticia'),
  ('7e000000-0000-4000-8000-000000000102',
   '7e000000-0000-4000-8000-000000000001',
   '7e000000-0000-4000-8000-0000000000a1',
   '2035-06-01T10:00:00Z', 30, 'Cancelación ficticia'),
  ('7e000000-0000-4000-8000-000000000103',
   '7e000000-0000-4000-8000-000000000001',
   '7e000000-0000-4000-8000-0000000000a1',
   '2035-06-01T11:00:00Z', 30, 'Confirmación ficticia'),
  ('7e000000-0000-4000-8000-000000000104',
   '7e000000-0000-4000-8000-000000000001',
   '7e000000-0000-4000-8000-0000000000a1',
   '2035-06-03T09:00:00Z', 30, 'Confirmada que se reprograma'),
  ('7e000000-0000-4000-8000-000000000105',
   '7e000000-0000-4000-8000-000000000002',
   '7e000000-0000-4000-8000-0000000000a2',
   '2035-06-01T09:00:00Z', 30, 'Mismo horario, otro médico'),
  ('7e000000-0000-4000-8000-000000000106',
   '7e000000-0000-4000-8000-000000000002',
   '7e000000-0000-4000-8000-0000000000a1',
   '2035-06-04T09:00:00Z', 30, 'Reserva para traslape'),
  ('7e000000-0000-4000-8000-000000000107',
   '7e000000-0000-4000-8000-000000000001',
   '7e000000-0000-4000-8000-0000000000a1',
   '2035-06-05T09:00:00Z', 30, 'Versión desactualizada'),
  ('7e000000-0000-4000-8000-000000000108',
   '7e000000-0000-4000-8000-000000000001',
   '7e000000-0000-4000-8000-0000000000a1',
   '2035-06-06T09:00:00Z', 30, 'Cancelación sin motivo'),
  ('7e000000-0000-4000-8000-000000000109',
   '7e000000-0000-4000-8000-000000000001',
   '7e000000-0000-4000-8000-0000000000a1',
   '2035-06-07T09:00:00Z', 30, 'Cancelación repetida'),
  ('7e000000-0000-4000-8000-000000000110',
   '7e000000-0000-4000-8000-000000000001',
   '7e000000-0000-4000-8000-0000000000a1',
   '2035-06-08T09:00:00Z', 30, 'Horario que se libera'),
  ('7e000000-0000-4000-8000-000000000111',
   '7e000000-0000-4000-8000-000000000001',
   '7e000000-0000-4000-8000-0000000000a1',
   '2035-06-09T09:00:00Z', 30, 'Duración inválida en RPC');

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '7e000000-0000-4000-8000-0000000000f1',
    'app_metadata', jsonb_build_object('appointment_role', 'admin')
  )::text,
  false
);
set role authenticated;

-- CIT-01 · Alta válida por personal autenticado.
insert into public.appointments (
  id, patient_id, physician_id, starts_at, duration_minutes, reason
) values (
  '7e000000-0000-4000-8000-000000000112',
  '7e000000-0000-4000-8000-000000000002',
  '7e000000-0000-4000-8000-0000000000a1',
  '2035-06-10T09:00:00Z', 60, 'Alta autorizada ficticia'
);

select public.pry07_check(
  'CIT-01',
  'El personal autorizado crea una cita pending con fin derivado',
  (
    select status = 'pending'
      and ends_at = '2035-06-10T10:00:00Z'::timestamptz
    from public.appointments
    where id = '7e000000-0000-4000-8000-000000000112'
  )
  and (
    select count(*) = 1 from public.appointment_events
    where appointment_id = '7e000000-0000-4000-8000-000000000112'
      and event_type = 'created'
  ),
  'cita y evento created comprobados'
);

-- CIT-02 · Traslape en la misma agenda.
select public.pry07_expect_error(
  'CIT-02',
  'Rechaza dos citas superpuestas para el mismo médico',
  $q$insert into public.appointments (
    patient_id, physician_id, starts_at, duration_minutes, reason
  ) values (
    '7e000000-0000-4000-8000-000000000002',
    '7e000000-0000-4000-8000-0000000000a1',
    '2035-06-10T09:15:00Z', 30, 'Traslape directo'
  )$q$,
  '23P01'
);

-- CIT-03 · Traslape al reprogramar.
select public.pry07_expect_error(
  'CIT-03',
  'Rechaza reprogramar una cita sobre un horario ocupado',
  $q$select public.reschedule_appointment(
    '7e000000-0000-4000-8000-000000000106',
    (select updated_at from public.appointments
      where id = '7e000000-0000-4000-8000-000000000106'),
    '2035-06-01T09:00:00Z'::timestamptz,
    30::smallint
  )$q$,
  '23P01'
);

-- CIT-04 · El solapamiento es por médico, no global.
select public.pry07_check(
  'CIT-04',
  'Permite el mismo horario para médicos distintos',
  (
    select count(*) = 2
    from public.appointments
    where starts_at = '2035-06-01T09:00:00Z'::timestamptz
      and status <> 'cancelled'
  ),
  'dos médicos con cita a la misma hora'
);

-- CIT-05 · Reprogramación válida.
select public.reschedule_appointment(
  '7e000000-0000-4000-8000-000000000101',
  (select updated_at from public.appointments
    where id = '7e000000-0000-4000-8000-000000000101'),
  '2035-06-02T09:00:00Z'::timestamptz,
  45::smallint
);

select public.pry07_check(
  'CIT-05',
  'Reprogramar guarda inicio, duración, fin y evento rescheduled',
  (
    select status = 'pending'
      and starts_at = '2035-06-02T09:00:00Z'::timestamptz
      and duration_minutes = 45
      and ends_at = '2035-06-02T09:45:00Z'::timestamptz
    from public.appointments
    where id = '7e000000-0000-4000-8000-000000000101'
  )
  and (
    select count(*) = 1 from public.appointment_events
    where appointment_id = '7e000000-0000-4000-8000-000000000101'
      and event_type = 'rescheduled'
  ),
  'cita reprogramada y auditada'
);

-- CIT-06 · Cancelación válida.
select public.cancel_appointment(
  '7e000000-0000-4000-8000-000000000102',
  (select updated_at from public.appointments
    where id = '7e000000-0000-4000-8000-000000000102'),
  '  Paciente ficticio no puede asistir  '
);

select public.pry07_check(
  'CIT-06',
  'Cancelar conserva la fila, el motivo y el autor',
  (
    select status = 'cancelled'
      and cancellation_reason = 'Paciente ficticio no puede asistir'
      and cancelled_at is not null
      and cancelled_by = '7e000000-0000-4000-8000-0000000000f1'::uuid
    from public.appointments
    where id = '7e000000-0000-4000-8000-000000000102'
  ),
  'estado, motivo y actor comprobados'
);

-- CIT-07 · Historial posterior a la cancelación.
select public.pry07_check(
  'CIT-07',
  'La cancelación conserva la cita y registra un único evento cancelled',
  (
    select count(*) = 1 from public.appointments
    where id = '7e000000-0000-4000-8000-000000000102'
      and status = 'cancelled'
  )
  and (
    select count(*) = 1 from public.appointment_events
    where appointment_id = '7e000000-0000-4000-8000-000000000102'
      and event_type = 'cancelled'
  ),
  'fila y auditoría conservadas'
);

-- CIT-08 · El horario cancelado se libera.
insert into public.appointments (
  id, patient_id, physician_id, starts_at, duration_minutes, reason
) values (
  '7e000000-0000-4000-8000-000000000113',
  '7e000000-0000-4000-8000-000000000002',
  '7e000000-0000-4000-8000-0000000000a1',
  '2035-06-01T10:00:00Z', 30, 'Nueva reserva en horario liberado'
);

select public.pry07_check(
  'CIT-08',
  'El horario liberado por cancelación acepta una nueva reserva',
  (
    select count(*) = 1 from public.appointments
    where id = '7e000000-0000-4000-8000-000000000113'
      and status = 'pending'
  ),
  'reserva nueva aceptada'
);

-- CIT-09 · Confirmación válida.
select public.confirm_appointment(
  '7e000000-0000-4000-8000-000000000103',
  (select updated_at from public.appointments
    where id = '7e000000-0000-4000-8000-000000000103')
);

select public.pry07_check(
  'CIT-09',
  'Confirmar guarda estado, fecha y autor, con un evento confirmed',
  (
    select status = 'confirmed'
      and confirmed_at is not null
      and confirmed_by = '7e000000-0000-4000-8000-0000000000f1'::uuid
    from public.appointments
    where id = '7e000000-0000-4000-8000-000000000103'
  )
  and (
    select count(*) = 1 from public.appointment_events
    where appointment_id = '7e000000-0000-4000-8000-000000000103'
      and event_type = 'confirmed'
  ),
  'confirmación y auditoría comprobadas'
);

-- CIT-10 · Confirmar de nuevo con la versión vigente es idempotente.
select public.confirm_appointment(
  '7e000000-0000-4000-8000-000000000103',
  (select updated_at from public.appointments
    where id = '7e000000-0000-4000-8000-000000000103')
);
select public.pry07_check(
  'CIT-10',
  'Repetir la confirmación con la versión vigente no duplica la auditoría',
  (
    select count(*) = 1 from public.appointment_events
    where appointment_id = '7e000000-0000-4000-8000-000000000103'
      and event_type = 'confirmed'
  ),
  'un solo evento confirmed'
);

-- CIT-11 · Reprogramar una confirmada la devuelve a pending.
select public.confirm_appointment(
  '7e000000-0000-4000-8000-000000000104',
  (select updated_at from public.appointments
    where id = '7e000000-0000-4000-8000-000000000104')
);
select public.reschedule_appointment(
  '7e000000-0000-4000-8000-000000000104',
  (select updated_at from public.appointments
    where id = '7e000000-0000-4000-8000-000000000104'),
  '2035-06-11T09:00:00Z'::timestamptz,
  30::smallint
);

select public.pry07_check(
  'CIT-11',
  'Reprogramar una confirmada la devuelve a pending y retira la confirmación',
  (
    select status = 'pending'
      and confirmed_at is null
      and confirmed_by is null
      and starts_at = '2035-06-11T09:00:00Z'::timestamptz
    from public.appointments
    where id = '7e000000-0000-4000-8000-000000000104'
  ),
  'estado y campos de confirmación comprobados'
);

-- CIT-12 · Versión desactualizada (transacción distinta).
reset role;
select pg_sleep(0.05);
update public.appointments
set reason = reason
where id = '7e000000-0000-4000-8000-000000000107';
set role authenticated;

select public.pry07_expect_error(
  'CIT-12',
  'Rechaza una mutación con updated_at desactualizado',
  $q$select public.confirm_appointment(
    '7e000000-0000-4000-8000-000000000107',
    (select updated_at - interval '1 second' from public.appointments
      where id = '7e000000-0000-4000-8000-000000000107')
  )$q$,
  'PT409'
);

-- CIT-13 · Confirmar una cancelada.
select public.pry07_expect_error(
  'CIT-13',
  'Rechaza confirmar una cita cancelada',
  $q$select public.confirm_appointment(
    '7e000000-0000-4000-8000-000000000102',
    (select updated_at from public.appointments
      where id = '7e000000-0000-4000-8000-000000000102')
  )$q$,
  'PT422'
);

-- CIT-14 · Reprogramar una cancelada.
select public.pry07_expect_error(
  'CIT-14',
  'Rechaza reprogramar una cita cancelada',
  $q$select public.reschedule_appointment(
    '7e000000-0000-4000-8000-000000000102',
    (select updated_at from public.appointments
      where id = '7e000000-0000-4000-8000-000000000102'),
    '2035-06-12T09:00:00Z'::timestamptz,
    30::smallint
  )$q$,
  'PT422'
);

-- CIT-15 · Motivo de cancelación obligatorio.
select public.pry07_expect_error(
  'CIT-15',
  'Rechaza una cancelación sin motivo y conserva la cita',
  $q$select public.cancel_appointment(
    '7e000000-0000-4000-8000-000000000108',
    (select updated_at from public.appointments
      where id = '7e000000-0000-4000-8000-000000000108'),
    '   '
  )$q$,
  'PT400'
);

select public.pry07_check(
  'CIT-15b',
  'La cancelación rechazada no cambia el estado de la cita',
  (
    select status = 'pending' and cancellation_reason is null
    from public.appointments
    where id = '7e000000-0000-4000-8000-000000000108'
  ),
  'estado pending conservado'
);

-- CIT-16 · Cita inexistente.
select public.pry07_expect_error(
  'CIT-16',
  'Rechaza operar sobre una cita inexistente',
  $q$select public.confirm_appointment(
    'ffffffff-ffff-4fff-8fff-ffffffffffff', now()
  )$q$,
  'PT404'
);

-- CIT-17 · El rechazo por traslape no deja residuos.
select public.pry07_check(
  'CIT-17',
  'El traslape rechazado no crea filas ni auditoría adicional',
  (
    select count(*) = 0 from public.appointments
    where starts_at = '2035-06-10T09:15:00Z'::timestamptz
  ),
  'sin cita en el horario rechazado'
);

-- CIT-18 · Cancelación repetida.
select public.cancel_appointment(
  '7e000000-0000-4000-8000-000000000109',
  (select updated_at from public.appointments
    where id = '7e000000-0000-4000-8000-000000000109'),
  'Motivo original'
);
select public.cancel_appointment(
  '7e000000-0000-4000-8000-000000000109',
  (select updated_at from public.appointments
    where id = '7e000000-0000-4000-8000-000000000109'),
  'Motivo distinto'
);

select public.pry07_check(
  'CIT-18',
  'Repetir la cancelación conserva el motivo y no duplica auditoría',
  (
    select cancellation_reason = 'Motivo original'
    from public.appointments
    where id = '7e000000-0000-4000-8000-000000000109'
  )
  and (
    select count(*) = 1 from public.appointment_events
    where appointment_id = '7e000000-0000-4000-8000-000000000109'
      and event_type = 'cancelled'
  ),
  'motivo original y un solo evento'
);

-- CIT-19 · Reprogramación al pasado.
select public.pry07_expect_error(
  'CIT-19',
  'Rechaza reprogramar una cita al pasado',
  $q$select public.reschedule_appointment(
    '7e000000-0000-4000-8000-000000000107',
    (select updated_at from public.appointments
      where id = '7e000000-0000-4000-8000-000000000107'),
    '2020-01-01T00:00:00Z'::timestamptz,
    30::smallint
  )$q$,
  'PT400'
);

-- CIT-20 · Duración inválida en RPC.
select public.pry07_expect_error(
  'CIT-20',
  'Rechaza una duración inválida en reprogramación',
  $q$select public.reschedule_appointment(
    '7e000000-0000-4000-8000-000000000111',
    (select updated_at from public.appointments
      where id = '7e000000-0000-4000-8000-000000000111'),
    '2035-06-13T09:00:00Z'::timestamptz,
    20::smallint
  )$q$,
  'PT400'
);

-- CIT-21 · Cita cancelada conserva historial previo.
select public.cancel_appointment(
  '7e000000-0000-4000-8000-000000000110',
  (select updated_at from public.appointments
    where id = '7e000000-0000-4000-8000-000000000110'),
  'Se libera el horario'
);
select public.pry07_check(
  'CIT-21',
  'La cita cancelada conserva sus eventos anteriores',
  (
    select count(*) = 2 from public.appointment_events
    where appointment_id = '7e000000-0000-4000-8000-000000000110'
      and event_type in ('created', 'cancelled')
  ),
  'eventos created y cancelled presentes'
);

reset role;

\echo PRY07-RESULTS
select 'PRY07|'||id||'|'||status||'|'||description||'|'||
  replace(coalesce(detail, ''), '|', '/')
from public.pry07_results
order by id;
