# PRY06 · Traspaso del Prompt 2 (Emilio Martínez Hernández)

Esquema, seguridad y persistencia del expediente clínico (RF-07 a RF-12).
Solo hay SQL, pruebas y documentación: no hay cambios de interfaz ni de TypeScript.

## Base verificada

| Dato | Valor |
| --- | --- |
| Hash remoto de la base (`origin/main`) | `474acf0` |
| Hash local inicial de `main` | `c2a2e5d` (atrasada, NO sincronizada al inicio) |
| Cómo se actualizó | `git switch main` y `git pull --ff-only origin main` |
| Estado tras actualizar | `main...origin/main`, sin diferencias |
| Último PR requerido | #2 (fusionado). El #3 de Rodrigo (Prompt 1) seguía abierto al iniciar el trabajo |
| Bloqueo | PR #3 pendiente de revisión (Maquendo2512) y de merge al iniciar el trabajo |
| Rama de trabajo | `feature/pry06-esquema-expedientes` (creada el 17/11/2026 desde `main` en `474acf0`, sin esperar el merge del #3; el trabajo es solo SQL y no depende de su código) |
| Hash de commit | `3c1af77` (primer commit; los posteriores están en el PR) |
| URL del PR | https://github.com/Vo1dScripter/FHF-Salud/pull/4 |
| Revisor asignado | @Vo1dScripter |

No existían `clinical_records` ni otras tablas clínicas (verificado con `grep` en las migraciones).

## Migraciones (incrementales; no se editó ninguna existente)

1. `202611170001_clinical_records_core.sql`: columnas opcionales en `patients`
   (`birth_date`, `sex`, `phone`, `updated_at`), `patient_physicians`,
   `clinical_records` (UNIQUE `patient_id`), `clinical_record_revisions`
   (inmutables por trigger). RLS activo y sin privilegios iniciales.
2. `202611170002_clinical_records_security.sql`: `clinical_actor_physician()`,
   políticas de lectura y las funciones `register_patient` y `save_clinical_revision`.
3. `202611170003_open_existing_patient_record.sql`: `open_clinical_record`,
   para pacientes creados por el módulo de citas.
4. `202611170004_open_record_ignore_cancelled.sql`: una cita cancelada no concede
   por sí sola una nueva asociación con el paciente. `open_clinical_record`
   exige una cita con `status <> 'cancelled'` cuando no existe una asociación previa.
   Regresión en `supabase/tests/clinical-records-cancelled.sql`.

## Contrato para Yaird (RF-07 y RF-10) y Jesús (RF-08, RF-09 y RF-11)

Todo se invoca con la sesión SSR del médico (RPC). Nunca service_role en frontend.

| Función | Uso | Devuelve |
| --- | --- | --- |
| `register_patient(p_display_name, p_birth_date, p_sex, p_phone)` | RF-07 | `new_patient_id`, `new_record_id` |
| `open_clinical_record(p_patient_id)` | Paciente existente con asociación autorizada o cita no cancelada | `out_patient_id`, `out_record_id`, `was_created` |
| `save_clinical_revision(p_patient_id, p_expected_revision, p_background, p_allergies_status, p_allergies, p_diagnosis, p_treatment, p_change_reason)` | RF-09 y RF-11 | Fila de `clinical_record_revisions` |

Lectura (RF-08 y RF-10): `select` sobre `patients`, `clinical_records`,
`clinical_record_revisions` y `patient_physicians`. RLS limita el acceso
clínico al médico asociado, considerando los permisos preexistentes de `patients`.

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
  `physicians` y asociación autorizada puede acceder a los expedientes y revisiones
  clínicas mediante las políticas del módulo.
- Recepción y administración no tienen acceso a las tablas de expedientes y revisiones
  clínicas mediante las políticas implementadas.
- Se conserva la política preexistente `patients_select_staff`, que permite consultar
  datos personales de los pacientes. Su alcance está pendiente de revisión.
- Sin INSERT, UPDATE ni DELETE directos para `authenticated` sobre las tablas
  clínicas nuevas; las escrituras se realizan mediante las funciones autorizadas.
- Las funciones `SECURITY DEFINER` fijan `search_path = public, pg_temp`, validan
  `auth.uid()` y rol, revocan EXECUTE a `public` y `anon`, y lo conceden solo a `authenticated`.
- Las revisiones son inmutables: cada cambio agrega una revisión y conserva autoría y fecha.

## Fixtures de desarrollo

Archivo: `supabase/fixtures/clinical-dev-fixtures.sql`

Contiene únicamente datos ficticios para realizar pruebas locales:

- 3 médicos.
- 3 pacientes.
- 1 asociación médico-paciente.
- 1 expediente clínico.
- 1 cita médica.

Los fixtures son idempotentes. Su ejecución repetida no genera registros
duplicados en el escenario probado.

No deben ejecutarse en producción ni mezclarse con información de pacientes reales.

## Rollback y protección de datos

Archivo:
`supabase/rollback/202611170001-0004-clinical-records-rollback.sql`

El rollback permite revertir las cuatro migraciones clínicas en una base
de desarrollo que tenga el esquema clínico completo y no contenga información protegida.

Se incorporó un mecanismo de protección que bloquea las tablas correspondientes
durante la operación y verifica la existencia de:

- Revisiones clínicas.
- Expedientes clínicos.
- Asociaciones entre médicos y pacientes.
- Pacientes con datos personales en las columnas nuevas.

Si existe información en cualquiera de estos elementos, el rollback
interrumpe la transacción antes de eliminar las tablas o columnas.

Cuando no existen datos protegidos, el rollback permite eliminar las
estructuras clínicas nuevas y conservar las tablas originales:

- `appointment_events`
- `appointments`
- `patients`
- `physician_schedule_blocks`
- `physicians`

El rollback es exclusivamente para desarrollo local. No debe ejecutarse
en Supabase remoto ni en producción.

## Pruebas ejecutadas (2026-11-17, PostgreSQL 17 local en Docker)

Comando: `CONTAINER_ENGINE=docker python scripts/tar05/verify-database.py`

Log completo: `docs/pry06/02-emilio-db-test.log`

- PASS: nueve migraciones (las cinco previas y las cuatro nuevas).
- PASS: seis archivos de prueba: `appointment-actions.sql`, `appointments.sql`,
  `clinical-records-cancelled.sql`, `clinical-records.sql`, `null-role.sql` y
  `tar05-integrity.sql`.
- PASS: `clinical-records-cancelled.sql` confirma que una cita cancelada no permite
  abrir el expediente cuando no existe una asociación autorizada previa
  (SQLSTATE `42501`).
- PASS: `clinical-records.sql` cubre integridad, atomicidad del alta, revisiones y
  auditoría, aislamiento entre médicos, pacientes preexistentes, roles no
  autorizados y `anon`.
- PASS: las pruebas de citas y de concurrencia siguen pasando. PASS FINAL.

### Verificación adicional de fixtures y rollback

Se utilizaron dos contenedores Docker independientes con PostgreSQL 17:

- `fhf-pry06-fixtures-test`
- `fhf-pry06-rollback-test`

En el primer contenedor se aplicaron las migraciones y los fixtures.
En el segundo se aplicaron las migraciones sin insertar los fixtures.

| Prueba | Resultado |
| --- | --- |
| Inserción de datos ficticios | PASS |
| Idempotencia de los fixtures | PASS |
| Protección del rollback ante datos existentes | PASS |
| Conservación de las cantidades de registros | PASS |
| Reversión del esquema clínico sin datos protegidos | PASS |
| Conservación de las cinco tablas originales | PASS |
| `appointments.sql` después del rollback | PASS |
| `appointment-actions.sql` después del rollback | PASS |
| `null-role.sql` después del rollback | PASS |
| `tar05-integrity.sql` después del rollback | PASS |

La prueba de idempotencia produjo cinco operaciones `INSERT 0 0`,
confirmando que no se insertaron registros adicionales.

La prueba del rollback protegido produjo el siguiente mensaje esperado:

    ERROR: Rollback detenido: 0 revisiones, 1 expedientes, 1 asociaciones y 2 pacientes con datos personales.

Después del intento de rollback se verificó que las cantidades de registros
permanecieron sin cambios.

| Tabla | Antes | Después |
| --- | --- | --- |
| `physicians` | 3 | 3 |
| `patients` | 3 | 3 |
| `patient_physicians` | 1 | 1 |
| `clinical_records` | 1 | 1 |
| `appointments` | 1 | 1 |

En el segundo contenedor se comprobó que el rollback eliminó las tres
tablas clínicas y conservó las cinco tablas originales del sistema.

Las cuatro pruebas originales del módulo de citas se ejecutaron
satisfactoriamente después de la reversión.

Evidencia adicional:
`docs/pry06/02-emilio-fixtures-rollback-test.log`

Todas las pruebas fueron realizadas en un entorno local y con datos ficticios.
Supabase remoto NO verificado ni modificado.

## Auditoría y correcciones

Se realizó una auditoría del módulo mediante OpenCode, con el objetivo de
identificar posibles problemas de seguridad, integridad y persistencia.

Correcciones realizadas:

- Se agregó una cuarta migración para impedir que una cita cancelada
  conceda por sí sola una nueva asociación con el paciente.
- Se agregó una prueba de regresión para citas canceladas.
- Se reforzó el rollback para evitar la eliminación de expedientes,
  revisiones, asociaciones y datos personales existentes.
- Se comprobó la idempotencia de los fixtures.
- Se verificó el funcionamiento del módulo original de citas después del rollback.
- Se documentaron los resultados mediante archivos de evidencia.

La auditoría constituye una revisión técnica complementaria y no sustituye
la aprobación del Pull Request por parte del revisor asignado.

## Pendientes y decisiones para el equipo

- La política existente `patients_select_staff` deja a administración y recepción leer
  todas las columnas de `patients`, incluidas las nuevas (`phone`, `birth_date`, `sex`).
  Decidir si se restringe con una migración posterior. No se modificó para no afectar Citas.
- Definir si la asociación médico-paciente debe mantenerse o revocarse cuando
  se cancela una cita después de haber establecido la asociación.
- Revisar si las citas futuras deben conceder acceso al expediente antes de
  que ocurra la consulta.
- Revisar la detección de pacientes duplicados, incluyendo concurrencia,
  homónimos y posible exposición de la existencia de pacientes.
- Revisar la conveniencia de establecer referencias a usuarios de autenticación
  en los campos de auditoría.
- Hay que ampliar `PatientRepository` y `createPatientSchema`
  (hoy solo conocen cuatro columnas).
- RF-13 a RF-16 no están implementados.
- Confirmar el estado del PR #3 y obtener la revisión del PR #4.
- Verificar la integración con los módulos de los demás integrantes.
- La aplicación y verificación en Supabase remoto corresponde a Rodrigo
  durante la etapa de integración.