-- PRY06 RF-07, RF-08 y RF-11: nucleo del expediente clinico (esquema).
-- Migracion incremental: no modifica ni elimina columnas usadas por citas.
-- Las politicas RLS y las funciones van en migraciones posteriores.
-- Todos los datos de ejemplo del proyecto deben ser ficticios.

-- 1. Datos personales adicionales (opcionales para no romper pacientes existentes).
alter table public.patients
  add column birth_date date,
  add column sex text,
  add column phone text,
  add column updated_at timestamptz not null default now();

alter table public.patients
  add constraint patients_birth_date_check
    check (birth_date is null or birth_date >= date '1900-01-01'),
  add constraint patients_sex_check
    check (sex is null or sex in ('female', 'male', 'other', 'unspecified')),
  add constraint patients_phone_check
    check (phone is null or char_length(btrim(phone)) between 7 and 20);

create or replace function public.clinical_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger patients_touch_updated_at
before update on public.patients
for each row execute function public.clinical_touch_updated_at();

-- 2. Asociacion medico-paciente (decision explicita, sin lectura global).
create table public.patient_physicians (
  patient_id uuid not null,
  physician_id uuid not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  constraint patient_physicians_pkey primary key (patient_id, physician_id),
  constraint patient_physicians_patient_id_fkey
    foreign key (patient_id) references public.patients (id)
    on update restrict on delete restrict,
  constraint patient_physicians_physician_id_fkey
    foreign key (physician_id) references public.physicians (id)
    on update restrict on delete restrict
);

create index patient_physicians_physician_idx
  on public.patient_physicians (physician_id, patient_id);

-- 3. Expediente unico por paciente.
create table public.clinical_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null,
  current_revision integer not null default 0,
  created_by_physician_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_records_patient_id_key unique (patient_id),
  constraint clinical_records_patient_id_fkey
    foreign key (patient_id) references public.patients (id)
    on update restrict on delete restrict,
  constraint clinical_records_physician_id_fkey
    foreign key (created_by_physician_id) references public.physicians (id)
    on update restrict on delete restrict,
  constraint clinical_records_current_revision_check
    check (current_revision >= 0)
);

create trigger clinical_records_touch_updated_at
before update on public.clinical_records
for each row execute function public.clinical_touch_updated_at();

-- 4. Revisiones inmutables (RF-08 lectura, RF-09 alta, RF-11 edicion).
-- allergies_status distingue "sin informacion" de "niega alergias".
create table public.clinical_record_revisions (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null,
  revision_number integer not null,
  background text,
  allergies_status text not null default 'not_recorded',
  allergies text,
  diagnosis text,
  treatment text,
  change_reason text,
  author_user_id uuid not null,
  author_physician_id uuid not null,
  created_at timestamptz not null default now(),
  constraint clinical_record_revisions_number_key
    unique (record_id, revision_number),
  constraint clinical_record_revisions_record_id_fkey
    foreign key (record_id) references public.clinical_records (id)
    on update restrict on delete restrict,
  constraint clinical_record_revisions_physician_id_fkey
    foreign key (author_physician_id) references public.physicians (id)
    on update restrict on delete restrict,
  constraint clinical_record_revisions_number_check
    check (revision_number >= 1),
  constraint clinical_record_revisions_status_check
    check (allergies_status in ('not_recorded', 'none_reported', 'reported')),
  constraint clinical_record_revisions_allergies_check
    check (
      (allergies_status = 'reported'
        and char_length(btrim(coalesce(allergies, ''))) between 1 and 4000)
      or (allergies_status <> 'reported' and allergies is null)
    ),
  constraint clinical_record_revisions_text_check
    check (
      char_length(coalesce(background, '')) <= 4000
      and char_length(coalesce(diagnosis, '')) <= 4000
      and char_length(coalesce(treatment, '')) <= 4000
    ),
  constraint clinical_record_revisions_reason_check
    check (
      revision_number = 1
      or char_length(btrim(coalesce(change_reason, ''))) between 1 and 500
    )
);

create or replace function public.clinical_revisions_immutable()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'Las revisiones clinicas no se pueden modificar ni eliminar.'
    using errcode = '42501';
end;
$$;

create trigger clinical_record_revisions_immutable
before update or delete on public.clinical_record_revisions
for each row execute function public.clinical_revisions_immutable();

-- 5. Seguro por defecto: RLS activo y sin privilegios hasta definir politicas.
alter table public.patient_physicians enable row level security;
alter table public.clinical_records enable row level security;
alter table public.clinical_record_revisions enable row level security;

revoke all on public.patient_physicians from anon, authenticated;
revoke all on public.clinical_records from anon, authenticated;
revoke all on public.clinical_record_revisions from anon, authenticated;

comment on table public.clinical_records is
  'Expediente clinico unico por paciente. Acceso solo mediante funciones.';
comment on table public.clinical_record_revisions is
  'Revisiones inmutables del expediente: antecedentes, alergias, diagnostico y tratamiento (texto, no RF-13 a RF-16).';