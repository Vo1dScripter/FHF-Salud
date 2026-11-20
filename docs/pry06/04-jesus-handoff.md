# PRY06 · Traspaso del Prompt 4 (Jesús Fuentes Avendaño)

Historial clínico autorizado, registro de la primera nota y actualización
controlada con auditoría (RF-08, RF-09 y RF-11). No se declaran terminados
RF-13 a RF-16.

## Identificadores y estado

| Dato | Valor |
| --- | --- |
| Repositorio oficial | https://github.com/Vo1dScripter/FHF-Salud |
| `origin/main` verificado | `474acf0bff4be32c094f711227f725dda83a106d` |
| `main` local inicial | `474acf0bff4be32c094f711227f725dda83a106d`; `main...origin/main` = `0 0` |
| Base usada | `feature/pry06-registro-busqueda-pacientes` en `f3f74f0475f2983115071e4c4596fe7563caf9ca` |
| Motivo de la base | `main` todavía no contiene el trabajo PRY06. Esa rama es el head del PR #5 y ya integra el PR #3 (pacientes) y el PR #4 (esquema clínico) |
| PR previos al iniciar | #3, #4 y #5 abiertos y sin fusionar |
| Rama de trabajo | `feature/pry06-historial-clinico` |
| Commit de código | `3cef600161e7a355b4a575c9cc00db4b0af92638` |
| Commit de evidencia | `47ac7137bd3589068bcb3bdbf8414b2648c3317e`; la actualización final se consulta con `git log -1` |
| PR | [#6](https://github.com/Vo1dScripter/FHF-Salud/pull/6), base `feature/pry06-registro-busqueda-pacientes`, head `feature/pry06-historial-clinico` |
| Revisor solicitado | `Maquendo2512` (Manuel), confirmado por GitHub; integrante distinto de Jesús |
| Bloqueo | PR #3, #4 y #5 sin fusionar. Este PR es apilado sobre el #5; reapuntar a `main` cuando el #5 se fusione |
| Acciones protegidas | No ejecutadas; corresponden a Rodrigo durante el Prompt 6 |

No se usó la computadora, sesión, credenciales, base remota ni despliegue de
Rodrigo. No se aplicaron migraciones ni cambios administrativos. Todas las
pruebas usan datos ficticios.

## Alcance implementado

### Rutas

- Página autorizada: `/pacientes/[id]` (`src/app/pacientes/[id]/page.tsx`).
- API interna: `GET` y `POST /api/pacientes/[id]/expediente`
  (`src/app/api/pacientes/[id]/expediente/route.ts`).
- Enlace «Ver expediente» desde el directorio de pacientes.

La página es `force-dynamic`, declara `robots: { index: false, follow: false }`
y no usa datos de ejemplo. La API responde siempre con
`Cache-Control: private, no-store`.

### RF-08 · Historial clínico autorizado

La lectura reutiliza las tablas reales `patients`, `patient_physicians`,
`clinical_records`, `clinical_record_revisions` y `appointments`:

- Cabecera del paciente: nombre visible, estado, fecha de nacimiento y sexo.
- Expediente: revisión vigente y fecha de actualización del servidor.
- Revisiones inmutables, de la más reciente a la más antigua, con
  antecedentes, estado/texto de alergias, diagnóstico, tratamiento, motivo del
  cambio, médico autor y fecha del servidor.
- Hasta cinco citas recientes del paciente con el médico de la sesión, con
  enlace a su detalle.
- Estados vacíos honestos: «sin expediente abierto», «sin información clínica
  registrada» y «sin citas visibles». Nunca se sustituyen con datos ficticios.
- Si el paciente no tiene vínculo con el médico ni una cita no cancelada, se
  responde 404 sin consultar ni revelar los datos personales del paciente.

### RF-09 · Registro de la primera nota

- La entrada se valida con un objeto Zod estricto; rechaza `patientId`,
  `physicianId`, `authorUserId`, `role`, `createdAt` y cualquier otro campo de
  suplantación.
- El paciente sale de la URL, el médico y el rol de la sesión SSR, y la fecha,
  autoría y médico responsable de `auth.uid()`/`now()` en la RPC.
- Si el expediente aún no es visible, se invoca `open_clinical_record` una sola
  vez; la función valida la cita vigente y crea la asociación y el expediente de
  forma idempotente.
- La primera revisión se guarda con `expectedRevision = 0` mediante
  `save_clinical_revision`.
- El estado de alergias distingue `not_recorded`, `none_reported` y `reported`;
  `reported` exige texto y los demás estados lo rechazan.

### RF-11 · Actualización controlada y auditoría

- Cada guardado crea una revisión nueva; no hay `UPDATE` ni `DELETE` de
  revisiones desde la aplicación. La tabla conserva las anteriores.
- `expectedRevision` toma `clinical_records.current_revision`. Si no coincide,
  la RPC responde `PT409` y la API devuelve 409; la interfaz no sobrescribe y
  ofrece «Recargar expediente».
- Desde la revisión 2 el motivo del cambio es obligatorio (cliente, Zod y SQL).
- `clinical_records.updated_at` se actualiza por trigger del servidor.
- El autor y la fecha de cada revisión son los que asigna la base de datos.

## Reglas de acceso y seguridad

- Solo el rol `physician` de `app_metadata` (JWT firmado) con fila activa en
  `physicians` puede consultar o escribir. Recepción y administración reciben
  403.
- La lectura depende de RLS y de la asociación `patient_physicians` o de una
  cita no cancelada. Las escrituras dependen de las RPC `SECURITY DEFINER`.
- La aplicación nunca usa `service_role`.
- Códigos HTTP coherentes: 400 (entrada/JSON inválido), 401 (sin sesión),
  403 (rol no médico, médico inactivo o sin acceso), 404 (paciente/expediente
  no disponible), 409 (revisión obsoleta) y 503 (configuración o servicio no
  disponible).
- Los errores de PostgREST/PostgreSQL se traducen a mensajes seguros; no se
  reenvían SQL, nombres de tablas ni detalles internos.
- No se registran datos clínicos en `console`, notificaciones ni cachés
  públicas. El acceso directo por URL queda protegido por la página de servidor.
- La política preexistente `patients_select_staff` permite a recepción y
  administración leer columnas personales de `patients`; su alcance sigue
  pendiente de decisión y no se modificó en esta entrega.

## Reproducción

```bash
git fetch origin --prune
git switch feature/pry06-historial-clinico
npm ci
npm run test -- --runInBand clinical-records
npm run test:patients
```

Verificación completa sin contacto con Supabase remoto:

```bash
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run verify
```

En PowerShell:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL=''
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=''
npm.cmd run verify
```

La verificación SQL requiere Docker/PostgreSQL 17:

```bash
CONTAINER_ENGINE=docker python scripts/tar05/verify-database.py
```

Demostración manual con una sesión médica de un entorno de prueba autorizado:

1. Abrir `/pacientes`, buscar un paciente y pulsar «Ver expediente».
2. Sin sesión se muestra «Sesión requerida»; con rol no médico,
   «Acceso restringido»; con un paciente no autorizado, «Expediente no
   disponible».
3. Un expediente sin notas muestra el vacío honesto y permite registrar la
   primera nota si existe una cita vigente.
4. Al guardar una nueva revisión se conserva la anterior y se muestra el autor,
   la fecha y el motivo.
5. Ante un 409, usar «Recargar expediente»; no se reenvía la versión obsoleta.

## Resultados auténticos

Log completo: [`04-jesus-test.log`](04-jesus-test.log).

| Comprobación | Resultado local |
| --- | --- |
| `npm run test -- --runInBand clinical-records` | PASS: 6 suites, 58 pruebas |
| `npm run test:patients` | PASS: 5 suites, 47 pruebas |
| `npm run verify` con variables públicas vacías | PASS: lint estricto, tipos, 22 suites/180 pruebas Jest, 8 pruebas multimedia, 4 pruebas de integración y build |
| `git diff --check` | PASS, sin errores |
| `python scripts/tar05/verify-database.py` | No ejecutado: Docker no está instalado en este equipo |
| CI GitHub | PASS: [run 44648391161](https://github.com/Vo1dScripter/FHF-Salud/actions/runs/44648391161), jobs `verify` y `database` success, head `20d3cfb` |
| E2E autenticado en Supabase remoto | No ejecutado: reservado a Rodrigo/Prompt 6 |

Runtime local: Node v24.22.1, npm 11.19.1, Python 3.14.3 con Pillow 13.0.0.
El primer `npm run verify` falló en `img:test` porque el `python3` del PATH
(MSYS2 3.12.11) no tenía Pillow ni pip. Se corrigió el entorno con el Python
3.14.3 instalado y `python3 -m pip install Pillow`, la misma dependencia que
instala el workflow de CI; la segunda ejecución completa terminó con `EXIT=0`.
No se cambió código para ocultar el fallo.

El build regeneró `public/robots.txt`, `public/sitemap.xml`,
`public/sitemap-0.xml` y `src/styles/app.css` con timestamps o finales de
línea. Se restauraron a `HEAD` para no incluir artefactos ajenos al alcance.
Solo `public/sitemap-0.xml` tenía cambios de contenido (rutas y timestamps); no
se commiteó.

## Archivos de implementación y pruebas

- `src/app/api/pacientes/[id]/expediente/route.ts`
- `src/app/pacientes/[id]/page.tsx`
- `src/app/components/clinical-records/ClinicalHistory.tsx`
- `src/app/components/clinical-records/ClinicalState.tsx`
- `src/app/components/patients/PatientDirectory.tsx`
- `src/features/clinical-records/contracts.ts`
- `src/features/clinical-records/errors.ts`
- `src/features/clinical-records/index.ts`
- `src/features/clinical-records/routes.ts`
- `src/features/clinical-records/service.ts`
- `src/features/clinical-records/supabase-repository.ts`
- `src/features/clinical-records/validation.ts`
- `src/features/clinical-records/__tests__/repository.test.ts`
- `src/features/clinical-records/__tests__/service.test.ts`
- `src/features/clinical-records/__tests__/validation.test.ts`
- `src/features/patients/index.ts`
- `src/features/patients/routes.ts`
- `src/lib/clinical-records/http.ts`
- `src/lib/clinical-records/server.ts`
- `src/lib/clinical-records/__tests__/route.test.ts`
- `src/lib/clinical-records/__tests__/server.test.ts`
- `src/__tests__/clinical-records/ClinicalHistory.test.tsx`
- `src/__tests__/patients/PatientDirectory.test.tsx`
- `docs/pry06/04-jesus-handoff.md`
- `docs/pry06/04-jesus-test.log`

## Pendientes y decisiones para el equipo

- Revisión humana y merge del PR de este trabajo; no se autoaprueba ni se
  fusiona automáticamente.
- PR #3, #4 y #5 siguen abiertos. Este PR está apilado sobre el #5; cuando el
  #5 se fusione, reapuntar la base a `main` y volver a ejecutar la verificación.
- Rodrigo/Prompt 6: aplicar migraciones en el entorno autorizado, ejecutar el
  E2E autenticado y validar la base remota. No se hizo desde esta entrega.
- Docker no está disponible en este equipo; la verificación SQL local de
  Emilio sigue siendo la evidencia de base de datos.
- La lectura de revisiones tiene un límite de 500 y rechaza mostrar un
  historial parcial si `current_revision` no coincide. Si el expediente crece
  por encima de ese límite, habrá que paginar la lectura.
- RF-13 a RF-16 no están implementados. Diagnóstico y tratamiento son texto de
  la nota clínica; no equivalen a módulos estructurados de recetas, estudios o
  signos vitales.
- Revisar el alcance de `patients_select_staff` para datos personales, decisión
  heredada del traspaso de Emilio.
