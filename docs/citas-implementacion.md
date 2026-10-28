# Implementación del módulo de citas · RF-01 a RF-06

## Estado de esta entrega

El código de RF-01 (registro), RF-02 (consulta de agenda), RF-03
(reprogramación), RF-04 (cancelación), RF-05 (prevención de solapamientos) y
RF-06 (confirmación) está implementado. Se verificó con pruebas automatizadas,
lint estricto, typecheck, build de producción y pruebas SQL ejecutadas contra
PostgreSQL 16.4 local.

La migración de base de datos está preparada y probada localmente, pero **no se
aplicó contra el proyecto Supabase remoto** desde este entorno. La activación
remota sigue pendiente porque esta copia de trabajo no contiene
`NEXT_PUBLIC_SUPABASE_URL` ni `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, y no hay
usuarios, roles, pacientes ni médicos aprovisionados en un entorno accesible.
La aplicación no usa datos ficticios como respaldo: sin configuración o sin
sesión muestra un estado explícito.

La prueba de navegador contra Supabase/PostgREST/GoTrue reales tampoco se
ejecutó. Las pruebas Jest usan `fetch` y repositorios simulados; las pruebas SQL
usan PostgreSQL real con reclamos JWT simulados y el rol `authenticated`.

## Alcance funcional

- Registrar citas con paciente, médico, inicio, duración y motivo.
- Consultar la agenda con filtros por fecha, médico y estado.
- Resolver nombres de paciente y médico en la lectura.
- Reprogramar fecha, hora y duración de una cita no cancelada, revalidando
  disponibilidad dentro de la misma transacción.
- Confirmar una cita pendiente y persistir `confirmed`, `confirmed_at` y
  `confirmed_by`.
- Cancelar con motivo obligatorio, conservar la fila y liberar el horario.
- Mostrar los cambios de inmediato en la agenda y en el detalle.
- Validar campos obligatorios, formato de fecha, referencias activas, fechas
  pasadas, motivo de cancelación y versión de la cita.
- Impedir solapamientos del mismo médico con una restricción de exclusión de
  PostgreSQL, además de una comprobación previa para mejorar el mensaje.
- Diferenciar respuestas de validación (400), sesión ausente (401), permisos
  (403), no encontrado (404), conflicto o versión desactualizada (409) y
  configuración o conexión (503).

## Matriz de estados y acciones

| Estado actual           | Acción                               | Resultado                                                                                        |
| ----------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `pending`               | Confirmar                            | Pasa a `confirmed`; guarda auditoría y usuario.                                                  |
| `confirmed`             | Confirmar                            | No-op idempotente; no reescribe ni duplica auditoría.                                            |
| `cancelled`             | Confirmar                            | Rechazado (400). Nunca se reactiva una cancelada.                                                |
| `pending`               | Reprogramar                          | Conserva `pending`, cambia inicio/duración y revalida disponibilidad.                            |
| `confirmed`             | Reprogramar                          | Vuelve a `pending`, limpia `confirmed_at`/`confirmed_by` y exige confirmar el nuevo horario.     |
| `cancelled`             | Reprogramar                          | Rechazado (400).                                                                                 |
| `pending` o `confirmed` | Cancelar                             | Pasa a `cancelled`, guarda motivo y metadatos, conserva la fila y libera el horario.             |
| `cancelled`             | Cancelar                             | No-op idempotente con motivo válido; conserva el motivo original y no duplica auditoría.         |
| Cualquiera              | Acción con `expectedUpdatedAt` viejo | Rechazado (409) si intenta escribir; una repetición idempotente puede devolver el estado actual. |
| Cualquiera              | Acción sobre una cita inexistente    | Rechazado (404).                                                                                 |
| Cualquiera              | Acción de un médico                  | Rechazado (403); el médico solo lee su agenda.                                                   |

Reglas adicionales:

- El motivo de cancelación se recorta, es obligatorio y admite entre 1 y 500
  caracteres.
- Un motivo inválido se valida antes de cualquier escritura.
- La reprogramación no admite un inicio en el pasado (tolerancia de un minuto).
- El fin se deriva de inicio + duración; no se acepta desde el navegador.
- Cancelar no elimina la fila y no reutiliza el identificador de la cita. El
  horario queda libre para una cita nueva.
- Una cita cancelada conserva `confirmed_at` si había sido confirmada; el
  detalle solo muestra la confirmación vigente para citas no canceladas.

## Arquitectura

```text
Navegador
  ├─ /citas                  → AppointmentAgenda (cliente)
  ├─ /citas/nueva            → AppointmentForm (cliente)
  ├─ /citas/[id]             → detalle server-side autorizado
  └─ /citas/acceso           → Supabase Auth email/password
        │
        ├─ GET   /api/citas
        ├─ POST  /api/citas
        ├─ GET   /api/citas/referencias
        ├─ GET   /api/citas/[id]
        └─ PATCH /api/citas/[id]
              │
              ├─ getAppointmentRequestContext()
              │    ├─ createClient() con cookies SSR
              │    ├─ auth.getUser()
              │    └─ actorFromUser() desde app_metadata
              │
              └─ DefaultAppointmentAgendaService
                   ├─ validación Zod y fechas
                   ├─ autorización de aplicación
                   ├─ comprobación previa de conflictos
                   └─ SupabaseAppointmentRepository (RPC/RLS)
```

No se usa `service_role` ni una clave secreta en el navegador. La sesión se lee
de cookies y la autorización se aplica en el servicio, en funciones SQL
`security definer` y en RLS. El navegador nunca envía el rol ni el `userId`.

## API de mutaciones

`PATCH /api/citas/{id}` recibe JSON con `expectedUpdatedAt` y una acción:

```json
{
  "action": "reschedule",
  "expectedUpdatedAt": "2030-01-15T15:55:00.000Z",
  "scheduledAt": "2030-01-20T18:00:00.000Z",
  "durationMinutes": 45
}
```

```json
{
  "action": "cancel",
  "expectedUpdatedAt": "2030-01-15T15:55:00.000Z",
  "reason": "El paciente no puede asistir"
}
```

```json
{
  "action": "confirm",
  "expectedUpdatedAt": "2030-01-15T15:55:00.000Z"
}
```

Respuesta correcta:

```json
{ "appointment": { "...": "AppointmentView actualizado" } }
```

Respuesta de error:

```json
{
  "error": {
    "code": "conflict",
    "message": "El horario seleccionado ya está ocupado para este médico.",
    "fieldErrors": { "scheduledAt": "Selecciona otro horario disponible." }
  }
}
```

Códigos HTTP: `400` validación, `401` sin sesión, `403` sin permiso, `404` no
encontrada, `409` conflicto o versión desactualizada, `503` configuración o
conexión. `GET /api/citas/{id}` devuelve la misma forma `{ appointment }`.

La interfaz solo anuncia éxito después de recibir una respuesta 2xx con la cita
actualizada. Si la respuesta no se puede leer, no muestra “guardado”: pide
recargar. Si la conexión falla o la API rechaza el cambio, conserva la fila y
muestra el error real.

## Contratos y datos

`src/features/appointments/contracts.ts` define:

- `Appointment`: cita con `cancelReason`, `cancelledAt` y `confirmedAt`
  opcionales.
- `AppointmentView`: cita con `patient` y `physician` resueltos.
- `AppointmentActor`: identidad de personal o médico.
- `AppointmentDirectory`: catálogo con `canCreate` y `canManage`.
- `AppointmentAgendaService`: `create`, `getById`, `list`, `listReferences`,
  `confirm`, `reschedule` y `cancel`.
- `AppointmentRepository`: persistencia; las mutaciones reciben
  `expectedUpdatedAt`.
- `AppointmentReader` y `AppointmentDirectoryRepository`: límites de lectura y
  referencias.

La base de datos usa `starts_at` y `duration_minutes`; el dominio mantiene
`scheduledAt` y `durationMinutes`. El repositorio traduce ambos sentidos. El fin
se calcula en PostgreSQL con el trigger `set_appointment_times`.

## Autorización

- `admin` y `receptionist` pueden consultar toda la agenda, registrar, confirmar,
  reprogramar y cancelar.
- Un `physician` solo puede consultar su propia agenda y su propio detalle; no
  puede mutar citas, aunque conozca el identificador.
- El rol se lee de `app_metadata.appointment_role` del JWT firmado por Supabase
  Auth. Para médicos se exige `app_metadata.physician_id`.
- Una cuenta sin rol de agenda recibe 403. Una petición sin sesión recibe 401.
- El detalle server-side aplica la misma autorización y no revela la existencia
  de citas de otro médico.
- RLS limita pacientes, médicos, citas y eventos. Las mutaciones solo se pueden
  ejecutar mediante RPC; no hay `UPDATE` ni `DELETE` directos para
  `authenticated`.
- `canCreate` y `canManage` son pistas de presentación. El servidor vuelve a
  autorizar cada operación.

## Concurrencia y auditoría

La lectura previa del servicio sirve para dar mensajes claros, pero no es la
garantía de concurrencia. Cada mutación se ejecuta en una función PL/pgSQL que:

1. Comprueba `auth.uid()` y el rol de agenda.
2. Bloquea la fila con `SELECT ... FOR UPDATE`.
3. Rechaza la cita inexistente (`PT404`).
4. Rechaza el estado inválido (`PT422`).
5. Compara `updated_at` con `expectedUpdatedAt` (`PT409`).
6. Valida fecha y duración.
7. Actualiza y devuelve la fila dentro de la misma transacción.

La restricción `appointments_no_overlap` sigue siendo la garantía atómica de
disponibilidad:

```sql
EXCLUDE USING gist (
  physician_id WITH =,
  tstzrange(starts_at, ends_at, '[)') WITH &&
) WHERE (status <> 'cancelled')
```

Dos solicitudes simultáneas para el mismo médico no pueden superponerse. Si una
reprogramación compite con otra, la segunda espera el bloqueo, detecta la
versión nueva y recibe 409; si intenta ocupar una franja ya ocupada, PostgreSQL
devuelve `23P01` y la API responde 409.

La tabla `appointment_events` es un historial append-only con:

- `event_type`: `created`, `confirmed`, `rescheduled`, `cancelled` o `updated`.
- Estado anterior y nuevo.
- Inicio y duración anteriores y nuevos.
- Motivo de cancelación.
- Usuario que ejecutó la acción y momento del evento.

El trigger `appointments_record_event` registra cada alta y actualización. Una
reprogramación tiene prioridad sobre el cambio de estado, de modo que
`confirmed → pending` con nuevo horario se registra como `rescheduled`. Los
reintentos idempotentes de confirmar o cancelar no ejecutan `UPDATE` y, por
tanto, no generan eventos duplicados.

## Migraciones

- `supabase/migrations/202610250002_appointments.sql`: pacientes, médicos, citas,
  trigger de fin, restricción de solapamientos, índices, RLS y grants de lectura
  y alta.
- `supabase/migrations/202610260003_appointment_actions.sql`: columnas de
  cancelación y confirmación, tabla de eventos, trigger de auditoría, RPC
  `reschedule_appointment`, `confirm_appointment` y `cancel_appointment`, RLS de
  eventos y permisos de ejecución.

La migración `202610250001_reminder_infrastructure.sql` no se aplicó en la base
local de pruebas porque `pg_cron`, `pg_net` y `supabase_vault` no están
disponibles en PostgreSQL estándar. No es necesaria para las citas.

Las migraciones no se aplicaron al proyecto remoto desde este entorno. Se
ejecutaron en una base PostgreSQL 16.4 temporal (`fhf_test`, puerto `55432`) con
un esquema `auth` mínimo, la función `auth.uid()` y el rol `authenticated`
simulados. Las pruebas corren dentro de una transacción con `ROLLBACK`.

## Archivos principales

### Dominio y persistencia

- `src/features/appointments/contracts.ts`: contratos y operaciones.
- `src/features/appointments/validation.ts`: esquemas Zod, duraciones, fechas,
  motivo de cancelación y versión esperada.
- `src/features/appointments/availability.ts`: solapamiento de intervalos.
- `src/features/appointments/datetime.ts`: conversión CDMX ↔ ISO y rangos de día.
- `src/features/appointments/errors.ts`: códigos, mensajes y traducción de
  errores PostgreSQL/PostgREST.
- `src/features/appointments/service.ts`: reglas de aplicación y autorización.
- `src/features/appointments/supabase-repository.ts`: adaptador PostgREST/RLS y
  llamadas RPC.
- `src/features/appointments/index.ts`: exports públicos.
- `src/features/appointments/routes.ts`: rutas, endpoints y etiquetas.

### Servidor

- `src/lib/appointments/actor.ts`: actor desde `auth.getUser()`.
- `src/lib/appointments/server.ts`: composición por petición.
- `src/lib/appointments/http.ts`: respuestas JSON y códigos HTTP.
- `src/lib/appointments/client.ts`: lectura segura de errores en el navegador.
- `src/app/api/citas/route.ts`: `GET` y `POST`.
- `src/app/api/citas/[id]/route.ts`: `GET` y `PATCH` con `confirm`,
  `reschedule` y `cancel`.
- `src/app/api/citas/referencias/route.ts`: catálogo del formulario.
- `src/app/citas/[id]/page.tsx`: detalle server-side con 401/403/404/503.
- `src/proxy.ts`: renovación de sesión también para `/api/citas`.

### Interfaz

- `src/app/components/appointments/AppointmentAgenda.tsx`: filtros, consulta y
  actualización local tras una mutación.
- `src/app/components/appointments/AppointmentList.tsx`: tabla, acciones de fila
  y diálogo de mutación.
- `src/app/components/appointments/AppointmentActionDialog.tsx`: formularios de
  edición, confirmación y cancelación; estados de envío y error.
- `src/app/components/appointments/AppointmentActions.tsx`: acciones del detalle.
- `src/app/components/appointments/AppointmentDetail.tsx`: detalle, motivo de
  cancelación y metadatos de confirmación.
- `src/app/components/appointments/AppointmentState.tsx`: carga, vacío, error,
  sin sesión, sin permiso y no encontrada.
- `src/app/components/appointments/AppointmentForm.tsx`: alta funcional y
  variantes de vista previa.
- `src/app/citas/page.tsx`, `nueva/page.tsx`, `[id]/page.tsx` y `acceso/page.tsx`.

### Base de datos y pruebas

- `supabase/migrations/202610250002_appointments.sql`.
- `supabase/migrations/202610260003_appointment_actions.sql`.
- `supabase/tests/appointments.sql`: alta, conflicto, médicos diferentes y
  liberación por cancelación.
- `supabase/tests/appointment-actions.sql`: reprogramación libre, horario
  ocupado, cancelación conservando la fila, motivo, idempotencia, reocupación
  del horario, confirmación, rechazo de confirmar/reprogramar canceladas,
  reprogramación de confirmada, versión desactualizada, cita inexistente,
  motivo inválido y ámbito de un médico.
- `src/features/appointments/__tests__/`: servicio, disponibilidad, fechas y
  mutaciones.
- `src/__tests__/appointments/`: flujo UI, acciones y estados de preparación.

## Verificación ejecutada

En este entorno:

```bash
npm.cmd run lint:strict   # OK, 0 warnings
npm.cmd run typecheck     # OK
npm.cmd test -- --runInBand
# Test Suites: 11 passed, 11 total
# Tests:       75 passed, 75 total
npm.cmd run build         # OK
node "$TEMP/fhf-pg/run-sql.mjs" fhf_test \
  supabase/tests/appointments.sql \
  supabase/tests/appointment-actions.sql
# OK supabase/tests/appointments.sql
# OK supabase/tests/appointment-actions.sql
```

La prueba SQL cubre explícitamente:

- mover una cita libre a otro horario y cambiar la duración;
- rechazar un horario ocupado sin mover la cita original;
- cancelar sin eliminar la fila, guardando el motivo y el usuario;
- liberar el horario y aceptar una cita nueva en esa franja;
- confirmar una pendiente y persistir la confirmación;
- rechazar la confirmación y la reprogramación de una cancelada;
- devolver a `pending` al reprogramar una confirmada;
- rechazar una versión desactualizada;
- rechazar una cita inexistente y un motivo inválido;
- impedir que un médico lea citas de otro médico o ejecute mutaciones.

Las pruebas UI cubren las tres acciones, la actualización inmediata, el rechazo
de la API, la pérdida de conexión y la ausencia de un mensaje falso de guardado.
No se usaron datos médicos reales; las fixtures usan nombres y UUID sintéticos,
con fechas de 2030.

También se ejecutó una prueba manual de carrera con dos conexiones simultáneas:
la segunda reprogramación esperó el bloqueo `FOR UPDATE`, recibió `PT409` al
continuar y no sobrescribió el horario confirmado por la primera. Esta prueba
usa la base local temporal y no forma parte de la suite automatizada de CI.

## Pendientes para activar en Supabase

1. Configurar `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local` y en el entorno de
   despliegue. No usar claves secretas en el frontend.
2. Revisar y aplicar las migraciones `202610250002` y `202610260003` en un
   entorno local o de staging con el flujo aprobado de Supabase.
3. Ejecutar `supabase/tests/appointments.sql` y
   `supabase/tests/appointment-actions.sql` contra esa base.
4. Crear usuarios de Auth y asignar `app_metadata.appointment_role` y, para
   médicos, `app_metadata.physician_id`.
5. Cargar pacientes y médicos activos por un proceso administrativo autorizado.
6. Verificar RLS con sesiones reales de admin, recepción y médico, incluidas
   consultas directas a PostgREST.
7. Probar el flujo completo contra Supabase: acceso, alta, confirmación,
   reprogramación, conflicto 409, cancelación, persistencia tras recarga,
   detalle y errores de conexión.
8. Definir horario de atención y feriados si el negocio los requiere. La
   implementación actual no inventa una regla de horario.
9. Añadir límites de tasa y monitoreo para los endpoints de escritura.

## Limitaciones conocidas

- No se acreditó un despliegue remoto ni una prueba E2E contra Supabase/GoTrue.
- No hay autoservicio de pacientes ni registro público.
- La agenda usa `America/Mexico_City`; un cambio de zona requiere una decisión
  funcional.
- No se validan reglas de horario de atención porque no existe una regla
  aprobada.
- La vista previa con fixtures sigue siendo solo de desarrollo y no es un
  fallback.
- El historial de eventos está disponible para lectura autorizada, pero la
  interfaz actual no muestra la línea de tiempo completa; muestra el motivo de
  cancelación y los metadatos principales.
