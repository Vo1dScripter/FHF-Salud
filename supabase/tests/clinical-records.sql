-- PRY06 RF-07 a RF-12: pruebas de integridad, transacciones y permisos.
-- Ejecutar como administrador sobre PostgreSQL local (scripts/tar05/verify-database.py).
-- Todo ocurre dentro de una transaccion con rollback final. Datos 100% ficticios.
begin;

-- Auxiliares de prueba (se eliminan con el rollback).
create function public.test_expect(p_sql text, p_state text, p_label text)
returns void
language plpgsql
as $$
declare
  got text := 'no_error';
begin
  begin
    execute p_sql;
  exception when others then
    got := sqlstate;
  end;
  -- Algunas violaciones admiten más de un SQLSTATE según la versión de
  -- PostgreSQL (p. ej. ON DELETE RESTRICT: 23001 en PG18, 23503 en PG17).
  if not (got = any(string_to_array(p_state, '|'))) then
    raise exception 'FAIL %: se esperaba % y se obtuvo %', p_label, p_state, got;
  end if;
end;
$$;

create function public.test_as(p_sub text, p_role text, p_physician text)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    case when p_sub is null then '{}'
    else jsonb_build_object(
      'sub', p_sub,
      'app_metadata', jsonb_strip_nulls(jsonb_build_object(
        'appointment_role', p_role, 'physician_id', p_physician))
    )::text end,
    true
  );
end;
$$;

grant execute on function public.test_expect(text, text, text) to anon, authenticated;
grant execute on function public.test_as(text, text, text) to anon, authenticated;

-- Datos ficticios.
insert into public.physicians (id, display_name, active) values
  ('c1000000-0000-4000-8000-000000000001', 'Medico Ficticio A', true),
  ('c1000000-0000-4000-8000-000000000002', 'Medico Ficticio B', true),
  ('c1000000-0000-4000-8000-000000000003', 'Medico Ficticio Inactivo', false);
insert into public.patients (id, display_name) values
  ('c2000000-0000-4000-8000-000000000001', 'Paciente Preexistente Ficticio'),
  ('c2000000-0000-4000-8000-000000000002', 'Paciente de Medico B Ficticio'),
  ('c2000000-0000-4000-8000-000000000003', 'Paciente Integridad Ficticio');
insert into public.appointments
  (patient_id, physician_id, starts_at, duration_minutes, reason) values
  ('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
   '2036-03-02 15:00Z', 30, 'Cita ficticia A'),
  ('c2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002',
   '2036-03-02 16:00Z', 30, 'Cita ficticia B');

-- 1. Estructura: RLS activo y expediente unico.
do $$
begin
  assert (select relrowsecurity from pg_class
          where oid = 'public.clinical_records'::regclass), 'RLS clinical_records';
  assert (select relrowsecurity from pg_class
          where oid = 'public.clinical_record_revisions'::regclass), 'RLS revisiones';
  assert (select relrowsecurity from pg_class
          where oid = 'public.patient_physicians'::regclass), 'RLS asociacion';
  assert exists (select 1 from pg_constraint
                 where conname = 'clinical_records_patient_id_key'), 'UNIQUE expediente';
  raise notice 'PASS estructura: RLS activo y expediente unico por paciente';
end;
$$;

-- 2. Integridad (como administrador, sin pasar por RLS).
select public.test_expect(
  $q$insert into public.clinical_records (patient_id, created_by_physician_id)
     values (gen_random_uuid(), 'c1000000-0000-4000-8000-000000000001')$q$,
  '23503', 'FK expediente -> paciente');

insert into public.clinical_records (id, patient_id, created_by_physician_id)
values ('c3000000-0000-4000-8000-000000000001',
        'c2000000-0000-4000-8000-000000000003',
        'c1000000-0000-4000-8000-000000000001');

select public.test_expect(
  $q$insert into public.clinical_records (patient_id, created_by_physician_id)
     values ('c2000000-0000-4000-8000-000000000003',
             'c1000000-0000-4000-8000-000000000001')$q$,
  '23505', 'expediente unico por paciente');

insert into public.clinical_record_revisions
  (record_id, revision_number, background, author_user_id, author_physician_id)
values ('c3000000-0000-4000-8000-000000000001', 1, 'Antecedente ficticio',
        'd1000000-0000-4000-8000-000000000001',
        'c1000000-0000-4000-8000-000000000001');

select public.test_expect(
  $q$insert into public.clinical_record_revisions
       (record_id, revision_number, author_user_id, author_physician_id)
     values ('c3000000-0000-4000-8000-000000000001', 1,
             'd1000000-0000-4000-8000-000000000001',
             'c1000000-0000-4000-8000-000000000001')$q$,
  '23505', 'numero de revision unico');
select public.test_expect(
  $q$insert into public.clinical_record_revisions
       (record_id, revision_number, change_reason, allergies_status,
        author_user_id, author_physician_id)
     values ('c3000000-0000-4000-8000-000000000001', 2, 'Motivo', 'invalido',
             'd1000000-0000-4000-8000-000000000001',
             'c1000000-0000-4000-8000-000000000001')$q$,
  '23514', 'estado de alergias invalido');
select public.test_expect(
  $q$insert into public.clinical_record_revisions
       (record_id, revision_number, allergies_status,
        author_user_id, author_physician_id)
     values ('c3000000-0000-4000-8000-000000000001', 2, 'reported',
             'd1000000-0000-4000-8000-000000000001',
             'c1000000-0000-4000-8000-000000000001')$q$,
  '23514', 'alergias reportadas exigen texto');
select public.test_expect(
  $q$insert into public.clinical_record_revisions
       (record_id, revision_number, author_user_id, author_physician_id)
     values ('c3000000-0000-4000-8000-000000000001', 2,
             'd1000000-0000-4000-8000-000000000001',
             'c1000000-0000-4000-8000-000000000001')$q$,
  '23514', 'edicion exige motivo');
select public.test_expect(
  $q$update public.clinical_record_revisions set diagnosis = 'alterado'$q$,
  '42501', 'revisiones inmutables (update)');
select public.test_expect(
  $q$delete from public.clinical_record_revisions$q$,
  '42501', 'revisiones inmutables (delete)');
select public.test_expect(
  $q$delete from public.patients
     where id = 'c2000000-0000-4000-8000-000000000003'$q$,
  '23001|23503', 'no se borra un paciente con expediente');
select public.test_expect(
  $q$update public.patients set birth_date = date '1800-01-01'
     where id = 'c2000000-0000-4000-8000-000000000001'$q$,
  '23514', 'fecha de nacimiento fuera de rango');
select public.test_expect(
  $q$update public.patients set sex = 'x'
     where id = 'c2000000-0000-4000-8000-000000000001'$q$,
  '23514', 'sexo invalido');

do $$
begin
  raise notice 'PASS integridad: FK, UNIQUE, CHECK e inmutabilidad de revisiones';
end;
$$;

-- 3. Escrituras directas denegadas al medico autenticado.
set local role authenticated;
select public.test_as('d1000000-0000-4000-8000-000000000001', 'physician',
                      'c1000000-0000-4000-8000-000000000001');
select public.test_expect(
  $q$insert into public.clinical_records (patient_id, created_by_physician_id)
     values ('c2000000-0000-4000-8000-000000000001',
             'c1000000-0000-4000-8000-000000000001')$q$,
  '42501', 'sin INSERT directo en expedientes');
select public.test_expect(
  $q$insert into public.patients (display_name) values ('Directo Ficticio')$q$,
  '42501', 'sin INSERT directo en pacientes');
select public.test_expect(
  $q$insert into public.patient_physicians (patient_id, physician_id, created_by)
     values ('c2000000-0000-4000-8000-000000000001',
             'c1000000-0000-4000-8000-000000000001',
             'd1000000-0000-4000-8000-000000000001')$q$,
  '42501', 'sin INSERT directo en asociacion');
select public.test_expect(
  $q$update public.clinical_record_revisions set diagnosis = 'alterado'$q$,
  '42501', 'sin UPDATE directo en revisiones');

-- 4. RF-07: alta transaccional paciente + asociacion + expediente.
do $$
declare
  r record;
begin
  select * into r
  from public.register_patient('Paciente Ficticio Uno', date '1990-05-10',
                               'female', '5551234567');
  assert r.new_patient_id is not null and r.new_record_id is not null,
    'el alta devuelve IDs reales';
  assert (select count(*) from public.patients
          where id = r.new_patient_id) = 1, 'el medico ve su paciente nuevo';
  assert (select count(*) from public.clinical_records
          where id = r.new_record_id and current_revision = 0) = 1,
    'expediente creado sin revisiones';
  assert (select count(*) from public.patient_physicians
          where patient_id = r.new_patient_id
            and physician_id = 'c1000000-0000-4000-8000-000000000001') = 1,
    'asociacion con el medico de la sesion';
  raise notice 'PASS RF-07: alta crea paciente, asociacion y expediente';
end;
$$;

select public.test_expect(
  $q$select * from public.register_patient('  paciente ficticio uno ',
                                            date '1990-05-10')$q$,
  'PT409', 'duplicado nombre + fecha de nacimiento');
select public.test_expect(
  $q$select * from public.register_patient('   ')$q$, 'PT400', 'nombre vacio');
select public.test_expect(
  $q$select * from public.register_patient('Futuro Ficticio', date '2999-01-01')$q$,
  'PT400', 'fecha de nacimiento futura');
select public.test_expect(
  $q$select * from public.register_patient('Sexo Ficticio', null, 'x')$q$,
  'PT400', 'sexo invalido en alta');
select public.test_expect(
  $q$select * from public.register_patient('Telefono Ficticio', null, null, '123')$q$,
  'PT400', 'telefono invalido en alta');

-- 5. Atomicidad: si falla el expediente no queda paciente huerfano.
reset role;
create function public.test_fail_record()
returns trigger
language plpgsql
as $$
begin
  raise exception 'fallo simulado al crear expediente';
end;
$$;
create trigger test_fail_record
before insert on public.clinical_records
for each row execute function public.test_fail_record();

set local role authenticated;
select public.test_expect(
  $q$select * from public.register_patient('Paciente Atomicidad Ficticio')$q$,
  'P0001', 'fallo simulado a mitad del alta');
reset role;
do $$
begin
  assert not exists (select 1 from public.patients
                     where display_name = 'Paciente Atomicidad Ficticio'),
    'no queda paciente huerfano';
  assert not exists (select 1 from public.patient_physicians as link
                     join public.patients as patient on patient.id = link.patient_id
                     where patient.display_name = 'Paciente Atomicidad Ficticio'),
    'no queda asociacion huerfana';
  raise notice 'PASS atomicidad: un fallo a mitad del alta no deja registros huerfanos';
end;
$$;
drop trigger test_fail_record on public.clinical_records;
drop function public.test_fail_record();

-- 6. RF-08, RF-09 y RF-11: revisiones, autor y concurrencia.
set local role authenticated;
do $$
declare
  pid uuid;
  rev public.clinical_record_revisions;
  rec public.clinical_records;
begin
  select id into pid from public.patients
  where display_name = 'Paciente Ficticio Uno';

  rev := public.save_clinical_revision(pid, 0, 'Antecedente ficticio', 'reported',
    'Alergia ficticia', 'Diagnostico ficticio', 'Tratamiento ficticio', null);
  assert rev.revision_number = 1, 'primera revision = 1';
  assert rev.author_user_id = 'd1000000-0000-4000-8000-000000000001'::uuid,
    'autor tomado de la sesion';
  assert rev.author_physician_id = 'c1000000-0000-4000-8000-000000000001'::uuid,
    'medico verificado en servidor';
  assert rev.created_at = now(), 'fecha tomada del servidor';

  perform public.test_expect(format(
    $q$select public.save_clinical_revision(%L, 0, 'x', 'not_recorded', null, 'x', null, 'cambio')$q$,
    pid), 'PT409', 'version obsoleta');
  perform public.test_expect(format(
    $q$select public.save_clinical_revision(%L, 1, 'x', 'not_recorded', null, 'x', null, null)$q$,
    pid), 'PT400', 'edicion sin motivo');
  perform public.test_expect(format(
    $q$select public.save_clinical_revision(%L, 1, 'x', 'reported', null, 'x', null, 'cambio')$q$,
    pid), 'PT400', 'alergias reportadas sin texto');
  perform public.test_expect(format(
    $q$select public.save_clinical_revision(%L, 1, 'x', 'none_reported', 'texto', 'x', null, 'cambio')$q$,
    pid), 'PT400', 'niega alergias con texto');
  perform public.test_expect(format(
    $q$select public.save_clinical_revision(%L, 1, null, 'not_recorded', null, null, null, 'cambio')$q$,
    pid), 'PT400', 'revision sin informacion');

  rev := public.save_clinical_revision(pid, 1, 'Antecedente ficticio editado',
    'none_reported', null, 'Diagnostico editado', 'Tratamiento editado',
    'Correccion ficticia');
  assert rev.revision_number = 2, 'segunda revision = 2';
  select * into rec from public.clinical_records where patient_id = pid;
  assert rec.current_revision = 2, 'el expediente apunta a la revision vigente';
  assert rec.updated_at = now(), 'marca de modificacion actualizada';
  assert (select count(*) from public.clinical_record_revisions
          where record_id = rec.id) = 2, 'el historial conserva ambas revisiones';
  assert (select diagnosis from public.clinical_record_revisions
          where record_id = rec.id and revision_number = 1) = 'Diagnostico ficticio',
    'la revision original no se sobrescribe';
  raise notice 'PASS RF-08/09/11: revisiones auditadas, autor de la sesion y 409';
end;
$$;

-- 7. Aislamiento entre medicos: B no ve ni edita lo de A.
select public.test_as('d1000000-0000-4000-8000-000000000002', 'physician',
                      'c1000000-0000-4000-8000-000000000002');
do $$
declare
  pid uuid;
begin
  assert (select count(*) from public.patients
          where display_name = 'Paciente Ficticio Uno') = 0,
    'B no ve pacientes de A';
  assert (select count(*) from public.clinical_record_revisions) = 0,
    'B no ve revisiones de A';
  assert (select count(*) from public.clinical_records) = 0,
    'B no ve expedientes de A';
  select id into pid from public.patients
  where display_name = 'Paciente Ficticio Uno'
  union all select 'c2000000-0000-4000-8000-000000000001'::uuid limit 1;
  perform public.test_expect(format(
    $q$select public.save_clinical_revision(%L, 2, 'x', 'not_recorded', null, 'x', null, 'cambio')$q$,
    'c2000000-0000-4000-8000-000000000001'), '42501', 'B no edita expediente ajeno');
  raise notice 'PASS aislamiento: un medico no accede al expediente de otro';
end;
$$;

-- 8. Pacientes preexistentes de citas.
select public.test_as('d1000000-0000-4000-8000-000000000001', 'physician',
                      'c1000000-0000-4000-8000-000000000001');
do $$
declare
  first_call record;
  second_call record;
begin
  select * into first_call
  from public.open_clinical_record('c2000000-0000-4000-8000-000000000001');
  assert first_call.was_created, 'primera apertura crea el expediente';
  select * into second_call
  from public.open_clinical_record('c2000000-0000-4000-8000-000000000001');
  assert not second_call.was_created, 'segunda apertura no duplica';
  assert first_call.out_record_id = second_call.out_record_id, 'mismo expediente';
  assert (select count(*) from public.clinical_records
          where patient_id = 'c2000000-0000-4000-8000-000000000001') = 1,
    'un solo expediente';
  perform public.test_expect(
    $q$select * from public.open_clinical_record('c2000000-0000-4000-8000-000000000002')$q$,
    '42501', 'sin cita con ese paciente');
  perform public.test_expect(
    $q$select * from public.open_clinical_record(gen_random_uuid())$q$,
    'PT404', 'paciente inexistente');
  perform public.test_expect(
    $q$select * from public.open_clinical_record(null)$q$,
    'PT400', 'paciente nulo');
  raise notice 'PASS preexistentes: abrir expediente exige cita y es idempotente';
end;
$$;

-- 9. RF-12: roles y sesiones no autorizados.
reset role;
do $$
begin
  assert (select count(*) from public.clinical_records) > 0, 'hay expedientes';
  assert (select count(*) from public.clinical_record_revisions) > 0, 'hay revisiones';
  assert (select count(*) from public.patient_physicians) > 0, 'hay asociaciones';
end;
$$;

set local role authenticated;
do $$
declare
  claim text;
begin
  foreach claim in array array[
    '{"sub":"d1000000-0000-4000-8000-000000000009","app_metadata":{"appointment_role":"receptionist"}}',
    '{"sub":"d1000000-0000-4000-8000-000000000009","app_metadata":{"appointment_role":"admin"}}',
    '{"sub":"d1000000-0000-4000-8000-000000000009","app_metadata":{}}',
    '{"sub":"d1000000-0000-4000-8000-000000000008","app_metadata":{"appointment_role":"physician","physician_id":"c1000000-0000-4000-8000-000000000003"}}',
    '{"sub":"d1000000-0000-4000-8000-000000000007","app_metadata":{"appointment_role":"physician"}}',
    '{}'
  ] loop
    perform set_config('request.jwt.claims', claim, true);
    assert (select count(*) from public.clinical_records) = 0,
      'sin lectura de expedientes: ' || claim;
    assert (select count(*) from public.clinical_record_revisions) = 0,
      'sin lectura de revisiones: ' || claim;
    assert (select count(*) from public.patient_physicians) = 0,
      'sin lectura de asociaciones: ' || claim;
    perform public.test_expect(
      $q$select * from public.register_patient('Intruso Ficticio')$q$,
      '42501', 'alta rechazada: ' || claim);
    perform public.test_expect(
      $q$select * from public.open_clinical_record('c2000000-0000-4000-8000-000000000001')$q$,
      '42501', 'apertura rechazada: ' || claim);
    perform public.test_expect(
      $q$select public.save_clinical_revision('c2000000-0000-4000-8000-000000000001', 0, 'x', 'not_recorded', null, 'x', null, null)$q$,
      '42501', 'revision rechazada: ' || claim);
  end loop;
  raise notice 'PASS RF-12: recepcion, admin, sin rol, medico inactivo y sin sesion rechazados';
end;
$$;

-- 10. Usuario anonimo.
set local role anon;
select public.test_expect(
  $q$select count(*) from public.clinical_records$q$, '42501', 'anon sin lectura');
select public.test_expect(
  $q$select * from public.register_patient('Anonimo Ficticio')$q$,
  '42501', 'anon sin ejecutar alta');

reset role;
do $$
begin
  raise notice 'PASS clinical-records.sql: integridad, transacciones, auditoria y permisos';
end;
$$;
rollback;