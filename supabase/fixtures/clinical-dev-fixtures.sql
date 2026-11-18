-- Fixtures 100% ficticios para desarrollo local (PRY06).
-- NO aplicar en produccion ni mezclar con pacientes reales.
-- Idempotente: se puede ejecutar varias veces.
insert into public.physicians (id, display_name, active) values
  ('e1000000-0000-4000-8000-000000000001', 'Dra. Ficticia Uno', true),
  ('e1000000-0000-4000-8000-000000000002', 'Dr. Ficticio Dos', true),
  ('e1000000-0000-4000-8000-000000000003', 'Dr. Ficticio Inactivo', false)
on conflict (id) do nothing;

insert into public.patients (id, display_name, birth_date, sex, phone) values
  ('e2000000-0000-4000-8000-000000000001', 'Paciente Ficticio Alfa',
   date '1985-03-12', 'female', '5550000001'),
  ('e2000000-0000-4000-8000-000000000002', 'Paciente Ficticio Beta',
   date '1992-11-30', 'male', '5550000002'),
  ('e2000000-0000-4000-8000-000000000003', 'Paciente Ficticio Gamma (solo citas)',
   null, null, null)
on conflict (id) do nothing;

-- Alfa ya tiene asociacion y expediente (sin revisiones: revision 0).
insert into public.patient_physicians (patient_id, physician_id, created_by) values
  ('e2000000-0000-4000-8000-000000000001',
   'e1000000-0000-4000-8000-000000000001',
   'e3000000-0000-4000-8000-000000000001')
on conflict do nothing;

insert into public.clinical_records (id, patient_id, created_by_physician_id) values
  ('e4000000-0000-4000-8000-000000000001',
   'e2000000-0000-4000-8000-000000000001',
   'e1000000-0000-4000-8000-000000000001')
on conflict do nothing;

-- Gamma solo tiene una cita: sirve para probar open_clinical_record.
insert into public.appointments
  (patient_id, physician_id, starts_at, duration_minutes, reason) values
  ('e2000000-0000-4000-8000-000000000003',
   'e1000000-0000-4000-8000-000000000001',
   '2036-04-01 15:00Z', 30, 'Cita ficticia de desarrollo')
on conflict do nothing;
