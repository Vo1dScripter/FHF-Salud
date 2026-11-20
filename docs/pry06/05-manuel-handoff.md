# PRY06 · Traspaso del Prompt 5 (Manuel Álvarez Puentes)

RF-12 en capas (navegación, servidor/API y RLS/funciones), pruebas de
autorización negativa y verificación local del historial clínico. No se
declaran terminados RF-13 a RF-16.

Los cambios de esta entrega quedan **sin commit, sin push y sin PR** porque así
se indicó para esta sesión. Por tanto no existe todavía CI ni revisión de este
conjunto de cambios; las cifras de abajo son ejecuciones locales reales.

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
| Upstream actual | `origin/feature/pry06-historial-clinico`; la rama propia aún no existe en el remoto |
| PR del que depende | [#6](https://github.com/Vo1dScripter/FHF-Salud/pull/6), base `feature/pry06-registro-busqueda-pacientes`; ese PR depende del #5, y el #5 integra el #3 y el #4 |
| PR de esta entrega | No creado: sin commit ni push por instrucción |
| Revisor de esta entrega | No asignado (no hay PR nuevo) |
| PR abiertos comprobados | #3, #4, #5 y #6 abiertos y sin fusionar (consulta GitHub API del 2026-11-19) |
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
- La prueba SQL **no se ejecutó en este equipo** porque no hay Docker, Podman ni
  psql instalados. Queda para CI o para el entorno autorizado de Rodrigo.

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
| RF-12 base de datos | `supabase/tests/clinical-records-rf12.sql` | No ejecutada localmente; pendiente CI/Rodrigo |

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
| `supabase/tests/clinical-records-rf12.sql` | **No ejecutada**: sin Docker/Podman/psql en este equipo |
| CI de este changeset | **No ejecutado**: no hay commit ni push |
| E2E autenticado en Supabase remoto | **No ejecutado**: reservado a Rodrigo |

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
- `supabase/tests/clinical-records-rf12.sql` (nuevo)

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

## Evidencias pendientes (no capturadas)

No se fabricaron capturas. Tras commit y PR harían falta:

1. `/pacientes` con sesión médica real de prueba y enlace por paciente.
2. `/pacientes/[id]` autorizado con historial y autoría.
3. Acceso directo sin sesión mostrando «Sesión requerida».
4. Acceso con recepción/administración mostrando «Acceso restringido».
5. Paciente sin asociación/cita vigente mostrando «Expediente no disponible».
6. Pestaña de red con 401/403/404 de la API sin datos clínicos.
7. Salida del job `database` con `clinical-records-rf12.sql` en PASS.
8. CI del commit final con jobs `verify` y `database` en verde.

## Riesgos y tareas remotas

- Este changeset no está confirmado ni publicado: no hay CI, PR ni revisor
  todavía. Al autorizar commit/push, abrir PR hacia
  `feature/pry06-historial-clinico` mientras el #6 siga sin fusionar (o `main`
  si los PR previos ya se fusionaron) y pedir revisión a un integrante distinto
  de Manuel.
- PR #3, #4 y #5 siguen abiertos; el PR #6 está apilado sobre el #5. Reapuntar y
  repetir la verificación cuando se fusionen.
- La prueba SQL de RF-12 no se ejecutó localmente. Rodrigo/Prompt 6 debe
  ejecutarla en un PostgreSQL aislado o esperar el job `database` del CI.
- Rodrigo debe aplicar/verificar las migraciones `202611170001` a
  `202611170004` en el entorno autorizado, validar RLS/RPC con usuarios
  ficticios de cada rol y comprobar el despliegue de Vercel. No se usaron datos
  clínicos reales.
- La política preexistente `patients_select_staff` permite a recepción y
  administración leer datos personales de `patients`; su alcance sigue pendiente
  de decisión y no se modificó aquí.
- El límite de 500 revisiones y la paginación del historial siguen como riesgo
  heredado del Prompt 4.
