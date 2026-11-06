-- Prompt 2 (integrante 2) - Medical appointments schema for FHF Salud.
-- Aligned with the appointments contract from docs/citas-integracion.md (PRY05).

-- BTree_gist operator class support for GiST exclusion constraints that mix
-- equality (physician_id) with range overlap.
create extension if not exists btree_gist;

-- Appointment states: pending, confirmed or cancelled (aligned with the
-- AppointmentStatus contract of src/features/appointments/contracts.ts).
create type public.appointment_status as enum (
  'pending',
  'confirmed',
  'cancelled'
);

-- Patients: clinical patient identity linked to the authenticated user.
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Physicians: clinical physician profile linked to the authenticated user.
create table public.physicians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null,
  specialty text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Appointments: medical appointment aggregate.
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null,
  physician_id uuid not null,
  scheduled_at timestamptz not null,
  duration_minutes smallint not null,
  reason text not null,
  status public.appointment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_duration_check check (duration_minutes in (15, 30, 45, 60)),
  constraint appointments_reason_nonempty_check check (length(btrim(reason)) > 0),
  constraint appointments_patient_fk foreign key (patient_id) references public.patients (id) on delete restrict,
  constraint appointments_physician_fk foreign key (physician_id) references public.physicians (id) on delete restrict
);

-- Prevent overlapping appointments for the same physician, excluding cancelled
-- appointments from the constraint.
alter table public.appointments
  add constraint appointments_no_overlap_same_physician
  exclude using gist (
    physician_id with =,
    tstzrange(scheduled_at, scheduled_at + make_interval(mins => duration_minutes)) with &&
  )
  where (status <> 'cancelled');

create index appointments_patient_id_idx on public.appointments (patient_id);

-- Server-side updatedAt maintenance on updates.
create or replace function public.set_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row
  execute function public.set_updated_at();

-- Row Level Security: deny by default until authorization operations are enabled.
alter table public.appointments enable row level security;
alter table public.patients enable row level security;
alter table public.physicians enable row level security;

-- Patients: owner-only access.
create policy patients_patient_select on public.patients
  for select to authenticated
  using (user_id = auth.uid());

create policy patients_patient_insert on public.patients
  for insert to authenticated
  with check (user_id = auth.uid());

create policy patients_patient_update on public.patients
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Physicians: owner-only access.
create policy physicians_physician_select on public.physicians
  for select to authenticated
  using (user_id = auth.uid());

-- No direct INSERT/UPDATE for physician profiles by regular authenticated users.
-- Provisioning and changes require a separately authorized administrative workflow.
-- Without such a workflow, new physician profiles cannot be created by clients.

-- Appointments: owner-scoped access (patient or assigned physician).
create policy appointments_patient_select on public.appointments
  for select to authenticated
  using (
    exists (
      select 1
      from public.patients patient
      where patient.id = appointments.patient_id
        and patient.user_id = auth.uid()
    )
  );

create policy appointments_physician_select on public.appointments
  for select to authenticated
  using (
    exists (
      select 1
      from public.physicians physician
      where physician.id = appointments.physician_id
        and physician.user_id = auth.uid()
    )
  );

create policy appointments_patient_insert on public.appointments
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.patients patient
      where patient.id = appointments.patient_id
        and patient.user_id = auth.uid()
    )
    and status = 'pending'
  );

-- No direct UPDATE or DELETE policies for appointments.
-- Rescheduling, confirmation and cancellation must use authorized server-side
-- operations that enforce field permissions and allowed state transitions.
-- Until those operations are implemented, changes of existing appointments
-- are intentionally unavailable to client sessions.

-- End of reviewed initial schema.
