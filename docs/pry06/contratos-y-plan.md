# PRY06 Hito 2 · contrato de integración de pacientes

Responsable de integración: Rodrigo Ruiz Aguilar. Entrega: 19/11/2026 23:59,
America/Mexico_City. Este documento describe código existente y acuerdos propuestos
por separado. No acredita RF-07 a RF-12 completos ni RF-13 a RF-16.

## Base verificada antes de implementar

- Clon: `/home/voidscripter/Escritorio/Program/Web/0Tareas/Software/FHF-Salud`.
- HEAD inicial y base remota consultada mediante fetch y ls-remote:
  `474acf0bff4be32c094f711227f725dda83a106d`; sincronización `0 0`.
- Rama oficial: `main`; el remoto `oficial` era el repositorio oficial y `origin`
  era `Rodri040409/FHF-Salud`. Con autorización del usuario se renombró el fork
  a `fork-anterior` y `oficial` a `origin`, sin cambiar URLs ni credenciales.
- No fue necesario pull: main ya coincidía. Rama creada desde `origin/main`:
  `feature/pry06-arquitectura-pacientes`.
- Cambios preexistentes preservados: eliminación staged de
  `evidencias/TAR05/TAR05-Amarillo.pdf`, `.playwright-cli/` y `.serena/` sin seguimiento.
  No se incluyen en esta entrega ni se restauran automáticamente.
- Último PR requerido confirmado mediante API pública: [#2](https://github.com/Vo1dScripter/FHF-Salud/pull/2),
  fusionado el 06/11/2026 a las 07:59:45Z. No hay aportes RF-07–12 previos en
  main; no se presuponen contratos ni migraciones de compañeros.
- Se conservó la identidad Git configurada de Rodrigo; no se atribuye trabajo a compañeros.

## Auditoría reconciliada

`docs/citas-implementacion.md` conserva el estado de `ef8a8bf` del 30/10/2026:
14 comprobaciones locales y remoto pendiente. README contiene párrafos de esa
etapa y una actualización posterior. `docs/tar05-e2e.md`, README y los resultados
versionados en `evidencias/TAR05/e2e-tar05-1793949455394/resultados.json` fueron
actualizados por `f49eef9` el 06/11/2026. Ese JSON registra 26 PASS, destino Vercel,
usuarios normales y corrida iniciada el 06/11/2026 07:54:00Z. Hay capturas y archivos
de limpieza referidos por TAR05. El PR #2 incorporó esa evidencia.

Por tanto, «remoto pendiente» describe la etapa anterior, no el último registro
histórico disponible. Los 26 PASS son evidencia del equipo, no una ejecución de
esta tarea ni garantía del estado remoto actual. Esta entrega no usa cuentas,
base remota, paneles ni despliegues de TAR05.

Se inspeccionaron package.json, src/features, src/app, clientes SSR, proxy,
migraciones, tests, workflow verify, README, docs/citas-implementacion.md,
docs/integraciones.md y docs/tar05-e2e.md. El pipeline existente ya incluye lint,
tipos, Jest, multimedia, infraestructura y build sin secretos, más PostgreSQL
local aislado en otro job. Se añadió un nombre explícito al paso y test:patients.

## Implementación disponible y contratos confirmados

- `/pacientes`: shell existente, cabecera compartida y enlace a Citas. La portada
  y Citas incluyen ahora «Pacientes». El shell es público; no contiene registros.
- `GET /api/pacientes?search=&page=1`: sesión SSR, `auth.getUser()` en servidor,
  `actorFromUser()` existente, rol exclusivamente `app_metadata.appointment_role`.
  Solo médico con `physician_id` UUID y fila activa visible en `physicians`.
  Administración y recepción conservan sus permisos de Citas, pero reciben 403
  en este nuevo módulo clínico; no se amplían políticas SQL.
- La misma instancia SSR del usuario consulta `patients`. No se usa service_role.
  RLS vigente solo deja al médico leer pacientes que tengan citas con él.
  Una cita cancelada sigue constituyendo asociación según la política actual;
  no se cambia esa regla implícitamente. Un paciente sin citas aún no será visible.
- `PatientId` sigue siendo string UUID compatible con `appointments.patient_id`.
  `PatientSummary`: `id`, `displayName`, `active`, `createdAt`, mapeados únicamente
  de `id`, `display_name`, `active`, `created_at` confirmados en migración.
- `PatientQuery`: búsqueda de nombre de hasta 100 caracteres (letras, números,
  espacios, punto, apóstrofo y guion; sin comodines SQL) y página entera 1–10000.
  Paginación de 25, orden por display_name e id, una fila centinela y hasMore.
  No se retorna total de registros ni información de pacientes ajenos.
- `PatientPage = { patients: PatientSummary[], hasMore: boolean }`.
  `PatientRepository.isActivePhysician(id)` y `.list(query)` son importables;
  `PatientService.list(actor, input)` autoriza y valida antes de leer pacientes.
- `createPatientSchema`: solo displayName obligatorio trim de 1–200 caracteres,
  objeto estricto. Es validador compartido de alta mínima; NO es una operación de
  escritura habilitada. SQL actual no concede INSERT a authenticated.
- API pública compartida: `@/features/patients`; adaptador Supabase separado.
  Identidad, autorización y persistencia jamás provienen de props del navegador.
- SSR/proxy renueva sesión en pacientes y su API; cada operación vuelve a autorizar.
  API responde `Cache-Control: private, no-store`; fetch usa no-store, aborta consultas
  anteriores y retira resultados al buscar/paginar/reintentar. No hay caché clínica offline.

Errores seguros: `{ error: { code, message } }`; validation→400,
unauthenticated→401, forbidden→403, configuration/unavailable→503. No se devuelven
SQL, tokens ni errores internos. Un fallo no se convierte en éxito vacío.

## Matriz de estados implementada

| Estado                | Comportamiento y verificación                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| Cargando              | Mensaje status; datos anteriores retirados; petición cancelable                                |
| Poblado               | Registros reales recibidos; nombres largos, activo/inactivo, UUID; 25 por página               |
| Vacío                 | Sin coincidencias visibles; no afirma inexistencia; limpiar filtros y volver                   |
| Sesión ausente        | 401; acceso existente `/citas/acceso`; tras login elegir Pacientes en navegación               |
| Acceso denegado       | 403; no muestra registros ni ofrece operación privilegiada                                     |
| Configuración ausente | 503 real comprobado sin variables públicas; reintentar                                         |
| Dependencia fallida   | 503; no vacía ni oculta el error; reintentar                                                   |
| Validación            | 400; mantiene formulario para corregir                                                         |
| Buscar/paginar        | Reinicia página al buscar/limpiar; anterior/siguiente según límites; aborta respuesta obsoleta |

La composición reutiliza Roboto autoalojada, tokens --fhf-\*, Header, QuickNav,
Footer y clases appointments existentes. Escritorio: tabla y navegación del sistema;
tableta/móvil: menú colapsado y filas apiladas existentes, controles envueltos y
objetivos de 44px. Sin nuevos activos raster, iconos ni dependencias de UI.
No structural motion selected (no se seleccionó movimiento estructural); se conserva
la política existente de movimiento reducido. No hay propuesta de rediseño ni
se modifica la dirección visual aprobada de Citas. React Bits no es elegible:
no existe components.json; no se inicializa shadcn. No se selecciona tratamiento
Uiverse: esta integración funcional reutiliza las primitivas existentes.

## Recorrido objetivo y dependencias aún no resueltas

Médico autenticado → alta mínima de paciente y expediente → búsqueda → consulta de
historial → incorporar/editar información clínica → comprobación negativa de acceso.
En esta entrega solo sesión, consulta/búsqueda paginada y rechazo están ejecutables.
Alta e historial no se anuncian operativos ni se sustituyen con botones ficticios.

Antes de integrar alta, Emilio debe acordar con Yaird una RPC transaccional y RLS:
crear el paciente existente y su asociación autorizada al médico, devolver el mismo
UUID y conservar la posibilidad de usarlo en citas. No crear otra tabla patients.
La política actual basada en citas no permite completar el primer expediente sin
una decisión explícita de asociación médico-paciente. No abrir lectura global para
resolverlo. La política para recepción/admin sobre datos clínicos requiere acuerdo.

RF-08: propuesta de representación de dominio, no columnas ya existentes: una
entrada clínica versionada con cuatro secciones explícitas (antecedentes, alergias,
diagnóstico descriptivo y tratamiento descriptivo). «Sin información registrada»
no equivale a «niega alergias». Emilio y Jesús deben confirmar tipos, límites,
relación paciente/médico y estructura SQL antes de publicar el contrato persistido.
Cada alta/edición debe conservar fecha del servidor, auth.uid(), physician_id
verificado contra physicians y revisión anterior. Las ediciones agregan revisión
inmutable y motivo; no sobrescriben la autoría ni fecha original. Debe existir
control de concurrencia con versión esperada y 409 por revisión obsoleta, y una
transacción que incluya cambio y auditoría. Nunca aceptar como verdad médico,
rol, fecha ni autor enviados desde navegador. No habilitar escrituras directas.

El diagnóstico y tratamiento aquí son texto de la nota del RF-08. No equivalen a
catálogos codificados, prescripciones, gestión de medicamentos ni otras capacidades
RF-13 a RF-16; esos módulos siguen pendientes. No hay tablas clínicas nuevas en
esta base; inventar un adaptador que escriba columnas inexistentes rompería el contrato.

## Propiedad y puntos de integración

| Responsable | Archivos/ámbito                                                     | Punto de integración y entrega requerida                                                                     |
| ----------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Rodrigo     | Header, proxy, contratos públicos, shell /pacientes, CI, docs/pry06 | Revisar cambios compartidos; integrar sin reescribir Citas                                                   |
| Emilio      | Nuevas migraciones incrementales y supabase/tests                   | Modelo clínico, asociación, RPC, RLS, auditoría; no editar migraciones aplicadas                             |
| Yaird       | RF-07/10, formulario de alta y búsqueda en features/patients        | Reutilizar patientId/createPatientSchema/PatientPage; ampliar repository mediante PR con migración integrada |
| Jesús       | RF-08/09/11, futuro dominio de historial y vistas                   | Acordar contrato con Emilio; lectura, registro y revisiones con identidad del servidor                       |
| Manuel      | RF-12 y pruebas negativas/integración                               | Reutilizar acceso médico; matriz de roles, RLS y E2E con cuenta normal                                       |

La numeración se conserva según la asignación del encargo; no se inventan títulos
normativos RF sin el documento de requisitos. Antes de trabajar en un archivo
compartido, coordinar su cambio mediante PR y contrato aprobado, no copiar archivos
locales de compañeros. Este reparto es propuesta de integración, no constancia de
aceptación ni revisión por parte de los integrantes.

## Flujo Git y cierre protegido

Cada compañero: fetch origin --prune, verificar remoto oficial y main, revisar
status/diff y PRs fusionados, fast-forward solo si es seguro, crear su rama desde
main remoto actualizado. No basarse en esta rama hasta revisión real y merge.
Preservar cambios propios; no reset --hard, clean -fd, force-push ni credenciales
compartidas. Hacer commits con identidad auténtica; subir al mismo remoto oficial.

PR → CI verify/database → revisión de compañero distinto del autor → resolver
observaciones → merge autorizado. No autoaprobar. Solicitar a Emilio u otro miembro;
no asignar una cuenta inferida de un nombre. Las protecciones recomendadas son PR
obligatorio, una aprobación y checks verify/database; solo el dueño debe activarlas.
No se modifica configuración administrativa en esta tarea.

No aplicar migraciones a Supabase remoto ni desplegar. Rodrigo hará respaldo,
conciliación del historial de migraciones, revisión de SQL/RLS, aplicación protegida,
aprovisionamiento ficticio, E2E normal y limpieza durante Prompt 6.

## Evidencias pendientes para el hito

| Evidencia                                   | Situación/condición de cierre                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| Código y pruebas del acceso/búsqueda        | Disponibles en esta rama; resultados en handoff                                  |
| Revisión y merge Prompt 1                   | PR #3 abierto, revisión solicitada a Maquendo2512; aprobación y merge pendientes |
| Alta conectada + asociación médico-paciente | Pendiente PR Emilio/Yaird                                                        |
| Historial y revisiones persistidas          | Pendiente contrato y PR Emilio/Jesús                                             |
| RF-12 negativo integral                     | Pruebas parciales locales disponibles; completar con historial                   |
| Happy Path RF-07–12 con BD                  | Pendiente integración de las operaciones anteriores                              |
| E2E autenticado Supabase remoto             | Reservado a Prompt 6; no ejecutado aquí                                          |
| Protecciones de rama                        | Recomendación; sin cambios administrativos                                       |
