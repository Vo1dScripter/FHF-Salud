# PRY07 · Integridad de datos y seguridad · Emilio Martínez

Estado: implementación y pruebas locales terminadas. **Commit, push y Pull
Request pendientes de autorización expresa.** No se modificó Supabase remoto,
Vercel ni producción.

## Base de trabajo

| Dato | Valor |
| --- | --- |
| Repositorio | `C:\Users\52746\Documents\Proyectos\FHF-Salud` |
| Rama | `feature/pry07-integridad-seguridad` |
| Rama base acordada | `origin/feature/pry07-base-e2e` |
| Commit base | `ce7e82f35d2275cc731c139b84823820ab0785be` |
| Fecha de la corrida | 26 de noviembre de 2026 (UTC) |
| Responsable | Emilio Martínez Hernández (`Emiliom219000`) |

La rama base ya contenía el módulo de citas (RF-01 a RF-06), las cinco tablas,
las RPC, RLS, el historial y las suites SQL de TAR05. Esta aportación **no
reconstruye** ese módulo: agrega pruebas de integridad, seguridad, persistencia
y concurrencia, y corrige un defecto real de idempotencia.

## Implementación existente inspeccionada

| Elemento | Estado en la rama |
| --- | --- |
| Tablas | `patients`, `physicians`, `appointments`, `appointment_events`, `physician_schedule_blocks` |
| Claves | PK en las cinco tablas; FK `RESTRICT` hacia pacientes, médicos y citas |
| Restricciones | `CHECK` de estado, duración, motivo, cancelación e intervalos; `EXCLUDE` GiST contra traslapes por médico |
| RPC | `confirm_appointment`, `cancel_appointment`, `reschedule_appointment` (`security definer`) |
| RLS | Políticas para `admin`, `receptionist` y `physician`; historial de solo lectura |
| Triggers | Cálculo de `ends_at`, auditoría `appointment_events`, bloqueo de agenda |
| Autorización | `app_metadata.appointment_role` y `appointment_physician_id` desde el JWT |
| Pruebas previas | 4 suites SQL y 2 carreras en `supabase/tests/` y `scripts/tar05/verify-database.py` |
| CI | `.github/workflows/verify.yml` con jobs `verify`, `database` y `e2e` |

No se encontraron tablas de expediente clínico ni de revisiones clínicas en esta
rama. El PR #11, que contiene ese núcleo, sigue abierto; por eso los casos
clínicos se registran como **BLOQUEADOS POR INTEGRACIÓN** y no se simulan.

## Entorno real de ejecución

| Herramienta | Versión / dato |
| --- | --- |
| Docker Engine | 29.9.2 |
| Imagen | `postgres:17-alpine` (`sha256:a77aa70e…e5f7`) |
| PostgreSQL | 17.12 (Alpine, musl) |
| Python | 3.12.5 |
| Contenedor | efímero, `--network none`, nombre `fhf-pry07-emilio-<uuid>` |
| Base | plantilla migrada + una base clonada por suite |
| Autenticación | JWT **simulado** con `request.jwt.claims` y `SET ROLE` |

La migración `202610250001_reminder_infrastructure.sql` se omite porque depende
de `pg_cron`, `pg_net` y Vault del entorno Supabase; no interviene en citas. El
resto de migraciones se aplica en orden y se registra una por una.

**Limitación explícita:** estas suites prueban PostgreSQL, RLS, privilegios y
RPC con claims simulados. No sustituyen una prueba con GoTrue/PostgREST reales;
esa cobertura corresponde al runner E2E local de PRY07 y a una verificación
remota pendiente. No se presenta una como la otra.

## Comandos ejecutados

```powershell
$env:CONTAINER_ENGINE = "docker"
python scripts/pry07/verify-integrity-security.py
```

El runner:

1. arranca un contenedor temporal sin red;
2. aplica `auth-bootstrap.sql` y las migraciones en una base plantilla;
3. clona la plantilla para aislar cada suite;
4. ejecuta las suites SQL y registra cada caso;
5. prueba persistencia con procesos `psql` independientes;
6. lanza carreras con conexiones concurrentes reales;
7. escribe la evidencia y elimina solo su contenedor.

Salida final de la corrida reproducible:

```text
RESUMEN total=114 pass=111 fail=0 blocked=3 not_run=0
```

## Suites nuevas

| Archivo | Módulo | Casos |
| --- | --- | --- |
| `supabase/tests/pry07/01-integridad.sql` | Integridad referencial | 20 |
| `supabase/tests/pry07/02-citas-reglas.sql` | Reglas de citas y auditoría | 22 |
| `supabase/tests/pry07/03-seguridad-rls.sql` | Seguridad, RLS y autorización | 56 |
| `scripts/pry07/verify-integrity-security.py` (persistencia) | Persistencia entre conexiones | 7 |
| `scripts/pry07/verify-integrity-security.py` (concurrencia) | Concurrencia real | 6 |
| Matriz clínica | Expedientes clínicos | 3 bloqueados |

Total: **111 PASS, 0 FAIL, 3 BLOCKED, 0 NOT RUN** (114 casos registrados).

La matriz completa, con acción, resultado esperado, resultado observado, estado,
evidencia y ajuste, está en
[`evidencias/PRY07/02-emilio/resultados.md`](../../evidencias/PRY07/02-emilio/resultados.md).
Los datos brutos y la salida de los comandos están en
[`resultados.json`](../../evidencias/PRY07/02-emilio/resultados.json) y
[`verify-integrity-security.log`](../../evidencias/PRY07/02-emilio/verify-integrity-security.log).

### Precondiciones y datos ficticios por módulo

| Módulo | Precondición | Datos ficticios |
| --- | --- | --- |
| Integridad | Base migrada sin datos | Pacientes `7e…0001`, `7e…0002`; médicos `7e…00a1`, `7e…00a2`; citas y bloqueos de 2035 |
| Citas | Base migrada; claims de `admin` | Once citas ficticias, reprogramación, cancelación y confirmación |
| Seguridad | Fixtures creados como administrador de base | Tres pacientes, tres médicos, cuatro citas, dos bloqueos; cuentas simuladas `admin`, `receptionist`, `physician`, `anon` y sin rol |
| Persistencia | Base migrada; conexiones `psql` separadas | Una cita, una cancelación y una reocupación |
| Concurrencia | Base migrada; cuatro citas y un médico | Cuatro procesos simultáneos como máximo; ninguna fecha real de atención |

## Defecto corregido

### CON-02 · Confirmación simultánea no era idempotente

- **Causa:** `confirm_appointment` comparaba `updated_at` antes de devolver una
  cita ya confirmada. Dos solicitudes concurrentes con la misma versión hacían
  que la segunda, tras esperar el bloqueo, recibiera `PT409` aunque no había
  nada que escribir.
- **Reproducción:** dos procesos `psql` independientes confirman la misma cita
  con el mismo `expected_updated_at`; el runner ejecuta ambos a la vez.
- **Resultado anterior:** `exitos=1 conflictos_PT409=1 eventos=1 estado=confirmed`.
  Evidencia: `resultados-antes-correccion.json` y
  `verify-integrity-security-antes-correccion.log`.
- **Corrección mínima:** migración incremental
  `supabase/migrations/202611250001_confirm_idempotent.sql`, que devuelve la
  cita vigente si ya está confirmada **antes** de comparar la versión. No se
  escribe ninguna fila en ese caso y el control de versión sigue protegiendo la
  transición `pending → confirmed`.
- **Resultado posterior:** `exitos=2 conflictos_PT409=0 eventos=1 estado=confirmed`.

### SEC-52 · Expectativa incorrecta de la propia prueba

La prueba esperaba un bloqueo visible para el médico, pero el fixture crea dos
bloqueos propios (`7e…0202` y `7e…0204`). Se corrigió la expectativa a 2 y se
mantuvo la aserción de que el bloqueo del otro médico (`7e…0201`) no es visible.
No cambió el esquema ni ninguna política; el fallo era de la prueba nueva.

## Pruebas existentes y regresión

| Comando | Resultado |
| --- | --- |
| `python scripts/tar05/verify-database.py` con `CONTAINER_ENGINE=docker` | 6 migraciones PASS, 4 suites SQL PASS, 2 carreras PASS |
| `python scripts/pry07/verify-integrity-security.py` (primera corrida) | 111 PASS, 0 FAIL, 3 BLOCKED |
| Segunda corrida del mismo comando | Idéntico: 111 PASS, 0 FAIL, 3 BLOCKED |
| `npm.cmd run lint:strict` | PASS, 0 errores y 0 warnings |
| `npm.cmd run typecheck` | PASS, sin errores de tipos |
| `npm.cmd test -- --runInBand` | 11 suites, 75 pruebas PASS |
| `python -m unittest discover -s tests -p "test_*.py"` | 8 pruebas de multimedia PASS |
| `npm.cmd run integrations:test` | 4 pruebas de integración PASS |
| `npm.cmd run build` | Build de producción y sitemap PASS |
| `python -m unittest discover -s scripts/pry07` | **NO EJECUTADO en Windows**: `local-e2e.py` importa `fcntl` y exige Linux/macOS/WSL; el job `e2e` de CI lo cubre |
| `npm.cmd run img:test` | **NO EJECUTADO tal cual**: el script invoca `python3`, que no existe en este Windows. Se ejecutó la misma suite con `python -m unittest` (8 PASS) |

El build regeneró `public/sitemap*.xml`, `public/robots.txt` y `src/styles/app.css`
como artefactos; se restauraron para que el diff contenga solo la aportación de
PRY07. No se cambió ningún archivo de aplicación.

## Matriz de integración

| Caso | Estado | Motivo |
| --- | --- | --- |
| `EXP-01` | BLOCKED | PR #11 abierto; sin esquema clínico en la base |
| `EXP-02` | BLOCKED | Sin tablas de revisiones clínicas ni autoría |
| `EXP-03` | BLOCKED | Sin expediente para probar escritura directa |

Estos casos no se ejecutaron y no se simularon. Cuando el PR #11 se integre, la
base de esta rama deberá actualizarse antes de repetirlos.

## Reproducción

```powershell
$env:CONTAINER_ENGINE = "docker"
python scripts/pry07/verify-integrity-security.py
```

El runner no recibe credenciales, no publica puertos y no usa la red. Cada
corrida crea nombres y bases nuevos y elimina su contenedor al final.

Evidencia generada:

```text
evidencias/PRY07/02-emilio/
  resultados.json
  resultados.md
  resultados-antes-correccion.json
  verify-integrity-security.log
  verify-integrity-security-antes-correccion.log
  verificacion-calidad.md
```

## Instrucciones para los siguientes integrantes

1. La migración nueva depende de `202610260003_appointment_actions.sql` y de
   `202611060001_authorization_null_role.sql`. Aplicar en orden; solo reemplaza
   `confirm_appointment` y conserva sus permisos.
2. No ejecutar `auth-bootstrap.sql` contra Supabase: es exclusivo de PostgreSQL
   local.
3. Para pruebas con autenticación real, usar el runner E2E local de PRY07 o una
   base remota autorizada; no reutilizar los claims simulados como evidencia de
   GoTrue.
4. Si se integra el PR #11, añadir los casos clínicos bloqueados con el mismo
   formato de resultados y sin datos médicos reales.
5. La rama destino del PR debe confirmarse antes de publicar; no se asumió
   `main`.

## Archivos de esta aportación

- `supabase/migrations/202611250001_confirm_idempotent.sql` (nuevo)
- `supabase/tests/pry07/01-integridad.sql` (nuevo)
- `supabase/tests/pry07/02-citas-reglas.sql` (nuevo)
- `supabase/tests/pry07/03-seguridad-rls.sql` (nuevo)
- `scripts/pry07/verify-integrity-security.py` (nuevo)
- `.github/workflows/verify.yml` (paso nuevo en el job `database`)
- `docs/pry07/02-integridad-seguridad.md` (este documento)
- `evidencias/PRY07/02-emilio/*` (evidencia de las corridas)
