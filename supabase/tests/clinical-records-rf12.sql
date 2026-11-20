-- PRY06 RF-12: denegacion de acceso no autorizado al historial clinico.
-- Capa RLS/funciones sobre PostgreSQL local; datos 100% ficticios.
-- Cada caso se ejecuta dentro de la misma transaccion y termina con rollback.
begin;

create function public.test_rf12_expect(p_sql text, p_state text, p_label text)
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
  if got <> p_state then
    raise exception 'FAIL %: se esperaba % y se obtuvo %', p_label, p_state, got;
  end if;
end;
$$;

create function public.test_rf12_as(p_claims jsonb)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', p_claims::text, true);
end;
$$;

grant execute on function public.test_rf12_expect(text, text, text)
  to anon, authenticated;
grant execute on function public.test_rf12_as(jsonb) to anon, authenticated;

insert into public.physicians (id, display_name, active) values
  ('a1000000-0000-4000-8000-000000000001', 'Medico RF12 Activo Ficticio', true),
  ('a1000000-0000-4000-8000-000000000002', 'Medico RF12 Inactivo Ficticio', false);
insert into public.patients (id, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'Paciente RF12 Ficticio');
insert into public.appointments
  (id, patient_id, physician_id, starts_at, duration_minutes, reason, status) values
  ('a3000000-0000-4000-8000-000000000001',
   'a2000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001',
   '2036-09-01 15:00Z', 30, 'Cita RF12 cancelada ficticia', 'cancelled');

-- La preparacion de filas clinicas se hace como administrador para probar
-- despues que RLS las oculta a quien no tiene association.
insert into public.patient_physicians (patient_id, physician_id, created_by)
values ('a2000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000001',
        'a4000000-0000-4000-8000-000000000001');
insert into public.clinical_records
  (id, patient_id, created_by_physician_id, current_revision)
values ('a5000000-0000-4000-8000-000000000001',
        'a2000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000001', 1);
insert into public.clinical_record_revisions
  (record_id, revision_number, background, allergies_status, allergies,
   diagnosis, treatment, author_user_id, author_physician_id)
values ('a5000000-0000-4000-8000-000000000001', 1, 'Antecedente secreto ficticio',
        'reported', 'Alergia secreta ficticia', 'Diagnostico secreto ficticio',
        'Tratamiento secreto ficticio',
        'a4000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000001');

-- 1. Suplantacion por user_metadata: el rol solo cuenta en app_metadata.
set local role authenticated;
select public.test_rf12_as(
  '{"sub":"a4000000-0000-4000-8000-000000000009","user_metadata":{"appointment_role":"physician","physician_id":"a1000000-0000-4000-8000-000000000001"}}'
);
do $$
begin
  assert (select count(*) from public.clinical_records) = 0,
    'user_metadata no concede lectura de expedientes';
  assert (select count(*) from public.clinical_record_revisions) = 0,
    'user_metadata no concede lectura de revisiones';
  assert (select count(*) from public.patient_physicians) = 0,
    'user_metadata no concede lectura de asociaciones';
  raise notice 'PASS RF-12: user_metadata no suplanta al rol firmado';
end;
$$;
select public.test_rf12_expect(
  $q$select * from public.open_clinical_record('a2000000-0000-4000-8000-000000000001')$q$,
  '42501', 'apertura con user_metadata');
select public.test_rf12_expect(
  $q$select public.save_clinical_revision('a2000000-0000-4000-8000-000000000001', 1, 'x', 'not_recorded', null, 'x', null, 'cambio')$q$,
  '42501', 'edicion con user_metadata');

-- 2. Roles no clinicos y medico inactivo: sin filas y sin RPC.
do $$
declare
  claim jsonb;
begin
  foreach claim in array array[
    '{"sub":"a4000000-0000-4000-8000-000000000009","app_metadata":{"appointment_role":"receptionist"}}'::jsonb,
    '{"sub":"a4000000-0000-4000-8000-000000000009","app_metadata":{"appointment_role":"admin"}}'::jsonb,
    '{"sub":"a4000000-0000-4000-8000-000000000009","app_metadata":{}}'::jsonb,
    '{"sub":"a4000000-0000-4000-8000-000000000008","app_metadata":{"appointment_role":"physician","physician_id":"a1000000-0000-4000-8000-000000000002"}}'::jsonb
  ] loop
    perform public.test_rf12_as(claim);
    assert (select count(*) from public.clinical_records) = 0,
      'rol sin acceso lee expedientes: ' || claim::text;
    assert (select count(*) from public.clinical_record_revisions) = 0,
      'rol sin acceso lee revisiones: ' || claim::text;
    assert (select count(*) from public.patient_physicians) = 0,
      'rol sin acceso lee asociaciones: ' || claim::text;
    perform public.test_rf12_expect(
      $q$select * from public.open_clinical_record('a2000000-0000-4000-8000-000000000001')$q$,
      '42501', 'apertura rechazada: ' || claim::text);
    perform public.test_rf12_expect(
      $q$select public.save_clinical_revision('a2000000-0000-4000-8000-000000000001', 1, 'x', 'not_recorded', null, 'x', null, 'cambio')$q$,
      '42501', 'edicion rechazada: ' || claim::text);
  end loop;
  raise notice 'PASS RF-12: recepcion, admin, rol ausente e inactivo sin datos clinicos';
end;
$$;

-- 3. Medico activo con cita cancelada pero sin association: no abre ni lee.
-- La association previa se retira solo dentro de esta transaccion de prueba.
reset role;
delete from public.patient_physicians
where patient_id = 'a2000000-0000-4000-8000-000000000001'
  and physician_id = 'a1000000-0000-4000-8000-000000000001';
set local role authenticated;
select public.test_rf12_as(
  '{"sub":"a4000000-0000-4000-8000-000000000007","app_metadata":{"appointment_role":"physician","physician_id":"a1000000-0000-4000-8000-000000000001"}}'
);
do $$
begin
  assert (select count(*) from public.clinical_records) = 0,
    'una cita cancelada no concede expediente';
  assert (select count(*) from public.clinical_record_revisions) = 0,
    'una cita cancelada no concede revisiones';
  raise notice 'PASS RF-12: cita cancelada sin association no lee historial';
end;
$$;
select public.test_rf12_expect(
  $q$select * from public.open_clinical_record('a2000000-0000-4000-8000-000000000001')$q$,
  '42501', 'cita cancelada no abre expediente');
select public.test_rf12_expect(
  $q$select public.save_clinical_revision('a2000000-0000-4000-8000-000000000001', 1, 'x', 'not_recorded', null, 'x', null, 'cambio')$q$,
  '42501', 'cita cancelada no edita expediente');

-- 4. Anonimo: sin lectura ni ejecucion.
set local role anon;
select public.test_rf12_as('{}');
select public.test_rf12_expect(
  $q$select count(*) from public.clinical_records$q$, '42501', 'anon lee expedientes');
select public.test_rf12_expect(
  $q$select count(*) from public.clinical_record_revisions$q$, '42501', 'anon lee revisiones');
select public.test_rf12_expect(
  $q$select * from public.open_clinical_record('a2000000-0000-4000-8000-000000000001')$q$,
  '42501', 'anon abre expediente');
select public.test_rf12_expect(
  $q$select public.save_clinical_revision('a2000000-0000-4000-8000-000000000001', 1, 'x', 'not_recorded', null, 'x', null, 'cambio')$q$,
  '42501', 'anon edita expediente');

reset role;
do $$
begin
  raise notice 'PASS clinical-records-rf12.sql: acceso no autorizado denegado en RLS y RPC';
end;
$$;
rollback;
