-- Prueba de integración de la restricción de solapamientos.
-- Requiere una base local con la migración 202610250002 aplicada.
-- No se ejecutó contra el proyecto remoto. Se puede correr con:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/appointments.sql
-- Todo ocurre dentro de una transacción que termina en ROLLBACK.

begin;

insert into public.patients (id, display_name)
values ('11111111-1111-4111-8111-111111111111', 'Paciente Sintético');

insert into public.physicians (id, display_name)
values
  ('22222222-2222-4222-8222-222222222222', 'Dra. Sintética'),
  ('33333333-3333-4333-8333-333333333333', 'Dr. Alterno');

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
  '2030-01-15T16:00:00Z',
  30,
  'Consulta sintética',
  'pending'
);

do $$
declare
  stored_ends_at timestamptz;
begin
  select ends_at into stored_ends_at
  from public.appointments
  where physician_id = '22222222-2222-4222-8222-222222222222'
    and starts_at = '2030-01-15T16:00:00Z';

  if stored_ends_at is distinct from '2030-01-15T16:30:00Z'::timestamptz then
    raise exception 'ends_at no se calculó correctamente: %', stored_ends_at;
  end if;
end;
$$;

do $$
begin
  begin
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
      '2030-01-15T16:15:00Z',
      30,
      'Intento superpuesto',
      'pending'
    );
    raise exception 'La restricción de solapamiento no rechazó el intento';
  exception
    when exclusion_violation then
      null;
  end;
end;
$$;

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
  '33333333-3333-4333-8333-333333333333',
  '2030-01-15T16:00:00Z',
  30,
  'Médico diferente',
  'pending'
);

update public.appointments
set status = 'cancelled'
where physician_id = '22222222-2222-4222-8222-222222222222'
  and starts_at = '2030-01-15T16:00:00Z';

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
  '2030-01-15T16:00:00Z',
  30,
  'Horario liberado por cancelación',
  'pending'
);

rollback;
