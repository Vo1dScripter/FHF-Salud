# PRY06 · Traspaso del Prompt 2 (Emilio Martínez Hernández)

Esquema, seguridad y persistencia del expediente clínico (RF-07 a RF-12).
Solo hay SQL y pruebas: no hay cambios de interfaz ni de TypeScript.

## Base verificada

| Dato | Valor |
| --- | --- |
| Hash remoto de la base (`origin/main`) | `474acf0` |
| Hash local inicial de `main` | `c2a2e5d` (atrasada, NO sincronizada al inicio) |
| Cómo se actualizó | `git switch main` y `git pull --ff-only origin main` |
| Estado tras actualizar | `main...origin/main`, sin diferencias |
| Último PR requerido | #2 (fusionado). El #3 de Rodrigo (Prompt 1) sigue **abierto** |
| Bloqueo | PR #3 pendiente de revisión (Maquendo2512) y de merge |
| Rama de trabajo | `feature/pry06-esquema-expedientes` (creada el 17/11/2026 desde `main` en `474acf0`, sin esperar el merge del #3; el trabajo es solo SQL y no depende de su código) |
| Hash de commit | PENDIENTE |
| URL del PR | PENDIENTE |
| Revisor asignado | PENDIENTE |

No existían `clinical_records` ni otras tablas clínicas (verificado con `grep` en las migraciones).

## Migraciones (incrementales; no se editó ninguna existente)

1. `202611170001_clinical_records_core.sql`: columnas opcionales en `patients`
   (`birth_date`, `sex`, `phone`, `updated_at`), `patient_physicians`,
   `clinical_records` (UNIQUE `patient_id`), `clinical_record_revisions`
   (inmutables por trigger). RLS activo y sin privilegios.
2. `202611170002_clinical_records_security.sql`: `clinical_actor_physician()`,
   políticas de lectura y las funciones `register_patient` y `save_clinical_revision`.
3. `202611170003_open_existing_patient_record.sql`: `open_clinical_record`,
   para pacientes creados por el módulo de citas.

## Contrato para Yaird (RF-07 y RF-10) y Jesús (RF-08, RF-09 y RF-11)

Todo se invoca con la sesión SSR del médico (RPC). Nunca service_role en frontend.

| Función | Uso | Devuelve |
| --- | --- | --- |
| `register_patient(p_display_name, p_birth_date, p_sex, p_phone)` | RF-07 | `new_patient_id`, `new_record_id` |
| `open_clinical_record(p_patient_id)` | paciente existente con cita | `out_patient_id`, `out_record_id`, `was_created` |
| `save_clinical_revision(p_patient_id, p_expected_revision, p_background, p_allergies_status, p_allergies, p_diagnosis, p_treatment, p_change_reason)` | RF-09 y RF-11 | fila de `clinical_record_revisions` |

Lectura (RF-08 y RF-10): `select` sobre `patients`, `clinical_records`,
`clinical_record_revisions` y `patient_physicians`. RLS limita al médico asociado.

- `sex`: `female`, `male`, `other` o `unspecified`.
- `allergies_status`: `not_recorded` (sin información), `none_reported` (niega alergias)
  o `reported` (exige texto en `allergies`). No son equivalentes.
- Textos de máximo 4000 caracteres. `change_reason` es obligatorio desde la revisión 2.
- `p_expected_revision`: 0 para la primera revisión; después, `clinical_records.current_revision`.
- Diagnóstico y tratamiento son texto de la nota. No equivalen a RF-13 a RF-16.
- Autor, médico y fecha salen del servidor (`auth.uid()`, JWT, `now()`); no se aceptan del cliente.

| SQLSTATE | Código | Significado |
| --- | --- | --- |
| `42501` | 403 | Sin sesión, rol no médico, médico inactivo o sin acceso al paciente |
| `PT400` | 400 | Datos inválidos |
| `PT404` | 404 | Paciente o expediente inexistente |
| `PT409` | 409 | Duplicado (nombre + fecha de nacimiento) o versión obsoleta |

## Seguridad

- Solo el rol `physician` (de `app_metadata` del JWT firmado) con fila activa en
  `physicians` accede a información clínica. Recepción y administración no.
- Sin INSERT, UPDATE ni DELETE directos para `authenticated`; solo mediante las funciones.
- Las funciones `SECURITY DEFINER` fijan `search_path = public, pg_temp`, validan
  `auth.uid()` y rol, revocan EXECUTE a `public` y `anon`, y lo conceden solo a `authenticated`.
- Las revisiones son inmutables: cada cambio agrega una revisión y conserva autoría y fecha.

## Pendientes y decisiones para el equipo

- La política existente `patients_select_staff` deja a administración y recepción leer
  todas las columnas de `patients`, incluidas las nuevas (`phone`, `birth_date`, `sex`).
  Decidir si se restringe con una migración posterior. No se modificó para no afectar Citas.
- Hay que ampliar `PatientRepository` y `createPatientSchema` (hoy solo conocen cuatro columnas).
- RF-13 a RF-16 no están implementados.

## Pruebas ejecutadas (2026-11-17, PostgreSQL 17 local en Docker)

Comando: `CONTAINER_ENGINE=docker python scripts/tar05/verify-database.py`
Log completo: `docs/pry06/02-emilio-db-test.log`

- PASS: ocho migraciones (las cinco previas y las tres nuevas).
- PASS: cinco archivos de prueba, incluido `supabase/tests/clinical-records.sql`
  (integridad, atomicidad del alta, revisiones y auditoría, aislamiento entre médicos,
  pacientes preexistentes, roles no autorizados y `anon`).
- PASS: las pruebas de citas siguen pasando. PASS FINAL.

No ejecutado: `supabase/fixtures/clinical-dev-fixtures.sql` ni
`supabase/rollback/202611170001-0003-clinical-records-rollback.sql`
(solo escritos, sin probar). Supabase remoto NO verificado.

## Comandos exclusivos para Rodrigo (Prompt 6)

1. Respaldo de la base remota y revisión del historial de migraciones.
2. Aplicar en orden `202611170001`, `202611170002` y `202611170003`, solo tras
   el merge del PR. Nunca aplicar el rollback ni los fixtures en remoto.
3. Verificar (sin credenciales ni datos reales):

```sql
select tablename, rowsecurity from pg_tables
 where tablename in ('patient_physicians','clinical_records','clinical_record_revisions');
select tablename, policyname from pg_policies
 where tablename like 'clinical%' or tablename = 'patient_physicians';
select proname, prosecdef from pg_proc
 where proname in ('register_patient','save_clinical_revision','open_clinical_record');
```

4. Aprovisionar usuarios ficticios con `app_metadata`
   (`appointment_role` y `physician_id`) y hacer el E2E.
