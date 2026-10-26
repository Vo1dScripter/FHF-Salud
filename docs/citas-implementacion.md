# Implementación del módulo de citas · RF-01, RF-02 y RF-05

## Estado de esta entrega

El código de RF-01 (registro), RF-02 (consulta de agenda) y RF-05 (prevención
de solapamientos) está implementado y verificado localmente con pruebas,
lint, typecheck y build. La migración de base de datos está preparada para
revisión, pero **no se aplicó** contra Supabase ni contra una base local.

La activación real queda pendiente porque este entorno no tiene
`NEXT_PUBLIC_SUPABASE_URL` ni `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, no existen
las tablas remotas y no se han aprovisionado usuarios, roles, pacientes ni
médicos. Sin esa configuración la interfaz muestra estados de sesión,
configuración o error; no usa datos ficticios como respaldo.

RF-03 (confirmación) y RF-04 (reprogramación/cancelación) quedan fuera de esta
entrega.

## Alcance funcional

- Registrar citas con paciente, médico, inicio, duración y motivo.
- Consultar la agenda con filtros por fecha, médico y estado.
- Resolver nombres de paciente y médico en la lectura.
- Validar campos obligatorios, formato de fecha, referencias activas y fechas
  pasadas.
- Impedir solapamientos del mismo médico con una restricción de exclusión de
  PostgreSQL, además de una comprobación previa para mejorar el mensaje.
- Mostrar mensajes diferenciados para conflicto (409), validación (400),
  sesión ausente (401), permisos (403), no encontrado (404), configuración o
  conexión (503).
- Reutilizar el shell, los componentes y los estilos existentes del módulo.

## Arquitectura

```text
Navegador
  ├─ /citas                  → AppointmentAgenda (cliente)
  ├─ /citas/nueva            → AppointmentForm (cliente)
  ├─ /citas/[id]             → detalle server-side
  └─ /citas/acceso           → Supabase Auth email/password
        │
        ├─ GET  /api/citas
        ├─ POST /api/citas
        └─ GET  /api/citas/referencias
              │
              ├─ getAppointmentRequestContext()
              │    ├─ createClient() con cookies SSR
              │    ├─ auth.getUser()
              │    └─ actorFromUser() desde app_metadata
              │
              └─ DefaultAppointmentAgendaService
                   ├─ validación Zod y fechas
                   ├─ comprobación de conflictos
                   └─ SupabaseAppointmentRepository (RLS)
```

No se usa `service_role` ni una clave secreta en el navegador. La sesión se lee
de cookies y la autorización se aplica en el servicio y en RLS.

## Contratos y datos

`src/features/appointments/contracts.ts` conserva los contratos existentes y
añade:

- `AppointmentView`: cita con `patient` y `physician` resueltos.
- `AppointmentActor`: identidad de personal o médico.
- `AppointmentDirectory`: catálogo con `canCreate`, pacientes y médicos.
- `AppointmentAgendaService`: `create`, `getById`, `list` y `listReferences`.
- `AppointmentReader` y `AppointmentDirectoryRepository` como límites de
  lectura y referencias.
- `AppointmentRepository.findConflicts` para la comprobación previa.

La base de datos usa `starts_at` y `duration_minutes`; el dominio mantiene
`scheduledAt` y `durationMinutes`. El repositorio hace la traducción. El fin se
deriva de inicio + duración y no se acepta desde el navegador.

## Decisiones y suposiciones

1. **Agenda operada por personal.** `admin` y `receptionist` pueden registrar y
   consultar toda la agenda. Un `physician` solo consulta su propia agenda y no
   puede crear citas. No se implementa autoservicio de pacientes.
2. **Roles en el JWT.** El rol se lee de `app_metadata.appointment_role` y, para
   médicos, de `app_metadata.physician_id`. `app_metadata` solo lo modifica el
   servidor de Supabase Auth; no se acepta un rol enviado por el navegador.
3. **Estado inicial fijo.** El servidor siempre crea en `pending`; el cliente no
   envía estado. RLS también exige `status = 'pending'` en el insert.
4. **Zona horaria.** La agenda opera en `America/Mexico_City`. El formulario
   convierte `datetime-local` a ISO 8601 con offset y la lectura se presenta en
   esa zona. No se inventó una regla de horario de atención: solo se rechaza un
   inicio pasado con un minuto de tolerancia.
5. **Duraciones.** Se aceptan 15, 30, 45 y 60 minutos, según el contrato
   existente.
6. **Intervalos semiabiertos.** Una cita que empieza justo cuando termina otra
   no se considera conflicto. La comparación es `[inicio, fin)`.
7. **Concurrencia.** La garantía es la restricción `EXCLUDE` de PostgreSQL con
   `btree_gist`; la consulta previa solo permite devolver un 409 claro antes de
   intentar el insert. Dos solicitudes simultáneas no pueden superponerse.
8. **Canceladas liberan el horario.** La restricción solo aplica a filas cuyo
   estado no es `cancelled`.
9. **Sin tablas duplicadas.** Se crean `patients`, `physicians` y `appointments`
   porque no existía un esquema confirmado. La migración es revisable y no se
   ejecutó. No se crearon tablas de perfiles ni de roles: el rol vive en Auth.
10. **Sin datos médicos reales.** Pruebas y fixtures usan nombres y UUID
    sintéticos. La vista previa sigue detrás de una bandera de desarrollo.

## Archivos principales

### Dominio y persistencia

- `src/features/appointments/contracts.ts`: contratos ampliados.
- `src/features/appointments/validation.ts`: esquemas Zod, duraciones, fechas y
  validación de pasado.
- `src/features/appointments/availability.ts`: solapamiento de intervalos.
- `src/features/appointments/datetime.ts`: conversión CDMX ↔ ISO y rangos de día.
- `src/features/appointments/errors.ts`: códigos, mensajes y traducción de
  errores de PostgreSQL/PostgREST.
- `src/features/appointments/service.ts`: reglas de aplicación y autorización.
- `src/features/appointments/supabase-repository.ts`: adaptador PostgREST/RLS.
- `src/features/appointments/index.ts`: exports públicos.
- `src/features/appointments/routes.ts`: rutas y etiquetas.

### Servidor

- `src/lib/appointments/actor.ts`: actor desde `auth.getUser()`.
- `src/lib/appointments/server.ts`: composición por petición.
- `src/lib/appointments/http.ts`: respuestas JSON y códigos HTTP.
- `src/lib/appointments/client.ts`: lectura segura de errores en el navegador.
- `src/app/api/citas/route.ts`: `GET` y `POST`.
- `src/app/api/citas/referencias/route.ts`: catálogo del formulario.
- `src/app/citas/[id]/page.tsx`: detalle server-side con 401/403/404/503.
- `src/proxy.ts`: renovación de sesión también para `/api/citas`.

### Interfaz

- `src/app/components/appointments/AppointmentAgenda.tsx`: filtros y consulta.
- `src/app/components/appointments/AppointmentForm.tsx`: alta funcional y
  variantes de vista previa.
- `src/app/components/appointments/AppointmentList.tsx`: tabla y estados.
- `src/app/components/appointments/AppointmentState.tsx`: carga, vacío, error,
  sin sesión y sin permiso.
- `src/app/components/appointments/AppointmentAccessForm.tsx`: acceso.
- `src/app/components/appointments/AppointmentSessionControl.tsx`: cierre de
  sesión.
- `src/app/citas/page.tsx`, `nueva/page.tsx`, `[id]/page.tsx` y `acceso/page.tsx`.
- `src/app/components/appointments/types.ts`: reexporta `AppointmentView` y
  formatea fechas.

### Base de datos y pruebas

- `supabase/migrations/202610250002_appointments.sql`: esquema propuesto,
  trigger de fin, restricción de solapamientos, índices, RLS y grants.
- `supabase/tests/appointments.sql`: prueba SQL transaccional de conflicto,
  médicos diferentes y liberación por cancelación.
- `src/features/appointments/__tests__/`: servicio, disponibilidad y fechas.
- `src/__tests__/appointments/`: flujo UI y preparación.

## Migración propuesta

La migración crea:

- `patients (id, display_name, active, created_at)`.
- `physicians (id, display_name, active, created_at)`.
- `appointments (id, patient_id, physician_id, starts_at, duration_minutes,
  ends_at, reason, status, created_at, updated_at)`.
- `ends_at` se mantiene con el trigger `set_appointment_times`. No se usa una
  columna generada porque `timestamptz + interval` es estable y PostgreSQL exige
  expresiones inmutables para columnas generadas.
- `appointments_no_overlap`: `EXCLUDE USING gist (physician_id WITH =,
  tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status <> 'cancelled')`.
- Índices por médico/inicio, paciente/inicio, estado/inicio y médico/paciente.
- RLS:
  - personal: lectura de todos los pacientes, médicos y citas;
  - médico: su ficha, pacientes con citas propias y sus citas;
  - insert de citas solo para personal y solo en `pending`;
  - sin políticas de update/delete para RF-03/RF-04.
- Grants mínimos para `authenticated`; `anon` no recibe acceso.
- `btree_gist` en el esquema `extensions` (convención de Supabase).

La migración **requiere revisión y aprobación** antes de aplicarse. No se
ejecutó `supabase db push`, no se aplicó SQL remoto y no se crearon usuarios ni
datos.

## Pruebas y verificación local

Ejecutado en este entorno:

```bash
npm.cmd run lint:strict   # OK, 0 warnings
npm.cmd run typecheck     # OK
npm.cmd test -- --runInBand
# Test Suites: 10 passed, 10 total
# Tests:       53 passed, 53 total
npx.cmd next build        # OK
```

El build se ejecutó con `npx next build` en lugar de `npm run build` porque
`prebuild` ejecuta `gulp css` y reescribe `src/styles/app.css` y
`src/styles/app.css.map`. Los hashes SHA-256 de ambos archivos se verificaron
antes y después del build y no cambiaron.

La prueba SQL `supabase/tests/appointments.sql` está preparada, pero **no se
ejecutó**: no hay base local ni `psql` disponible en este entorno y no se
autorizó una ejecución remota. Cubre:

- cálculo de `ends_at` por trigger;
- rechazo de una superposición del mismo médico;
- aceptación de la misma franja con otro médico;
- liberación del horario al cancelar.

Las pruebas Jest usan repositorios falsos como dobles de prueba; la persistencia
productiva es Supabase. No se usaron datos médicos reales.

## Pendientes para activar

1. Configurar `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local` y en el entorno de
   despliegue. No usar claves secretas en el frontend.
2. Revisar y aprobar la migración; aplicarla en un entorno local o de staging
   con `supabase db push` o el flujo aprobado.
3. Ejecutar `supabase/tests/appointments.sql` contra esa base y verificar la
   restricción de exclusión.
4. Crear usuarios de Auth y asignar `app_metadata.appointment_role` y, para
   médicos, `app_metadata.physician_id`. Esto es aprovisionamiento
   administrativo; no lo hace la migración.
5. Cargar pacientes y médicos activos por un proceso administrativo autorizado.
6. Verificar RLS con sesiones reales de admin, recepción y médico, incluidas
   consultas directas a PostgREST.
7. Probar el flujo completo contra Supabase: acceso, alta, conflicto 409,
   agenda, detalle, cierre de sesión y errores de conexión.
8. Definir horario de atención, feriados y reglas de reprogramación antes de
   implementar RF-03/RF-04.
9. Añadir auditoría de cambios y cancelación cuando se implementen RF-03/RF-04.
10. Considerar límites de tasa y monitoreo para los endpoints de escritura.

## Limitaciones conocidas

- No hay confirmación, reprogramación ni cancelación; las acciones del detalle
  siguen deshabilitadas.
- No hay autoservicio de pacientes ni registro público.
- No se validan reglas de horario de atención porque no existe una regla
  aprobada.
- La agenda usa la zona `America/Mexico_City`; un cambio de zona requeriría una
  decisión funcional.
- La vista previa con fixtures sigue siendo solo de desarrollo y no es un
  fallback.
- La migración no está aplicada; por tanto, la persistencia real aún no está
  acreditada en un entorno desplegado.
