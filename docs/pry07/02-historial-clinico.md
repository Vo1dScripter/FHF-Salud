# PRY07 · E2E del expediente clínico y sus permisos

## Alcance y base real

Este trabajo parte de `feature/pry07-base-e2e` y del PRY06 aún **no fusionado**:

| Referencia                                           | Estado comprobado                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `origin/main` (`474acf0`)                            | No contiene rutas ni migraciones clínicas.                                                                               |
| PR #11 `feature/pry06-integracion-final` (`c77e36e`) | Abierto, sin fusión. Aporta pacientes, expediente, RLS y RPC clínicas.                                                   |
| PR #12 `feature/pry07-base-e2e`                      | Abierto, sin fusión. Base E2E de citas.                                                                                  |
| PR #15 `feature/pry07-e2e-historial-clinico`         | Abierto hacia `feature/pry07-base-e2e`. Depende de #11. Revisión solicitada a `Maquendo2512`; sin aprobación registrada. |

Por tanto, **no se declara que RF-07 a RF-12 estén en `main`**. El E2E clínico se
ejecuta sobre una rama apilada que contiene #11 y no sustituye la revisión de ese
PR. No se alteraron políticas remotas, Supabase ni producción.

## Qué permite hacer el sistema (descubierto en código y SQL)

- `/pacientes` lista y busca solo pacientes asociados al médico de la sesión.
- `/pacientes/[id]` abre el expediente con datos personales mínimos, citas
  visibles, revisión vigente e historial inmutable.
- El alta clínica (`POST /api/pacientes/[id]/expediente`) crea una **revisión
  nueva**; no sobrescribe. Cada revisión guarda autor, médico, fecha del servidor
  y motivo de cambio.
- El acceso exige sesión verificada y rol `physician` en `app_metadata`; el
  médico debe estar activo y tener asociación (`patient_physicians`) o una cita
  vigente. Recepción, administración, cuenta sin rol y médico sin vínculo quedan
  fuera.
- La concurrencia se controla con `expectedRevision`: una escritura obsoleta
  recibe 409 y no se persiste.
- Las escrituras solo ocurren por RPC `SECURITY DEFINER`; `authenticated` no
  tiene `INSERT`/`UPDATE`/`DELETE` directo y las revisiones son inmutables por
  trigger. La interfaz nunca inventa éxito si la API falla.

No se implementaron módulos nuevos de diagnósticos, tratamientos o recetas: se
usan los campos de texto que ya existen en la revisión clínica.

## Cobertura por requisito

| RF                                              | Estado funcional    | Verificación ejecutada                                                                                                                                       |
| ----------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RF-07 alta de paciente y apertura de expediente | Implementado en #11 | SQL `register_patient` y `open_clinical_record`; Jest de pacientes. El alta por formulario no forma parte del recorrido E2E clínico.                         |
| RF-08 lectura del historial                     | Implementado        | E2E 1440/390: apertura, recarga y persistencia.                                                                                                              |
| RF-09 registro de la primera nota               | Implementado        | E2E 1440/390: 201, autoría y fecha del servidor.                                                                                                             |
| RF-10 búsqueda de pacientes                     | Implementado        | E2E: el médico localiza por nombre y abre el expediente correcto.                                                                                            |
| RF-11 nueva revisión sin sobrescribir           | Implementado        | E2E 1440/390: revisión 2 conserva la 1, conflicto 409, recarga y revisión 4.                                                                                 |
| RF-12 permisos y negativos                      | Implementado        | E2E: 401 anónimo, 403 recepción, 404/403 médico sin vínculo, 403 sin rol, 404 inexistente, 400 inválido/suplantación, 401 sesión vencida; suite SQL RLS/RPC. |

## Defectos corregidos

1. **El E2E clínico abortaba antes de generar evidencia.** El fixture insertaba
   una cita `cancelled` sin `cancelled_at` ni `cancellation_reason`, y
   `appointments_cancellation_fields_check` lo rechaza. Con
   `ON_ERROR_STOP=1` se abortaba toda la preparación; por eso la corrida de CI
   `45923084389` falló sin artefactos. Se corrigió el fixture con
   `cancelled_appointment_sql(...)`, se añadió una prueba de regresión en
   `scripts/pry07/test_local_e2e.py` y una comprobación del servidor en
   `verify_clinical`.
2. **Aserción SQLSTATE no portable.** `supabase/tests/clinical-records.sql`
   esperaba `23503` al borrar un paciente con expediente; PostgreSQL 18 devuelve
   `23001` (`RESTRICT`) y PostgreSQL 17 devuelve `23503`. La prueba ahora acepta
   ambos y sigue exigiendo que el borrado se rechace.
3. **Fallo de CI sin diagnóstico legible.** El job `e2e` ahora publica el resumen
   PASS/FAIL en anotaciones del check, accesibles sin permisos de administrador.

## Ejecución real

### CI (Linux, Docker, Chromium)

Run <https://github.com/Vo1dScripter/FHF-Salud/actions/runs/45925241586>, commit
`5463638`:

- `verify` (lint estricto, tipos, 206 Jest, 8 multimedia, 4 integraciones, build): **success**.
- `database` (PostgreSQL 17, migraciones y suites SQL): **success**.
- `e2e` (Auth + PostgreSQL + PostgREST y Chromium): **success**.
  - 8 casos de citas, 12 casos clínicos (6 por viewport 1440/390) y 7 negativos de RF-12.
  - `SQL: PASS` para expedientes, cuatro revisiones inmutables, autoría, fechas,
    vínculos y ausencia de escrituras denegadas.
  - `CLEANUP: PASS` de aplicación, contenedores, red y credenciales efímeras.

### Local (Windows, sin motor de contenedores)

- `npm run verify`: lint, tipos, **206/206 Jest**, **8/8 multimedia**, **4/4
  integraciones** y build: PASS.
- `python -m unittest discover -s scripts/pry07`: **8/8** PASS (se usó un stub
  temporal de `fcntl` solo para importar el runner en Windows; en CI se ejecuta
  sin stub).
- Cuatro suites SQL clínicas sobre PostgreSQL 18.6 aislado: **4/4 PASS**.

El E2E de navegador **no se ejecutó en esta computadora**: no hay Docker,
Podman ni WSL disponibles. Se ejecutó en CI, que es el entorno reproducible del
proyecto. Las capturas y JSON de esa corrida quedaron en el artefacto
`pry07-e2e` (id `15166291583`); su descarga exige autenticación, por lo que aquí
se conserva el resumen público de la anotación.

## Evidencia

`evidencias/PRY07/01-jesus/`:

- `e2e-ci-annotation.txt`: resumen PASS de la corrida real.
- `e2e-ci-run.json`: commit, job, artefacto y URL.
- `verify-local.log`: salida de `npm run verify`.
- `clinical-sql-local.log`: suites SQL sobre PostgreSQL 18.
- `harness-tests-local.log`: pruebas del runner.
- `README.md`: procedencia, comandos y hashes.

## Pendientes y límites

- **Bloqueo de integración:** #15 no debe fusionarse antes de #11. Si #11 cambia,
  repetir el E2E clínico.
- No se probó contra Supabase/Vercel ni producción; no se modificaron políticas
  remotas.
- No hay aprobación de otro integrante registrada en #15.
- La asociación paciente–expediente está verificada en servidor/BD, no solo en
  la interfaz.
