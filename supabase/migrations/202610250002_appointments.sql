-- RF-01, RF-02 y RF-05: esquema propuesto de pacientes, médicos y citas.
--
-- Esta migración NO se ha ejecutado contra el proyecto remoto. Requiere
-- revisión y aprobación del responsable de datos antes de aplicarse.
--
-- Suposiciones conservadoras:
-- 1. La agenda la opera personal autenticado (admin/recepción). Los médicos
--    solo consultan su propia agenda; no se habilita autoservicio de pacientes.
-- 2. El rol se guarda en app_metadata del JWT (solo editable desde Auth Admin):
--    appointment_role = 'admin' | 'receptionist' | 'physician'.
--    Para physician se exige además physician_id con el UUID del médico.
-- 3. El estado inicial siempre es 'pending'. No hay políticas de UPDATE ni
--    DELETE porque confirmar, reprogramar y cancelar quedan fuera de alcance.
-- 4. La garantía contra solapamientos concurrentes es la restricción EXCLUDE,
--    no una consulta previa del frontend.
-- 5. No se crean usuarios ni datos de prueba. Pacientes y médicos deben
--    aprovisionarse por un proceso administrativo autorizado.

-- Supabase instala las extensiones en el esquema extensions y lo incluye en
-- search_path al aplicar migraciones. Si el proyecto ya la tiene en public,
-- `if not exists` conserva la instalación existente.
create extension if not exists btree_gist with schema extensions;

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint patients_display_name_check
    check (char_length(btrim(display_name)) between 1 and 200)
);

create table public.physicians (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint physicians_display_name_check
    check (char_length(btrim(display_name)) between 1 and 200)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null,
  physician_id uuid not null,
  starts_at timestamptz not null,
  duration_minutes smallint not null,
  -- Se mantiene por trigger: una columna generada exigiría una expresión
  -- inmutable y timestamptz + interval es estable, no inmutable.
  ends_at timestamptz not null,
  reason text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_patient_id_fkey
    foreign key (patient_id) references public.patients (id)
    on update restrict on delete restrict,
  constraint appointments_physician_id_fkey
    foreign key (physician_id) references public.physicians (id)
    on update restrict on delete restrict,
  constraint appointments_duration_check
    check (duration_minutes in (15, 30, 45, 60)),
  constraint appointments_status_check
    check (status in ('pending', 'confirmed', 'cancelled')),
  constraint appointments_reason_check
    check (char_length(btrim(reason)) between 1 and 500),
  constraint appointments_ends_at_check
    check (ends_at > starts_at),
  constraint appointments_no_overlap
    exclude using gist (
      physician_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (status <> 'cancelled')
);

create index appointments_physician_starts_idx
  on public.appointments (physician_id, starts_at);
create index appointments_patient_starts_idx
  on public.appointments (patient_id, starts_at);
create index appointments_status_starts_idx
  on public.appointments (status, starts_at);
create index appointments_physician_patient_idx
  on public.appointments (physician_id, patient_id);

create or replace function public.set_appointment_times()
returns trigger
language plpgsql
as $$
begin
  new.ends_at := new.starts_at + make_interval(mins => new.duration_minutes);
  new.updated_at := now();
  return new;
end;
$$;

create trigger appointments_set_times
before insert or update on public.appointments
for each row execute function public.set_appointment_times();

-- Helpers de autorización: leen exclusivamente el JWT firmado.
create or replace function public.appointment_role()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'appointment_role', '');
$$;

create or replace function public.appointment_physician_id()
returns text
language sql
stable
as $$
  -- UUID en minúsculas: las columnas uuid se serializan así y la comparación
  -- textual de las políticas no debe depender de mayúsculas en app_metadata.
  select lower(nullif(auth.jwt() -> 'app_metadata' ->> 'physician_id', ''));
$$;

alter table public.patients enable row level security;
alter table public.physicians enable row level security;
alter table public.appointments enable row level security;

create policy patients_select_staff
on public.patients
for select
to authenticated
using (
  public.appointment_role() in ('admin', 'receptionist')
);

-- Un médico solo puede resolver pacientes que tengan alguna cita con él.
-- La subconsulta está sujeta a la política de appointments, que ya limita
-- las filas del médico; no hay recursión entre ambas políticas.
create policy patients_select_physician_own_appointments
on public.patients
for select
to authenticated
using (
  public.appointment_role() = 'physician'
  and exists (
    select 1
    from public.appointments as appointment
    where appointment.patient_id = patients.id
      and appointment.physician_id::text = public.appointment_physician_id()
  )
);

create policy physicians_select_staff
on public.physicians
for select
to authenticated
using (
  public.appointment_role() in ('admin', 'receptionist')
);

create policy physicians_select_self
on public.physicians
for select
to authenticated
using (
  public.appointment_role() = 'physician'
  and id::text = public.appointment_physician_id()
);

create policy appointments_select_staff
on public.appointments
for select
to authenticated
using (
  public.appointment_role() in ('admin', 'receptionist')
  or (
    public.appointment_role() = 'physician'
    and physician_id::text = public.appointment_physician_id()
  )
);

create policy appointments_insert_staff
on public.appointments
for insert
to authenticated
with check (
  public.appointment_role() in ('admin', 'receptionist')
  and status = 'pending'
);

-- Sin políticas de UPDATE/DELETE: RF-03 y RF-04 quedan fuera de esta entrega.
-- Se revoca también authenticated para no depender de los privilegios por
-- defecto del proyecto y conceder solo lo necesario.
revoke all on public.patients from anon, authenticated;
revoke all on public.physicians from anon, authenticated;
revoke all on public.appointments from anon, authenticated;

grant select on public.patients to authenticated;
grant select on public.physicians to authenticated;
grant select, insert on public.appointments to authenticated;

comment on table public.patients is
  'Pacientes mínimos para agenda. Aprovisionamiento administrativo pendiente.';
comment on table public.physicians is
  'Médicos mínimos para agenda. Aprovisionamiento administrativo pendiente.';
comment on table public.appointments is
  'Citas RF-01/RF-02/RF-05. La restricción appointments_no_overlap protege concurrencia.';
