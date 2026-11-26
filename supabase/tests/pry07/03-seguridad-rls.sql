-- PRY07 · Emilio Martínez · Seguridad, RLS y autorización.
-- PostgreSQL 17 local y desechable. Solo datos ficticios.
-- Los JWT se simulan con request.jwt.claims y SET ROLE, como en las suites
-- existentes. No equivale a una prueba con GoTrue/PostgREST reales.

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
  ('7e000000-0000-4000-8000-000000000002', 'Paciente Ficticio Dos'),
  ('7e000000-0000-4000-8000-000000000003', 'Paciente Ficticio Tres');

insert into public.physicians (id, display_name) values
  ('7e000000-0000-4000-8000-0000000000a1', 'Dra. Ficticia Uno'),
  ('7e000000-0000-4000-8000-0000000000a2', 'Dr. Ficticio Dos'),
  ('7e000000-0000-4000-8000-0000000000a3', 'Dra. Ficticia Tres');

insert into public.appointments (
  id, patient_id, physician_id, starts_at, duration_minutes, reason
) values
  ('7e000000-0000-4000-8000-000000000101',
   '7e000000-0000-4000-8000-000000000001',
   '7e000000-0000-4000-8000-0000000000a1',
   '2035-07-01T09:00:00Z', 30, 'Cita ficticia del médico uno'),
  ('7e000000-0000-4000-8000-000000000102',
   '7e000000-0000-4000-8000-000000000002',
   '7e000000-0000-4000-8000-0000000000a2',
   '2035-07-01T09:00:00Z', 30, 'Cita ficticia del médico dos'),
  ('7e000000-0000-4000-8000-000000000107',
   '7e000000-0000-4000-8000-000000000003',
   '7e000000-0000-4000-8000-0000000000a3',
   '2035-07-06T09:00:00Z', 30, 'Cita ficticia para autoría');

insert into public.appointments (
  id, patient_id, physician_id, starts_at, duration_minutes, reason,
  status, cancelled_at, cancelled_by, cancellation_reason
) values (
  '7e000000-0000-4000-8000-000000000103',
  '7e000000-0000-4000-8000-000000000001',
  '7e000000-0000-4000-8000-0000000000a1',
  '2035-07-01T10:00:00Z', 30, 'Cita cancelada ficticia',
  'cancelled', now(), '7e000000-0000-4000-8000-0000000000f1',
  'Cancelada antes de la prueba'
);

insert into public.physician_schedule_blocks (
  id, physician_id, starts_at, ends_at, reason
) values
  ('7e000000-0000-4000-8000-000000000201',
   '7e000000-0000-4000-8000-0000000000a2',
   '2035-07-02T09:00:00Z', '2035-07-02T10:00:00Z', 'Ausencia ficticia dos'),
  ('7e000000-0000-4000-8000-000000000202',
   '7e000000-0000-4000-8000-0000000000a1',
   '2035-07-05T09:00:00Z', '2035-07-05T10:00:00Z', 'Ausencia ficticia uno');

-- SEC-01 · RLS activo en todas las tablas del módulo.
select public.pry07_check(
  'SEC-01',
  'Las cinco tablas del módulo tienen RLS activo',
  (
    select count(*) = 5
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname in (
        'patients', 'physicians', 'appointments',
        'appointment_events', 'physician_schedule_blocks'
      )
      and pg_class.relrowsecurity
  ),
  'patients, physicians, appointments, appointment_events y physician_schedule_blocks'
);

-- SEC-02 · Privilegios de tabla de authenticated sobre citas.
select public.pry07_check(
  'SEC-02',
  'authenticated puede leer e insertar citas pero no actualizar ni borrar',
  has_table_privilege('authenticated', 'public.appointments', 'SELECT')
  and has_table_privilege('authenticated', 'public.appointments', 'INSERT')
  and not has_table_privilege('authenticated', 'public.appointments', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.appointments', 'DELETE'),
  'SELECT/INSERT sí; UPDATE/DELETE no'
);

-- SEC-03 · El historial es de solo lectura para authenticated.
select public.pry07_check(
  'SEC-03',
  'El historial de citas solo permite SELECT a authenticated',
  has_table_privilege('authenticated', 'public.appointment_events', 'SELECT')
  and not has_table_privilege('authenticated', 'public.appointment_events', 'INSERT')
  and not has_table_privilege('authenticated', 'public.appointment_events', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.appointment_events', 'DELETE'),
  'sin escritura directa sobre append-only'
);

-- SEC-04 · anon sin privilegios sobre tablas del módulo.
select public.pry07_check(
  'SEC-04',
  'anon no tiene privilegios sobre ninguna tabla del módulo',
  not has_table_privilege('anon', 'public.patients', 'SELECT')
  and not has_table_privilege('anon', 'public.physicians', 'SELECT')
  and not has_table_privilege('anon', 'public.appointments', 'SELECT')
  and not has_table_privilege('anon', 'public.appointment_events', 'SELECT')
  and not has_table_privilege('anon', 'public.physician_schedule_blocks', 'SELECT'),
  'sin SELECT en las cinco tablas'
);

-- SEC-05 · Permisos de ejecución de RPC.
select public.pry07_check(
  'SEC-05',
  'Las RPC solo son ejecutables por authenticated',
  has_function_privilege('authenticated',
    'public.confirm_appointment(uuid, timestamptz)', 'EXECUTE')
  and has_function_privilege('authenticated',
    'public.cancel_appointment(uuid, timestamptz, text)', 'EXECUTE')
  and has_function_privilege('authenticated',
    'public.reschedule_appointment(uuid, timestamptz, timestamptz, smallint)', 'EXECUTE')
  and not has_function_privilege('anon',
    'public.confirm_appointment(uuid, timestamptz)', 'EXECUTE')
  and not has_function_privilege('anon',
    'public.cancel_appointment(uuid, timestamptz, text)', 'EXECUTE')
  and not has_function_privilege('anon',
    'public.reschedule_appointment(uuid, timestamptz, timestamptz, smallint)', 'EXECUTE'),
  'anon sin EXECUTE; authenticated con EXECUTE'
);

-- SEC-06 · La función de trigger no es invocable por authenticated.
select public.pry07_check(
  'SEC-06',
  'La función de trigger de bloqueos no es ejecutable por authenticated',
  not has_function_privilege('authenticated',
    'public.check_physician_schedule_block()', 'EXECUTE'),
  'EXECUTE revocado'
);

-- SEC-07..15 · Lectura y escritura sin autenticación.
set role anon;

select public.pry07_expect_error(
  'SEC-07', 'anon no puede leer citas',
  'select * from public.appointments', '42501'
);
select public.pry07_expect_error(
  'SEC-08', 'anon no puede insertar citas',
  $q$insert into public.appointments (
    patient_id, physician_id, starts_at, duration_minutes, reason
  ) values (
    '7e000000-0000-4000-8000-000000000003',
    '7e000000-0000-4000-8000-0000000000a3',
    '2035-07-10T09:00:00Z', 30, 'Intento anónimo'
  )$q$,
  '42501'
);
select public.pry07_expect_error(
  'SEC-09', 'anon no puede leer pacientes',
  'select * from public.patients', '42501'
);
select public.pry07_expect_error(
  'SEC-10', 'anon no puede leer médicos',
  'select * from public.physicians', '42501'
);
select public.pry07_expect_error(
  'SEC-11', 'anon no puede leer el historial',
  'select * from public.appointment_events', '42501'
);
select public.pry07_expect_error(
  'SEC-12', 'anon no puede leer bloqueos de agenda',
  'select * from public.physician_schedule_blocks', '42501'
);
select public.pry07_expect_error(
  'SEC-13', 'anon no puede ejecutar la confirmación',
  $q$select public.confirm_appointment(
    '7e000000-0000-4000-8000-000000000101', now()
  )$q$,
  '42501'
);
select public.pry07_expect_error(
  'SEC-14', 'anon no puede ejecutar la cancelación',
  $q$select public.cancel_appointment(
    '7e000000-0000-4000-8000-000000000101', now(), 'Intento'
  )$q$,
  '42501'
);
select public.pry07_expect_error(
  'SEC-15', 'anon no puede ejecutar la reprogramación',
  $q$select public.reschedule_appointment(
    '7e000000-0000-4000-8000-000000000101', now(), now(), 30::smallint
  )$q$,
  '42501'
);

reset role;

-- SEC-16..25 · authenticated sin rol de aplicación.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '7e000000-0000-4000-8000-0000000000f5',
    'app_metadata', '{}'::jsonb
  )::text,
  false
);
set role authenticated;

select public.pry07_check(
  'SEC-16', 'Una cuenta sin rol no ve citas',
  (select count(*) from public.appointments) = 0, 'filas=0'
);
select public.pry07_check(
  'SEC-17', 'Una cuenta sin rol no ve pacientes',
  (select count(*) from public.patients) = 0, 'filas=0'
);
select public.pry07_check(
  'SEC-18', 'Una cuenta sin rol no ve médicos',
  (select count(*) from public.physicians) = 0, 'filas=0'
);
select public.pry07_check(
  'SEC-19', 'Una cuenta sin rol no ve historial',
  (select count(*) from public.appointment_events) = 0, 'filas=0'
);
select public.pry07_check(
  'SEC-20', 'Una cuenta sin rol no ve bloqueos',
  (select count(*) from public.physician_schedule_blocks) = 0, 'filas=0'
);
select public.pry07_expect_error(
  'SEC-21', 'Una cuenta sin rol no puede insertar citas',
  $q$insert into public.appointments (
    patient_id, physician_id, starts_at, duration_minutes, reason
  ) values (
    '7e000000-0000-4000-8000-000000000003',
    '7e000000-0000-4000-8000-0000000000a3',
    '2035-07-11T09:00:00Z', 30, 'Sin rol'
  )$q$,
  '42501'
);
select public.pry07_expect_error(
  'SEC-22', 'Una cuenta sin rol no puede insertar bloqueos',
  $q$insert into public.physician_schedule_blocks (
    physician_id, starts_at, ends_at, reason
  ) values (
    '7e000000-0000-4000-8000-0000000000a3',
    '2035-07-11T10:00:00Z', '2035-07-11T11:00:00Z', 'Sin rol'
  )$q$,
  '42501'
);
select public.pry07_expect_error(
  'SEC-23', 'Una cuenta sin rol no puede confirmar',
  $q$select public.confirm_appointment(
    '7e000000-0000-4000-8000-000000000101',
    (select updated_at from public.appointments
      where id = '7e000000-0000-4000-8000-000000000101')
  )$q$,
  '42501'
);
select public.pry07_expect_error(
  'SEC-24', 'Una cuenta sin rol no puede cancelar',
  $q$select public.cancel_appointment(
    '7e000000-0000-4000-8000-000000000101', now(), 'Sin rol'
  )$q$,
  '42501'
);
select public.pry07_expect_error(
  'SEC-25', 'Una cuenta sin rol no puede reprogramar',
  $q$select public.reschedule_appointment(
    '7e000000-0000-4000-8000-000000000101', now(), now(), 30::smallint
  )$q$,
  '42501'
);

reset role;

-- SEC-26..41 · Recepción autorizada.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '7e000000-0000-4000-8000-0000000000f2',
    'app_metadata', jsonb_build_object('appointment_role', 'receptionist')
  )::text,
  false
);
set role authenticated;

select public.pry07_check(
  'SEC-26', 'Recepción lee toda la agenda',
  (select count(*) from public.appointments) = 4,
  format('citas=%s', (select count(*) from public.appointments))
);
select public.pry07_check(
  'SEC-27', 'Recepción lee pacientes y médicos',
  (select count(*) from public.patients) = 3
  and (select count(*) from public.physicians) = 3,
  format('pacientes=%s medicos=%s',
    (select count(*) from public.patients),
    (select count(*) from public.physicians))
);

insert into public.appointments (
  id, patient_id, physician_id, starts_at, duration_minutes, reason
) values (
  '7e000000-0000-4000-8000-000000000104',
  '7e000000-0000-4000-8000-000000000003',
  '7e000000-0000-4000-8000-0000000000a3',
  '2035-07-03T09:00:00Z', 30, 'Creada por recepción'
);
select public.pry07_check(
  'SEC-28', 'Recepción crea una cita pending',
  (
    select status = 'pending' from public.appointments
    where id = '7e000000-0000-4000-8000-000000000104'
  ),
  'alta autorizada'
);

select public.pry07_expect_error(
  'SEC-29', 'Recepción no puede crear una cita confirmada directamente',
  $q$insert into public.appointments (
    patient_id, physician_id, starts_at, duration_minutes, reason, status
  ) values (
    '7e000000-0000-4000-8000-000000000003',
    '7e000000-0000-4000-8000-0000000000a3',
    '2035-07-12T09:00:00Z', 30, 'Confirmada directa', 'confirmed'
  )$q$,
  '42501'
);
select public.pry07_expect_error(
  'SEC-30', 'La FK sigue rechazando un paciente inexistente',
  $q$insert into public.appointments (
    patient_id, physician_id, starts_at, duration_minutes, reason
  ) values (
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    '7e000000-0000-4000-8000-0000000000a3',
    '2035-07-12T10:00:00Z', 30, 'Paciente inexistente'
  )$q$,
  '23503'
);
select public.pry07_expect_error(
  'SEC-31', 'Recepción no puede actualizar citas directamente',
  $q$update public.appointments
    set reason = 'Cambio directo'
    where id = '7e000000-0000-4000-8000-000000000101'$q$,
  '42501'
);
select public.pry07_expect_error(
  'SEC-32', 'Recepción no puede borrar citas directamente',
  $q$delete from public.appointments
    where id = '7e000000-0000-4000-8000-000000000101'$q$,
  '42501'
);
select public.pry07_expect_error(
  'SEC-33', 'Recepción no puede escribir el historial directamente',
  $q$insert into public.appointment_events (appointment_id, event_type)
    values ('7e000000-0000-4000-8000-000000000101', 'confirmed')$q$,
  '42501'
);
select public.pry07_check(
  'SEC-34', 'Recepción lee todo el historial',
  (select count(*) from public.appointment_events) = 5,
  format('eventos=%s', (select count(*) from public.appointment_events))
);

insert into public.physician_schedule_blocks (
  id, physician_id, starts_at, ends_at, reason
) values (
  '7e000000-0000-4000-8000-000000000203',
  '7e000000-0000-4000-8000-0000000000a3',
  '2035-07-04T09:00:00Z', '2035-07-04T10:00:00Z',
  'Bloqueo creado por recepción'
);
select public.pry07_check(
  'SEC-35', 'Recepción crea un bloqueo de agenda',
  exists (select 1 from public.physician_schedule_blocks
    where id = '7e000000-0000-4000-8000-000000000203'),
  'bloqueo insertado'
);
select public.pry07_expect_error(
  'SEC-36', 'Rechaza un bloqueo que se traslapa con una cita activa',
  $q$insert into public.physician_schedule_blocks (
    physician_id, starts_at, ends_at, reason
  ) values (
    '7e000000-0000-4000-8000-0000000000a1',
    '2035-07-01T09:15:00Z', '2035-07-01T09:45:00Z', 'Bloqueo en cita'
  )$q$,
  '23P01'
);
select public.pry07_expect_error(
  'SEC-37', 'Rechaza una cita que se traslapa con un bloqueo',
  $q$insert into public.appointments (
    patient_id, physician_id, starts_at, duration_minutes, reason
  ) values (
    '7e000000-0000-4000-8000-000000000003',
    '7e000000-0000-4000-8000-0000000000a2',
    '2035-07-02T09:15:00Z', 30, 'Cita en bloqueo'
  )$q$,
  '23P01'
);

insert into public.physician_schedule_blocks (
  id, physician_id, starts_at, ends_at, reason
) values (
  '7e000000-0000-4000-8000-000000000204',
  '7e000000-0000-4000-8000-0000000000a1',
  '2035-07-01T10:15:00Z', '2035-07-01T10:45:00Z',
  'Bloqueo sobre cita cancelada'
);
select public.pry07_check(
  'SEC-38', 'Una cita cancelada no impide bloquear el horario',
  exists (select 1 from public.physician_schedule_blocks
    where id = '7e000000-0000-4000-8000-000000000204'),
  'bloqueo sobre cancelada aceptado'
);
select public.pry07_expect_error(
  'SEC-39', 'Rechaza campos de cancelación en una cita no cancelada',
  $q$insert into public.appointments (
    patient_id, physician_id, starts_at, duration_minutes, reason,
    cancellation_reason
  ) values (
    '7e000000-0000-4000-8000-000000000003',
    '7e000000-0000-4000-8000-0000000000a3',
    '2035-07-13T09:00:00Z', 30, 'Campos incoherentes', 'Motivo sin cancelar'
  )$q$,
  '23514'
);

select public.cancel_appointment(
  '7e000000-0000-4000-8000-000000000104',
  (select updated_at from public.appointments
    where id = '7e000000-0000-4000-8000-000000000104'),
  'Cancelada por recepción'
);
select public.pry07_check(
  'SEC-40', 'Recepción cancela por RPC y se registra su autoría',
  (
    select status = 'cancelled'
      and cancelled_by = '7e000000-0000-4000-8000-0000000000f2'::uuid
    from public.appointments
    where id = '7e000000-0000-4000-8000-000000000104'
  )
  and (
    select count(*) = 1 from public.appointment_events
    where appointment_id = '7e000000-0000-4000-8000-000000000104'
      and event_type = 'cancelled'
      and actor_user_id = '7e000000-0000-4000-8000-0000000000f2'::uuid
  ),
  'estado y actor de la cancelación'
);

reset role;

-- SEC-41..56 · Médico autenticado (solo su ámbito).
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '7e000000-0000-4000-8000-0000000000f3',
    'app_metadata', jsonb_build_object(
      'appointment_role', 'physician',
      'physician_id', '7e000000-0000-4000-8000-0000000000a1'
    )
  )::text,
  false
);
set role authenticated;

select public.pry07_check(
  'SEC-41', 'El médico lee solo sus propias citas',
  (select count(*) from public.appointments) = 2
  and not exists (
    select 1 from public.appointments
    where id = '7e000000-0000-4000-8000-000000000102'
  ),
  format('citas_visibles=%s', (select count(*) from public.appointments))
);
select public.pry07_check(
  'SEC-42', 'El médico lee solo pacientes con cita propia',
  (select count(*) from public.patients) = 1
  and not exists (
    select 1 from public.patients
    where id = '7e000000-0000-4000-8000-000000000002'
  ),
  format('pacientes_visibles=%s', (select count(*) from public.patients))
);
select public.pry07_check(
  'SEC-43', 'El médico solo ve su propio registro profesional',
  (select count(*) from public.physicians) = 1
  and exists (
    select 1 from public.physicians
    where id = '7e000000-0000-4000-8000-0000000000a1'
  ),
  format('medicos_visibles=%s', (select count(*) from public.physicians))
);
select public.pry07_check(
  'SEC-44', 'El médico solo ve el historial de sus citas',
  (select count(*) from public.appointment_events) = 2
  and not exists (
    select 1 from public.appointment_events
    where appointment_id = '7e000000-0000-4000-8000-000000000102'
  ),
  format('eventos_visibles=%s', (select count(*) from public.appointment_events))
);
select public.pry07_expect_error(
  'SEC-45', 'El médico no puede confirmar citas',
  $q$select public.confirm_appointment(
    '7e000000-0000-4000-8000-000000000101',
    (select updated_at from public.appointments
      where id = '7e000000-0000-4000-8000-000000000101')
  )$q$,
  '42501'
);
select public.pry07_expect_error(
  'SEC-46', 'El médico no puede cancelar citas',
  $q$select public.cancel_appointment(
    '7e000000-0000-4000-8000-000000000101', now(), 'Intento médico'
  )$q$,
  '42501'
);
select public.pry07_expect_error(
  'SEC-47', 'El médico no puede reprogramar citas',
  $q$select public.reschedule_appointment(
    '7e000000-0000-4000-8000-000000000101', now(), now(), 30::smallint
  )$q$,
  '42501'
);
select public.pry07_expect_error(
  'SEC-48', 'El médico no puede insertar citas directamente',
  $q$insert into public.appointments (
    patient_id, physician_id, starts_at, duration_minutes, reason
  ) values (
    '7e000000-0000-4000-8000-000000000001',
    '7e000000-0000-4000-8000-0000000000a1',
    '2035-07-14T09:00:00Z', 30, 'Cita creada por médico'
  )$q$,
  '42501'
);
select public.pry07_expect_error(
  'SEC-49', 'El médico no puede insertar bloqueos de agenda',
  $q$insert into public.physician_schedule_blocks (
    physician_id, starts_at, ends_at, reason
  ) values (
    '7e000000-0000-4000-8000-0000000000a1',
    '2035-07-14T10:00:00Z', '2035-07-14T11:00:00Z', 'Bloqueo médico'
  )$q$,
  '42501'
);

update public.physician_schedule_blocks
set reason = 'Intento de cambio'
where id = '7e000000-0000-4000-8000-000000000202';
select public.pry07_check(
  'SEC-50', 'El médico no puede modificar bloqueos directamente',
  (
    select reason = 'Ausencia ficticia uno'
    from public.physician_schedule_blocks
    where id = '7e000000-0000-4000-8000-000000000202'
  ),
  'fila sin cambios'
);

delete from public.physician_schedule_blocks
where id = '7e000000-0000-4000-8000-000000000202';
select public.pry07_check(
  'SEC-51', 'El médico no puede borrar bloqueos directamente',
  exists (
    select 1 from public.physician_schedule_blocks
    where id = '7e000000-0000-4000-8000-000000000202'
  ),
  'fila conservada'
);
select public.pry07_check(
  'SEC-52', 'El médico solo ve sus propios bloqueos',
  (select count(*) from public.physician_schedule_blocks) = 2
  and not exists (
    select 1 from public.physician_schedule_blocks
    where id = '7e000000-0000-4000-8000-000000000201'
  ),
  format('bloqueos_visibles=%s',
    (select count(*) from public.physician_schedule_blocks))
);

reset role;

-- SEC-53 · Aislamiento cruzado con el segundo médico.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '7e000000-0000-4000-8000-0000000000f4',
    'app_metadata', jsonb_build_object(
      'appointment_role', 'physician',
      'physician_id', '7e000000-0000-4000-8000-0000000000a2'
    )
  )::text,
  false
);
set role authenticated;

select public.pry07_check(
  'SEC-53', 'Un médico no ve citas ni pacientes de otro médico',
  (select count(*) from public.appointments) = 1
  and (select count(*) from public.patients) = 1
  and not exists (
    select 1 from public.appointments
    where id = '7e000000-0000-4000-8000-000000000101'
  )
  and not exists (
    select 1 from public.patients
    where id = '7e000000-0000-4000-8000-000000000001'
  ),
  format('citas=%s pacientes=%s',
    (select count(*) from public.appointments),
    (select count(*) from public.patients))
);

reset role;

-- SEC-54..56 · Autoría de eventos con administración.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '7e000000-0000-4000-8000-0000000000f1',
    'app_metadata', jsonb_build_object('appointment_role', 'admin')
  )::text,
  false
);
set role authenticated;

select public.confirm_appointment(
  '7e000000-0000-4000-8000-000000000107',
  (select updated_at from public.appointments
    where id = '7e000000-0000-4000-8000-000000000107')
);
select public.pry07_check(
  'SEC-54', 'El evento confirmed guarda al administrador y la transición',
  exists (
    select 1 from public.appointment_events
    where appointment_id = '7e000000-0000-4000-8000-000000000107'
      and event_type = 'confirmed'
      and actor_user_id = '7e000000-0000-4000-8000-0000000000f1'::uuid
      and previous_status = 'pending'
      and new_status = 'confirmed'
  ),
  'autoría y transición comprobadas'
);
select public.pry07_check(
  'SEC-55', 'El evento created de una cita guarda al usuario que la creó',
  exists (
    select 1 from public.appointment_events
    where appointment_id = '7e000000-0000-4000-8000-000000000104'
      and event_type = 'created'
      and actor_user_id = '7e000000-0000-4000-8000-0000000000f2'::uuid
  ),
  'autoría de la creación por recepción'
);
select public.pry07_check(
  'SEC-56', 'El historial no se puede reescribir con UPDATE directo',
  not has_table_privilege('authenticated', 'public.appointment_events', 'UPDATE'),
  'sin privilegio UPDATE'
);

reset role;

\echo PRY07-RESULTS
select 'PRY07|'||id||'|'||status||'|'||description||'|'||
  replace(coalesce(detail, ''), '|', '/')
from public.pry07_results
order by id;
