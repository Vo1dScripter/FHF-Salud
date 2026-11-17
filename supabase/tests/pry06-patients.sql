-- Contrato actual: pacientes visibles solo mediante citas propias del médico.
-- PostgreSQL aislado, datos ficticios y rollback; no amplía RLS ni habilita altas.
begin;
insert into public.patients(id, display_name) values
 ('70000000-0000-4000-8000-000000000001','PRY06 Paciente propio'),
 ('70000000-0000-4000-8000-000000000002','PRY06 Paciente ajeno');
insert into public.physicians(id, display_name) values
 ('70000000-0000-4000-8000-000000000003','PRY06 Médico uno'),
 ('70000000-0000-4000-8000-000000000004','PRY06 Médico dos');
insert into public.appointments(patient_id, physician_id, starts_at, duration_minutes, reason) values
 ('70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000003','2035-06-01 12:00Z',30,'PRY06 ficticio'),
 ('70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000004','2035-06-01 12:00Z',30,'PRY06 ficticio');
select set_config('request.jwt.claims', '{"sub":"70000000-0000-4000-8000-000000000005","app_metadata":{"appointment_role":"physician","physician_id":"70000000-0000-4000-8000-000000000003"}}', true);
set local role authenticated;
do $$
begin
 if (select count(*) from public.patients where display_name like 'PRY06%') <> 1 then
   raise exception 'FAIL: alcance pacientes del médico';
 end if;
 if not exists (select 1 from public.patients where id = '70000000-0000-4000-8000-000000000001') then
   raise exception 'FAIL: patientId no coincide con cita';
 end if;
 if (select count(*) from public.physicians where active and id = '70000000-0000-4000-8000-000000000003') <> 1 then
   raise exception 'FAIL: vínculo physician activo';
 end if;
 begin
   insert into public.patients(display_name) values ('No permitido');
   raise exception 'FAIL: alta directa permitida';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"70000000-0000-4000-8000-000000000005","app_metadata":{},"user_metadata":{"appointment_role":"physician"}}', true);
set local role authenticated;
do $$ begin
 if exists (select 1 from public.patients) then raise exception 'FAIL: sin rol ve pacientes'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
   perform 1 from public.patients;
   raise exception 'FAIL: anon lee pacientes';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
