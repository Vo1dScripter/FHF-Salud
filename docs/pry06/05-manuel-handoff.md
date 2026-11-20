# PRY06 · Traspaso del Prompt 5 (Manuel Álvarez Puentes)

RF-12 en capas (navegación, servidor/API y RLS/funciones), pruebas de
autorización negativa y verificación del historial clínico. No se declaran
terminados RF-13 a RF-16.

Los cambios de esta entrega están en la rama `feature/pry06-pruebas-seguridad`
(commits `19dbf60` y `2730dc7`) y en el [PR #7](https://github.com/Vo1dScripter/FHF-Salud/pull/7).
Las cifras de Jest, typecheck, lint y build son ejecuciones locales. La prueba
SQL RF-12 y el CI se verificaron en GitHub Actions.

## Identificadores y estado

| Dato | Valor |
| --- | --- |
| Repositorio oficial | https://github.com/Vo1dScripter/FHF-Salud |
| Fecha de verificación | 2026-11-19 |
| `origin/main` | `474acf0b` (merge del PR #2); `main` local igual; `main...origin/main` = `0 0` |
| Base remota de trabajo | `origin/feature/pry06-historial-clinico` = `36956c95339adfd4b4f3393a7932265e10ebcb96` (head del PR #6) |
| HEAD local inicial de la sesión | `36956c9`, con cambios de trabajo sin confirmar; no se descartó ni reinició nada |
| Sincronización con la base | 0 adelante / 0 atrás tras `git fetch origin --prune` |
| Cómo se actualizó la copia | Solo `git fetch origin --prune`; no hubo pull, merge, reset ni recreación de rama |
| Rama de trabajo | `feature/pry06-pruebas-seguridad` |
| Upstream actual | `origin/feature/pry06-pruebas-seguridad` |
| Commits de esta entrega | `19dbf60` (RF-12 y pruebas) y `2730dc7` (corrección de la prueba SQL) |
| PR del que depende | [#6](https://github.com/Vo1dScripter/FHF-Salud/pull/6), base `feature/pry06-registro-busqueda-pacientes`; ese PR depende del #5, y el #5 integra el #3 y el #4 |
| PR de esta entrega | [#7](https://github.com/Vo1dScripter/FHF-Salud/pull/7), base `feature/pry06-historial-clinico` |
| Revisor de esta entrega | Vo1dScripter (revisión pendiente) |
| PR abiertos comprobados | #3, #4, #5, #6 y #7 abiertos y sin fusionar |
| Acciones protegidas | No ejecutadas; corresponden a Rodrigo/Prompt 6 |

No se usó la computadora, sesión, credenciales, base remota ni despliegue de
Rodrigo. No se aplicaron migraciones ni se modificaron políticas RLS. Todos los
datos de las pruebas son ficticios.

## Alcance RF-12 por capas

### Navegación

- `/pacientes` solo recibe datos del API con rol médico; el enlace «Ver
  expediente» lleva `aria-label` con el nombre del paciente.
- Los estados de error, sesión ausente y acceso denegado no muestran enlaces al
  expediente ni datos de pacientes.
- Una respuesta 200 con forma inválida se trata como error visible, no como
  éxito ni como lista vacía.
- `/citas/[id]` entrega `patientRecordHref` solo cuando el actor de servidor es
  `physician`. `AppointmentDetail` únicamente pinta el enlace si recibe esa
  prop; ocultar el enlace no sustituye la comprobación del servidor.
- Accesibilidad básica: `role="status"`/`aria-live` para carga, `role="alert"`
  para errores, etiquetas de formulario, `caption` en la tabla,
  `aria-label` en enlaces y `aria-busy` en el formulario clínico.

### Servidor y API

- `src/features/clinical-records/access.ts` centraliza la matriz:
  - sin actor → `unauthenticated` (HTTP 401);
  - rol distinto de `physician` → `forbidden` (HTTP 403);
  - médico → permitido, seguido de comprobación de `physicians.active` contra
    la persistencia.
- `requireClinicalPhysician` usa esa matriz; el servicio no lee ni escribe antes
  de autorizar.
- `POST /api/pacientes/[id]/expediente` verifica la sesión **antes** de
  interpretar el cuerpo. Una petición anónima con JSON inválido recibe 401, no
  400.
- Las respuestas conservan `Cache-Control: private, no-store`; los errores no
  incluyen SQL, tablas, credenciales ni datos clínicos/personales.
- La página de servidor traduce 401/403/404 a estados claros con enlace de
  salida y no convierte una caída del servicio en un expediente vacío.

### RLS y funciones

- No se modificaron migraciones ni funciones de Emilio/Jesús. La entrega añade
  `supabase/tests/clinical-records-rf12.sql`, que se ejecuta dentro de una
  transacción y termina en `rollback`.
- Cubre: suplantación por `user_metadata`, recepción/administración/sin rol,
  médico inactivo, cita cancelada sin asociación y anónimo. Espera cero filas o
  error `42501` en las lecturas según el rol, y error `42501` en
  `open_clinical_record`/`save_clinical_revision` cuando no hay autorización.
- La prueba SQL **no se ejecutó en el equipo local** porque no hay Docker,
  Podman ni psql instalados. Se ejecutó en el job `database` del CI de GitHub
  Actions: la primera corrida falló por un error de la propia prueba (ver
  «Correcciones reales») y, tras corregirla en `2730dc7`, pasó.
- Validar RLS/RPC contra el Supabase remoto con usuarios ficticios de cada rol
  queda para Rodrigo.

## Matriz RF → pruebas

Las cifras por grupo provienen de la ejecución Jest completa (26 suites, 200
pruebas). Un mismo archivo puede cubrir más de un RF.

| RF | Evidencia principal | Pruebas |
| --- | --- | --- |
| RF-01–RF-06 (regresión citas) | `AppointmentFlow`, `AppointmentActions`, `AppointmentDetail`, `AppointmentDetailPage`, `Preparation`, `features/appointments/service`, `availability`, `datetime`, `appointment-preview` | 67 PASS |
| RF-07 / RF-10 (pacientes) | `features/patients/contracts`, `repository`, `lib/patients/route`, `lib/patients/server`, `PatientDirectory` | 48 PASS |
| RF-08 (historial autorizado) | `features/clinical-records/service`, `repository`, `lib/clinical-records/route`, `ClinicalHistory`, `ClinicalHistoryPage`, `server` | 68 PASS en suites clínicas (incluye RF-09/RF-11) |
| RF-09 (primera nota) | `service` valida sesión/médico activo; `ClinicalHistory` envía solo contenido clínico; `validation` rechaza campos de autoría | PASS |
| RF-11 (actualización/auditoría) | `ClinicalHistory` conserva 409, exige motivo y recarga; `route` conserva 409; `repository`/`service` cubren revisiones | PASS |
| RF-12 navegación | `AppointmentDetail` (enlace condicionado), `AppointmentDetailPage` (médico vs admin/recepción), `PatientDirectory` (errores sin enlaces) | 14 PASS |
| RF-12 servicio/API | `access` (matriz 401/403/médico), `service` (ausente/rol/inactivo), `route` (401/403/404 sin datos; POST 401 antes del JSON), `ClinicalHistoryPage` (estados de servidor) | PASS |
| RF-12 base de datos | `supabase/tests/clinical-records-rf12.sql` | PASS en CI (job `database`); no ejecutada localmente |

Pruebas nuevas o ampliadas destacadas:

- `src/features/clinical-records/__tests__/access.test.ts` (4).
- `src/__tests__/appointments/AppointmentDetail.test.tsx` (2).
- `src/__tests__/appointments/AppointmentDetailPage.test.tsx` (3).
- `src/__tests__/clinical-records/ClinicalHistoryPage.test.tsx` (6).
- `src/lib/clinical-records/__tests__/route.test.ts` (17; incluye 401/403/404
  sin filtración y orden sesión→JSON).
- `src/__tests__/patients/PatientDirectory.test.tsx` (9; incluye respuesta
  inválida y enlaces ausentes en error).

## Comandos reproducibles

PowerShell, desde `C:\Users\Usuario\Documents\FHF-Salud`:

```powershell
git fetch origin --prune
git switch feature/pry06-pruebas-seguridad
npm.cmd run test -- --runInBand
npm.cmd run typecheck
npm.cmd run lint:strict
$env:NEXT_PUBLIC_SUPABASE_URL=''
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=''
npm.cmd run build
```

Prueba enfocada de RF-12:

```powershell
npm.cmd run test -- --runInBand `
  src/features/clinical-records/__tests__/access.test.ts `
  src/lib/clinical-records/__tests__/route.test.ts `
  src/__tests__/clinical-records/ClinicalHistoryPage.test.tsx `
  src/__tests__/appointments/AppointmentDetail.test.tsx `
  src/__tests__/appointments/AppointmentDetailPage.test.tsx `
  src/__tests__/patients/PatientDirectory.test.tsx
```

Verificación SQL de todas las suites, incluida RF-12 (requiere Docker o Podman):

```powershell
$env:CONTAINER_ENGINE='docker'
python scripts/tar05/verify-database.py
```

## Resultados reales

Runtime local: Windows, Node v26.12.1, npm 11.20.0, Python 3.15.1.

| Comprobación | Resultado |
| --- | --- |
| `npm.cmd run test -- --runInBand` | **PASS**: 26 suites, 200 pruebas, 0 fallos, 0 snapshots |
| Jest enfocado RF-12 (6 archivos de arriba) | **PASS**: 6 suites, 41 pruebas |
| `npm.cmd run typecheck` | **PASS**: salida 0 |
| `npm.cmd run lint:strict` (`--max-warnings=0`) | **PASS**: salida 0 |
| `npm.cmd run build` con variables públicas vacías | **PASS**: compilación, TypeScript, generación estática 9/9 y 15 rutas; `/pacientes/[id]` y `/api/pacientes/[id]/expediente` dinámicas |
| `git diff --check` | **PASS**: sin errores de espacio |
| `supabase/tests/clinical-records-rf12.sql` | **PASS en CI** (job `database`, GitHub Actions). No se ejecutó en el equipo local |
| CI del PR #7 | **PASS**: `verify` y `database` en verde (corrida #22, repetida con Re-run tras una cancelación); Vercel en verde |
| E2E autenticado en Supabase remoto | **No ejecutado**: reservado a Rodrigo |

Historial del CI del PR #7: la corrida #21 (commit `19dbf60`) falló en
`database` por un error de la prueba SQL y `verify` pasó. La corrida #22
(commit `2730dc7`) quedó con `verify` cancelado y se repitió con «Re-run all
jobs»; el resultado final fue éxito en ambos jobs.

Avisos no bloqueantes del build: Next.js detectó un `package-lock.json`
adicional en `C:\Users\Usuario` y Browserslist informa datos de 8 meses. No se
introdujeron errores de lint, tipos ni build.

El build regeneró `public/robots.txt`, `public/sitemap.xml` y
`public/sitemap-0.xml`; se restauraron a `HEAD` para no incluir artefactos
ajenos al alcance. `prettier -c` informa dos archivos ya no formateados en
`HEAD` (`ClinicalHistory.tsx` y `pacientes/[id]/page.tsx`); no es una
verificación del CI y no se reformatearon para evitar ruido.

## Archivos modificados

Código:

- `src/app/api/pacientes/[id]/expediente/route.ts`
- `src/app/citas/[id]/page.tsx`
- `src/app/components/appointments/AppointmentDetail.tsx`
- `src/app/components/clinical-records/ClinicalHistory.tsx`
- `src/app/components/patients/PatientDirectory.tsx`
- `src/app/pacientes/[id]/page.tsx`
- `src/features/clinical-records/access.ts` (nuevo)
- `src/features/clinical-records/index.ts`
- `src/features/clinical-records/service.ts`

Pruebas:

- `src/features/clinical-records/__tests__/access.test.ts` (nuevo)
- `src/__tests__/appointments/AppointmentDetail.test.tsx` (nuevo)
- `src/__tests__/appointments/AppointmentDetailPage.test.tsx` (nuevo)
- `src/__tests__/clinical-records/ClinicalHistoryPage.test.tsx` (nuevo)
- `src/__tests__/patients/PatientDirectory.test.tsx`
- `src/lib/clinical-records/__tests__/route.test.ts`
- `supabase/tests/clinical-records-rf12.sql` (nuevo; corregido en `2730dc7`)

Documentación:

- `docs/pry06/05-manuel-handoff.md` (este archivo)

## Correcciones reales de esta entrega

- El `POST` del expediente interpretaba el JSON antes de verificar la sesión:
  un anónimo con JSON inválido recibía 400. Ahora recibe 401 y el orden quedó
  cubierto por prueba.
- El directorio aceptaba una respuesta 200 con forma inválida como si fuera
  éxito vacío. Ahora muestra un error seguro y no ofrece enlaces clínicos.
- El detalle de cita no tenía navegación al expediente para médicos; ahora la
  recibe solo la sesión médica, con prueba de página para médico frente a
  administración/recepción.
- El enlace del directorio no distinguía el paciente en lectores de pantalla;
  se añadió nombre accesible por paciente.
- El estado «Acceso restringido» del expediente no ofrecía salida; ahora enlaza
  a Citas médicas y se prueba en la página de servidor.
- El formulario clínico no anunciaba el estado ocupado; se añadió `aria-busy`.
- Fallo real de la IA detectado por el CI: la prueba SQL
  `clinical-records-rf12.sql`, generada sin poder ejecutarse localmente,
  insertaba una cita ficticia con `status = 'cancelled'` sin los campos de
  cancelación y violaba `appointments_cancellation_fields_check`. El job
  `database` lo detectó (corrida #21) y se corrigió agregando
  `cancellation_reason` y `cancelled_at` (commit `2730dc7`).

## Evidencias pendientes (no capturadas)

No se fabricaron capturas. Hacen falta:

1. `/pacientes` con sesión médica real de prueba y enlace por paciente.
2. `/pacientes/[id]` autorizado con historial y autoría.
3. Acceso directo sin sesión mostrando «Sesión requerida».
4. Acceso con recepción/administración mostrando «Acceso restringido».
5. Paciente sin asociación/cita vigente mostrando «Expediente no disponible».
6. Pestaña de red con 401/403/404 de la API sin datos clínicos.

Ya disponibles en GitHub Actions: salida del job `database` con
`clinical-records-rf12.sql` en PASS y CI del PR #7 con `verify` y `database` en
verde.

## Riesgos y tareas remotas

- El PR #7 está abierto con CI en verde, pero falta la revisión de
  Vo1dScripter. No debe fusionarse hasta que la revise un integrante distinto de
  Manuel.
- El PR #7 apunta a `feature/pry06-historial-clinico` porque el #6 sigue sin
  fusionar. PR #3, #4 y #5 siguen abiertos; el PR #6 está apilado sobre el #5.
  Reapuntar a `main` y repetir la verificación cuando se fusionen.
- La prueba SQL de RF-12 pasó en CI, pero no contra el Supabase remoto. Rodrigo
  debe aplicar/verificar las migraciones `202611170001` a `202611170004` en el
  entorno autorizado, validar RLS/RPC con usuarios ficticios de cada rol y
  comprobar el despliegue de Vercel. No se usaron datos clínicos reales.
- La política preexistente `patients_select_staff` permite a recepción y
  administración leer datos personales de `patients`; su alcance sigue pendiente
  de decisión y no se modificó aquí.
- El límite de 500 revisiones y la paginación del historial siguen como riesgo
  heredado del Prompt 4.
- En este repositorio algunas corridas de `verify` salen canceladas sin motivo
  aparente (también ocurrió en el PR #6); se resolvieron repitiendo el job.