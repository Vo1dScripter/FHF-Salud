-- RF-03, RF-04 y RF-06: pruebas de integración de las acciones de cita.
-- Requiere las migraciones 202610250002 y 202610260003 aplicadas en una base
-- PostgreSQL/Supabase con el esquema auth de Supabase disponible.
--
-- Ejecutar con:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/appointment-actions.sql
--
-- Todo ocurre dentro de una transacción que termina en ROLLBACK: no conserva
-- pacientes, médicos ni citas de prueba.

begin;

create function pg_temp.assert_true(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if condition is distinct from true then
    raise exception 'ASSERTION FAILED: %', message using errcode = 'P0001';
  end if;
end;
$$;

insert into public.patients (id, display_name)
values (
  '11111111-1111-4111-8111-111111111111',
  'Paciente Sintético'
);

insert into public.physicians (id, display_name)
values
  ('22222222-2222-4222-8222-222222222222', 'Dra. Sintética'),
  ('33333333-3333-4333-8333-333333333333', 'Dr. Alterno');

insert into public.appointments (
  id,
  patient_id,
  physician_id,
  starts_at,
  duration_minutes,
  reason,
  status
)
values
  (
    'aaaaaaaa-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '2030-01-15T16:00:00Z',
    30,
    'Reprogramación libre',
    'pending'
  ),
  (
    'aaaaaaaa-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '2030-01-16T16:00:00Z',
    30,
    'Reserva que se cancela',
    'pending'
  ),
  (
    'aaaaaaaa-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '2030-01-17T16:00:00Z',
    30,
    'Confirmación pendiente',
    'pending'
  ),
  (
    'aaaaaaaa-4444-4444-8444-444444444444',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '2030-01-18T16:00:00Z',
    30,
    'Confirmada que se reprograma',
    'pending'
  ),
  (
    'aaaaaaaa-5555-4555-8555-555555555555',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    '2030-01-18T17:00:00Z',
    30,
    'Cita visible solo para personal',
    'pending'
  );

-- Personal de administración: puede consultar y mutar toda la agenda.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'app_metadata', jsonb_build_object('appointment_role', 'admin')
  )::text,
  true
);
set local role authenticated;

do $test$
declare
  admin_id constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  appointment_a1 constant uuid := 'aaaaaaaa-1111-4111-8111-111111111111';
  appointment_a2 constant uuid := 'aaaaaaaa-2222-4222-8222-222222222222';
  appointment_a3 constant uuid := 'aaaaaaaa-3333-4333-8333-333333333333';
  appointment_a4 constant uuid := 'aaaaaaaa-4444-4444-8444-444444444444';
  missing_appointment constant uuid := 'aaaaaaaa-9999-4999-8999-999999999999';
  original_a2_starts_at timestamptz;
  expected_updated_at timestamptz;
  updated_a2_updated_at timestamptz;
  original_a2_events integer;
  v_appointment public.appointments%rowtype;
  v_other public.appointments%rowtype;
  v_events integer;
begin
  -- RF-03: mover una cita pendiente a un horario libre y cambiar duración.
  select updated_at
  into expected_updated_at
  from public.appointments
  where id = appointment_a1;

  select *
  into v_appointment
  from public.reschedule_appointment(
    appointment_a1,
    expected_updated_at,
    '2030-01-20T18:00:00Z'::timestamptz,
    45::smallint
  );

  perform pg_temp.assert_true(
    v_appointment.status = 'pending',
    'reprogramar una pendiente debe conservar status pending'
  );
  perform pg_temp.assert_true(
    v_appointment.starts_at = '2030-01-20T18:00:00Z'::timestamptz,
    'la reprogramación debe guardar el nuevo inicio'
  );
  perform pg_temp.assert_true(
    v_appointment.ends_at = '2030-01-20T18:45:00Z'::timestamptz,
    'la reprogramación debe recalcular ends_at con la nueva duración'
  );
  perform pg_temp.assert_true(
    v_appointment.duration_minutes = 45,
    'la reprogramación debe guardar la nueva duración'
  );

  select count(*)
  into v_events
  from public.appointment_events
  where appointment_id = appointment_a1
    and event_type = 'rescheduled';

  perform pg_temp.assert_true(
    v_events = 1,
    'la reprogramación debe registrar exactamente un evento rescheduled'
  );

  -- Una versión anterior no puede sobrescribir el cambio.
  begin
    perform public.reschedule_appointment(
      appointment_a1,
      expected_updated_at - interval '1 hour',
      '2030-01-21T18:00:00Z'::timestamptz,
      30::smallint
    );
    raise exception 'Se aceptó una versión desactualizada';
  exception
    when sqlstate 'PT409' then
      null;
  end;

  select *
  into v_appointment
  from public.appointments
  where id = appointment_a1;

  perform pg_temp.assert_true(
    v_appointment.starts_at = '2030-01-20T18:00:00Z'::timestamptz,
    'el rechazo por versión debe conservar el horario guardado'
  );

  -- El motivo de cancelación es obligatorio y se valida en servidor.
  begin
    perform public.cancel_appointment(
      appointment_a1,
      v_appointment.updated_at,
      '   '
    );
    raise exception 'Se aceptó una cancelación sin motivo';
  exception
    when sqlstate 'PT400' then
      null;
  end;

  select *
  into v_appointment
  from public.appointments
  where id = appointment_a1;

  perform pg_temp.assert_true(
    v_appointment.status = 'pending',
    'una cancelación inválida no debe cambiar la cita'
  );

  -- Una cita inexistente no debe crear un registro ni devolver éxito.
  begin
    perform public.reschedule_appointment(
      missing_appointment,
      expected_updated_at,
      '2030-01-22T18:00:00Z'::timestamptz,
      30::smallint
    );
    raise exception 'Se aceptó una cita inexistente';
  exception
    when sqlstate 'PT404' then
      null;
  end;

  -- Un horario ocupado es rechazado por la restricción de exclusión.
  select starts_at, updated_at
  into original_a2_starts_at, expected_updated_at
  from public.appointments
  where id = appointment_a2;

  begin
    perform public.reschedule_appointment(
      appointment_a2,
      expected_updated_at,
      '2030-01-20T18:15:00Z'::timestamptz,
      30::smallint
    );
    raise exception 'Se aceptó un horario ocupado';
  exception
    when exclusion_violation then
      null;
  end;

  select *
  into v_other
  from public.appointments
  where id = appointment_a2;

  perform pg_temp.assert_true(
    v_other.starts_at = original_a2_starts_at,
    'el conflicto de horario no debe mover la cita'
  );
  perform pg_temp.assert_true(
    v_other.status = 'pending',
    'el conflicto de horario no debe cambiar el estado'
  );

  -- RF-04: cancelar conserva la fila, guarda el motivo y libera el horario.
  select count(*)
  into original_a2_events
  from public.appointment_events
  where appointment_id = appointment_a2;

  select *
  into v_appointment
  from public.cancel_appointment(
    appointment_a2,
    expected_updated_at,
    '  Paciente no puede asistir  '
  );

  perform pg_temp.assert_true(
    v_appointment.status = 'cancelled',
    'cancelar debe cambiar el estado a cancelled'
  );
  perform pg_temp.assert_true(
    v_appointment.cancellation_reason = 'Paciente no puede asistir',
    'el motivo debe guardarse sin espacios exteriores'
  );
  perform pg_temp.assert_true(
    v_appointment.cancelled_at is not null,
    'cancelar debe guardar cancelled_at'
  );
  perform pg_temp.assert_true(
    v_appointment.cancelled_by = admin_id,
    'cancelar debe guardar el usuario que ejecutó la acción'
  );

  select count(*)
  into v_events
  from public.appointments
  where id = appointment_a2
    and status = 'cancelled';

  perform pg_temp.assert_true(
    v_events = 1,
    'la cita cancelada debe seguir existiendo en la tabla'
  );

  select count(*)
  into v_events
  from public.appointment_events
  where appointment_id = appointment_a2
    and event_type = 'cancelled';

  perform pg_temp.assert_true(
    v_events = 1,
    'cancelar debe registrar exactamente un evento cancelled'
  );

  updated_a2_updated_at := v_appointment.updated_at;

  -- Repetir la cancelación no vuelve a escribir ni auditar.
  select *
  into v_other
  from public.cancel_appointment(
    appointment_a2,
    updated_a2_updated_at - interval '1 day',
    'Otro motivo'
  );

  perform pg_temp.assert_true(
    v_other.cancellation_reason = 'Paciente no puede asistir',
    'repetir la cancelación no debe reemplazar el motivo original'
  );

  select count(*)
  into v_events
  from public.appointment_events
  where appointment_id = appointment_a2;

  perform pg_temp.assert_true(
    v_events = original_a2_events + 1,
    'repetir la cancelación no debe duplicar la auditoría'
  );

  -- Una cita cancelada no se puede reprogramar ni confirmar.
  begin
    perform public.reschedule_appointment(
      appointment_a2,
      updated_a2_updated_at,
      '2030-01-23T18:00:00Z'::timestamptz,
      30::smallint
    );
    raise exception 'Se reprogramó una cita cancelada';
  exception
    when sqlstate 'PT422' then
      null;
  end;

  begin
    perform public.confirm_appointment(appointment_a2, updated_a2_updated_at);
    raise exception 'Se confirmó una cita cancelada';
  exception
    when sqlstate 'PT422' then
      null;
  end;

  -- El horario liberado se puede ocupar con una cita nueva.
  insert into public.appointments (
    patient_id,
    physician_id,
    starts_at,
    duration_minutes,
    reason,
    status
  )
  values (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    original_a2_starts_at,
    30,
    'Reocupación del horario liberado',
    'pending'
  )
  returning * into v_appointment;

  perform pg_temp.assert_true(
    v_appointment.id is not null,
    'el horario liberado debe aceptar una cita nueva'
  );
  perform pg_temp.assert_true(
    v_appointment.status = 'pending',
    'la cita nueva debe iniciar en pending'
  );

  -- RF-06: confirmar una cita pendiente y persistir la confirmación.
  select updated_at
  into expected_updated_at
  from public.appointments
  where id = appointment_a3;

  select *
  into v_appointment
  from public.confirm_appointment(appointment_a3, expected_updated_at);

  perform pg_temp.assert_true(
    v_appointment.status = 'confirmed',
    'confirmar una pendiente debe guardar status confirmed'
  );
  perform pg_temp.assert_true(
    v_appointment.confirmed_at is not null,
    'confirmar debe guardar confirmed_at'
  );
  perform pg_temp.assert_true(
    v_appointment.confirmed_by = admin_id,
    'confirmar debe guardar el usuario que ejecutó la acción'
  );

  select count(*)
  into v_events
  from public.appointment_events
  where appointment_id = appointment_a3
    and event_type = 'confirmed';

  perform pg_temp.assert_true(
    v_events = 1,
    'confirmar debe registrar exactamente un evento confirmed'
  );

  -- Repetir la confirmación es idempotente y no duplica auditoría.
  select *
  into v_other
  from public.confirm_appointment(appointment_a3, expected_updated_at);

  perform pg_temp.assert_true(
    v_other.confirmed_at = v_appointment.confirmed_at,
    'repetir la confirmación no debe cambiar confirmed_at'
  );

  select count(*)
  into v_events
  from public.appointment_events
  where appointment_id = appointment_a3
    and event_type = 'confirmed';

  perform pg_temp.assert_true(
    v_events = 1,
    'repetir la confirmación no debe duplicar la auditoría'
  );

  -- Regla acordada: reprogramar una confirmada vuelve a pending.
  select *
  into v_other
  from public.confirm_appointment(
    appointment_a4,
    (
      select updated_at
      from public.appointments
      where id = appointment_a4
    )
  );

  perform pg_temp.assert_true(
    v_other.status = 'confirmed',
    'la cita de prueba debe quedar confirmada antes de reprogramarse'
  );

  select *
  into v_appointment
  from public.reschedule_appointment(
    appointment_a4,
    v_other.updated_at,
    '2030-01-24T18:00:00Z'::timestamptz,
    60::smallint
  );

  perform pg_temp.assert_true(
    v_appointment.status = 'pending',
    'reprogramar una confirmada debe devolverla a pending'
  );
  perform pg_temp.assert_true(
    v_appointment.confirmed_at is null
    and v_appointment.confirmed_by is null,
    'la reprogramación debe retirar la confirmación anterior'
  );
  perform pg_temp.assert_true(
    v_appointment.ends_at = '2030-01-24T19:00:00Z'::timestamptz,
    'la reprogramación debe recalcular ends_at para la nueva duración'
  );

  select count(*)
  into v_events
  from public.appointment_events
  where appointment_id = appointment_a4
    and event_type = 'rescheduled';

  perform pg_temp.assert_true(
    v_events = 1,
    'reprogramar una confirmada debe registrar el evento rescheduled'
  );
end
$test$;

-- Un médico autenticado solo puede leer su propia agenda y no puede mutar.
reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'app_metadata', jsonb_build_object(
      'appointment_role', 'physician',
      'physician_id', '22222222-2222-4222-8222-222222222222'
    )
  )::text,
  true
);
set local role authenticated;

do $test$
declare
  appointment_a3 constant uuid := 'aaaaaaaa-3333-4333-8333-333333333333';
  other_physician_appointment constant uuid := 'aaaaaaaa-5555-4555-8555-555555555555';
  v_updated_at timestamptz;
begin
  select updated_at
  into v_updated_at
  from public.appointments
  where id = appointment_a3;

  begin
    perform public.confirm_appointment(appointment_a3, v_updated_at);
    raise exception 'Un médico pudo confirmar una cita';
  exception
    when sqlstate '42501' then
      null;
  end;

  perform pg_temp.assert_true(
    exists (
      select 1
      from public.appointments
      where id = appointment_a3
    ),
    'el médico debe poder leer sus propias citas'
  );
  perform pg_temp.assert_true(
    not exists (
      select 1
      from public.appointments
      where id = other_physician_appointment
    ),
    'el médico no debe leer citas de otro médico'
  );
end
$test$;

rollback;
