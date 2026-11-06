-- Solo datos sinteticos, todo se revierte. Administrador prepara fixtures;
-- authenticated verifica RLS (no equivale a validar emision JWT de GoTrue).
begin;
create function pg_temp.expect_error(statement text, expected_state text) returns void
language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise;
  end;
  raise exception 'Se esperaba SQLSTATE % para %',expected_state,statement;
end;
$$;
insert into patients(id,display_name) values ('11111111-1111-4111-8111-111111111111','Paciente TAR05');
insert into physicians(id,display_name) values
 ('22222222-2222-4222-8222-222222222222','Medico TAR05 A'),
 ('33333333-3333-4333-8333-333333333333','Medico TAR05 B');
insert into appointments(id,patient_id,physician_id,starts_at,duration_minutes,reason) values
 ('aaaaaaaa-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','2035-01-01 12:00Z',30,'Prueba TAR05');
insert into physician_schedule_blocks(id,physician_id,starts_at,ends_at,reason) values
 ('bbbbbbbb-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','2035-01-01 14:00Z','2035-01-01 15:00Z','Ausencia TAR05');
-- El trigger inserta appointment_events: quinta insercion positiva comprobada.
do $$ begin
 if (select count(*) from appointment_events where appointment_id='aaaaaaaa-1111-4111-8111-111111111111') <> 1 then raise exception 'Historial faltante'; end if;
end $$;
select pg_temp.expect_error($q$insert into patients select * from patients$q$,'23505');
select pg_temp.expect_error($q$insert into physicians select * from physicians$q$,'23505');
select pg_temp.expect_error($q$insert into appointments select * from appointments$q$,'23505');
select pg_temp.expect_error($q$insert into appointment_events overriding system value select * from appointment_events$q$,'23505');
select pg_temp.expect_error($q$insert into physician_schedule_blocks select * from physician_schedule_blocks$q$,'23505');
select pg_temp.expect_error($q$update appointments set patient_id='ffffffff-ffff-4fff-8fff-ffffffffffff'$q$,'23503');
select pg_temp.expect_error($q$update appointments set physician_id='ffffffff-ffff-4fff-8fff-ffffffffffff'$q$,'23503');
select pg_temp.expect_error($q$update appointments set status='invalid'$q$,'23514');
select pg_temp.expect_error($q$update appointments set duration_minutes=0$q$,'23514');
select pg_temp.expect_error($q$update appointments set duration_minutes=-30$q$,'23514');
select pg_temp.expect_error($q$update physician_schedule_blocks set ends_at=starts_at$q$,'23514');
select pg_temp.expect_error($q$update physician_schedule_blocks set physician_id='ffffffff-ffff-4fff-8fff-ffffffffffff'$q$,'23503');
select pg_temp.expect_error($q$update appointment_events set appointment_id='ffffffff-ffff-4fff-8fff-ffffffffffff'$q$,'23503');
select pg_temp.expect_error($q$update appointments set starts_at='2035-01-01 14:15Z'$q$,'23P01');
select pg_temp.expect_error($q$update physician_schedule_blocks set starts_at='2035-01-01 12:00Z'$q$,'23P01');
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","app_metadata":{}}',true);
set local role authenticated;
do $$ begin
 if (select count(*) from patients) <> 0 or (select count(*) from appointments) <> 0
 or (select count(*) from physicians) <> 0 or (select count(*) from appointment_events) <> 0
 or (select count(*) from physician_schedule_blocks) <> 0 then raise exception 'RLS sin rol'; end if;
end $$;
select pg_temp.expect_error($q$insert into physician_schedule_blocks(physician_id,starts_at,ends_at,reason) values ('22222222-2222-4222-8222-222222222222','2035-02-01 12:00Z','2035-02-01 13:00Z','No autorizado')$q$,'42501');
reset role;
select 'PASS: cinco tablas, PK, FK, CHECK, bloqueos y RLS sin rol' as resultado;
rollback;
