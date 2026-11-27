-- Regresion: una cita cancelada no permite abrir el expediente. Datos ficticios.
begin;
insert into public.physicians (id, display_name, active) values
  ('f1000000-0000-4000-8000-000000000001', 'Medico Cancelada Ficticio', true);
insert into public.patients (id, display_name) values
  ('f2000000-0000-4000-8000-000000000001', 'Paciente Cancelada Ficticio');
insert into public.appointments
  (id, patient_id, physician_id, starts_at, duration_minutes, reason) values
  ('f3000000-0000-4000-8000-000000000001',
   'f2000000-0000-4000-8000-000000000001',
   'f1000000-0000-4000-8000-000000000001',
   '2036-05-04 15:00Z', 30, 'Cita ficticia a cancelar');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"f4000000-0000-4000-8000-000000000001","app_metadata":{"appointment_role":"receptionist"}}', true);
do $$
declare
  current_appointment public.appointments;
begin
  select * into current_appointment from public.appointments
  where id = 'f3000000-0000-4000-8000-000000000001';
  perform public.cancel_appointment(current_appointment.id,
    current_appointment.updated_at, 'Cancelacion ficticia');
end;
$$;

select set_config('request.jwt.claims',
  '{"sub":"f4000000-0000-4000-8000-000000000002","app_metadata":{"appointment_role":"physician","physician_id":"f1000000-0000-4000-8000-000000000001"}}', true);
do $$
begin
  begin
    perform * from public.open_clinical_record('f2000000-0000-4000-8000-000000000001');
    raise exception 'FAIL: una cita cancelada concedio acceso';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: una cita cancelada no permite abrir el expediente';
end;
$$;
reset role;
rollback;
