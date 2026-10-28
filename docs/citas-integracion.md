# Acuerdo de integración del módulo de citas · PRY05

Estado actual: RF-01 a RF-06 están implementados en código y verificados
localmente. Este documento conserva los límites acordados y registra cómo se
resolvieron acceso, persistencia, acciones y concurrencia. La migración y la
prueba E2E contra el proyecto Supabase remoto siguen pendientes de activación;
la aplicación no presenta datos ficticios como si fueran productivos.

## Estado y componentes reutilizables

Next.js 16 / React 19 / TypeScript; App Router, Tailwind 4 y SCSS compilado por
Gulp. La portada `/` compone Header → QuickNav, Main y Footer. Se reutilizan
estos componentes, marca textual, tipografía local y estilos `.fhf-*`. Se
conservan las anclas `#inicio`, `#alcance` y `#siguiente-etapa`, así como
`/api/hello`.

El módulo tiene sesión Supabase, rutas API, servicio de aplicación, políticas
RLS y persistencia PostgreSQL. `/citas` consulta la agenda real; `/citas/nueva`
registra; `/citas/[id]` muestra el detalle autorizado; las acciones de confirmar,
reprogramar y cancelar se ejecutan desde la lista y el detalle.
`QuickContactForm` sigue siendo un formulario genérico de contacto, no una
fuente de pacientes ni una implementación de alta de citas.

## Datos compartidos

Importar desde `@/features/appointments`, `@/features/patients` y
`@/features/physicians`. No duplicar tipos en los componentes.

| Campo de Appointment | Contrato                       | Significado                                     |
| -------------------- | ------------------------------ | ----------------------------------------------- |
| id                   | AppointmentId (string)         | Identificador estable asignado por persistencia |
| patientId            | PatientId (string)             | Referencia a paciente existente                 |
| physicianId          | PhysicianId (string)           | Referencia a médico existente                   |
| scheduledAt          | IsoDateTime (string)           | Inicio ISO 8601 con zona u offset               |
| durationMinutes      | 15, 30, 45 o 60                | Duración; fin derivado de inicio + duración     |
| reason               | string                         | Motivo de consulta requerido                    |
| status               | pending, confirmed o cancelled | Pendiente, confirmada o cancelada               |
| confirmedAt          | IsoDateTime o null             | Última confirmación vigente                     |
| cancelledAt          | IsoDateTime o null             | Momento de la cancelación                       |
| cancelReason         | string o null                  | Motivo conservado al cancelar                   |
| createdAt            | IsoDateTime                    | Fecha de creación asignada por servidor         |
| updatedAt            | IsoDateTime                    | Versión usada para el control de concurrencia   |

`PatientReference` y `PhysicianReference` aportan `id` y `displayName`; los
nombres no se duplican como identidad dentro de Appointment. La capa de lectura
resuelve sus referencias autorizadas. `IsoDateTime` documenta el formato: un
alias TypeScript no valida valores recibidos en ejecución.

`CreateAppointmentInput` recibe paciente, médico, inicio, duración y motivo; no
recibe identificador, estado ni auditoría del navegador. El servidor crea en
`pending`. `RescheduleAppointmentInput` recibe inicio y duración.
`CancelAppointmentInput.reason` es el motivo de cancelación, separado del motivo
de consulta; se guarda en `cancel_reason` y en `appointment_events`.

`updatedAt` funciona como versión optimista. Las mutaciones envían
`expectedUpdatedAt`; el servicio y la función SQL rechazan una versión vieja con 409. La restricción de exclusión de PostgreSQL es la garantía final de
disponibilidad.

El contrato anterior usaba `scheduled` y estados adicionales `attended` y
`no_show`. Ningún consumidor ni persistencia existentes los utilizaba. Se alineó
el contrato a los tres estados del PROMPT 1; no hubo datos históricos que
migrar.

## URLs y operaciones implementadas

`appointmentRoutes` centraliza las URLs de las páginas y `appointmentApiRoutes`
los endpoints internos.

| URL implementada | Región / componentes                                        |
| ---------------- | ----------------------------------------------------------- |
| /citas           | Agenda real: filtros, AppointmentList y acciones por fila   |
| /citas/nueva     | Formulario: AppointmentForm con validación y persistencia   |
| /citas/[id]      | Detalle server-side: AppointmentDetail y AppointmentActions |
| /citas/acceso    | Acceso con Supabase Auth                                    |

Los componentes están bajo `src/app/components/appointments/`, con páginas
pequeñas que los componen. Se reutiliza el shell existente. La entrada «Citas
médicas» navega a `/citas`; se conservan las anclas previas y se usa
`aria-current` dentro del módulo.

`AppointmentAgendaService` es el límite de aplicación implementado:

| Operación  | Entrada                                                      | Salida                                             |
| ---------- | ------------------------------------------------------------ | -------------------------------------------------- |
| list       | AppointmentQuery opcional                                    | AppointmentView[] autorizado                       |
| getById    | AppointmentId                                                | AppointmentView o null dentro del ámbito permitido |
| create     | CreateAppointmentInput                                       | Appointment persistida                             |
| confirm    | AppointmentId, expectedUpdatedAt                             | AppointmentView actualizado                        |
| reschedule | AppointmentId, RescheduleAppointmentInput, expectedUpdatedAt | AppointmentView actualizado                        |
| cancel     | AppointmentId, CancelAppointmentInput, expectedUpdatedAt     | AppointmentView actualizado                        |

La interfaz usa `GET /api/citas`, `GET /api/citas/referencias`,
`GET /api/citas/[id]` y `PATCH /api/citas/[id]` con `action` igual a `confirm`,
`reschedule` o `cancel`. `AppointmentRepository` sigue siendo el límite interno
de persistencia y nunca se expone directamente al navegador; las mutaciones se
ejecutan mediante RPC `security definer`.

Reglas ejecutadas:

- Validación Zod en servidor, referencias activas, fechas y motivo de
  cancelación.
- Confirmar una pendiente la pasa a confirmada; confirmar una confirmada es
  idempotente; confirmar una cancelada se rechaza.
- Reprogramar una confirmada la devuelve a pendiente para confirmar el nuevo
  horario; una cancelada no se puede reprogramar.
- Cancelar conserva la fila, guarda el motivo y libera el horario; repetir la
  cancelación no duplica la auditoría.
- Toda mutación comprueba `expectedUpdatedAt` y la disponibilidad dentro de una
  transacción con bloqueo de fila.
- Los fallos se comunican como errores recuperables; una dependencia no
  disponible no significa `[]`, éxito ni ausencia de citas.

## Control de acceso implementado

- El shell informativo puede ser público. Leer datos médicos y operar citas
  requiere sesión verificada y autorización del usuario en servidor.
- La sesión se verifica con `supabase.auth.getUser()` en cada petición. RLS y
  las funciones RPC aplican el ámbito autorizado en lecturas, detalle y
  mutaciones.
- `admin` y `receptionist` operan toda la agenda. Un `physician` solo lee su
  propia agenda y no puede mutar citas. Una cuenta sin rol recibe 403; una
  petición sin sesión recibe 401.
- La identidad y el rol vienen de `app_metadata` del JWT firmado; no se acepta
  un rol, ID de usuario o selector visual enviado por el navegador.
- Se valida cada operación y cada cita, incluidos IDs proporcionados por URL;
  ocultar botones o bloquear una página no protege la base de datos.
- Las mutaciones no tienen `UPDATE`/`DELETE` directos: solo se ejecutan por RPC
  que vuelven a comprobar sesión, rol, estado y versión.
- Sin configuración o sin sesión no se leen citas, no se muestran registros
  ficticios y no se ofrece un guardado falso.

## Supabase: base integrada

Se creó el proyecto gratuito exclusivo `fhf-salud`; se configuró su URL y clave
`sb_publishable_` en `.env.local` (ignorado por Git) y Vercel para Production,
Preview y Development. `.env.example` contiene nombres vacíos. El cliente
rechaza claves secretas/legacy y orígenes inseguros, sin imprimir credenciales.
Esta copia de trabajo no incluye `.env.local`, por lo que la verificación de
esta entrega no se conectó al proyecto remoto.

Clientes SSR en `src/lib/supabase/client.ts` y `server.ts`; renovación/verificación
de claims en `src/proxy.ts`, limitada al módulo. La portada pública permanece
accesible; tener la clave pública no autentica a nadie. El servidor no confía en
`getSession()` como prueba de identidad: usa `getUser()` y RLS.

Las migraciones `202610250002_appointments.sql` y
`202610260003_appointment_actions.sql` definen tablas, restricción de
solapamientos, RLS, auditoría y RPC. Están aplicadas y probadas en PostgreSQL
16.4 local, pero no se aplicaron al proyecto remoto desde esta copia de trabajo.
Exposición automática de tablas nuevas desactivada y RLS automático activado al
crear el proyecto. Nunca usar `sb_secret_`, `service_role` o contraseña de
Postgres en frontend. La clave pública no sustituye autorización ni RLS.

Comprobar el acceso público sin leer ni escribir datos: `npm run supabase:check`.
Tras guardar variables en Vercel se necesita desplegar el nuevo commit; las
variables no publican por sí solas los cambios de código locales.

## Propuesta visual y matriz de estados

La propuesta en SuperDesign cubre listado, formulario, detalle y acciones. La
versión 3 fue aprobada e implementada, excluyendo selector de revisión y guía
de tamaños. El integrante autorizó además tema claro/oscuro. Usará los tokens actuales,
controles de 44px y foco visible; escritorio 1440px, tablet 768px, móvil 390px.
Sin movimiento estructural ni runtime de animación nuevo; hover/focus CSS 180ms,
y sin transformaciones para `prefers-reduced-motion`. Sin imágenes de relleno.

| Estado            | Tratamiento implementado                                                     |
| ----------------- | ---------------------------------------------------------------------------- |
| Preparación (QA)  | Solo en `/citas/vista-previa`; explica que es una propuesta y no es fallback |
| Cargando          | Estado anunciado y skeleton; sin porcentaje inventado                        |
| Poblado           | Citas autorizadas; nombres/motivos largos con wrap; detalle accesible        |
| Vacío             | Solo tras consulta exitosa; distingue filtros sin coincidencias              |
| Error/unavailable | Mensaje seguro de la API y reintento real                                    |
| Sin sesión        | Sin datos médicos; enlace al acceso real                                     |
| Sin permiso       | Mensaje de acceso restringido; no expone el registro                         |
| Formulario        | Labels, errores inline, deshabilitado/enviando/éxito según respuesta real    |
| Detalle/acciones  | Motivo de cancelación, confirmación, reglas y permisos server-side           |

Los datos sintéticos del mockup se identifican como propuesta en la vista previa
y no se incorporan como fallback productivo. Las fixtures son exclusivamente
opt-in de desarrollo/test y no ocultan un error real.

React Bits no es elegible sin `components.json`; no inicializar shadcn. Se
inspeccionaron los loaders Uiverse `SteveBloX/wise-moose-53` (progreso ficticio,
anima ancho y usa posición absoluta) y `Smit-Prajapati/tricky-turtle-16` (logo
ajeno, 250px y ondas con blur). No seleccionados por semántica, accesibilidad y
coherencia visual. Se reutilizarán primitivas existentes y skeleton nativo.

## Entrega y evidencia

Antes de cerrar la integración visual: ejecutar lint estricto, typecheck, Jest,
pruebas multimedia y build; arrancar la app y verificar navegación previa más
rutas nuevas con Playwright en escritorio, tablet y móvil, teclado y movimiento
reducido. Comparar capturas con la propuesta aprobada; no acreditar RF por
pantallas sin datos. La compatibilidad local con Vercel no acredita un despliegue.
Las acciones RF-03/RF-04/RF-06 se verificaron con pruebas UI y SQL locales; la
prueba E2E contra Supabase remoto sigue pendiente.

No crear el commit con una cuenta ajena. Mensaje previsto para el único commit
propio del integrante: `chore: preparar modulo de citas RF01-RF06`.

## Propuesta disponible y comprobaciones de esta revisión

[Propuesta visual de Citas médicas](https://p.superdesign.dev/draft/787cd3ae-b265-42f4-b270-a4c553b91b4b),
versión 3 aprobada. El selector de variantes y la guía de tamaños se excluyeron
de la interfaz productiva con autorización expresa del integrante. La
comparación conserva el resto de regiones, SVGs y jerarquía de referencia;
el interruptor de tema es una adición autorizada.

Validación local: lint estricto, TypeScript, Jest (11 suites / 75 pruebas),
multimedia (8 pruebas), formato de archivos modificados y build de producción
correctos. Las pruebas SQL de citas y acciones se ejecutaron contra PostgreSQL
16.4 local. La portada conserva sus tres anclas y menú responsive, comprobados
con Playwright a 1440, 768 y 390px, sin desbordamiento horizontal. Se revisó
además el borrador en sus doce variantes a los tres tamaños. Evidencias locales
en `.design-reference/citas/` (ignorada por Git); no son datos médicos ni componentes de producción.

Context7 rechazó la consulta por cuota mensual agotada; no se añadieron APIs
externas ni dependencias apoyadas en documentación no verificada. La ampliación
de cuota se puede gestionar con `npx ctx7@latest login` o `CONTEXT7_API_KEY`.

## Recursos y ajustes finales

Se conserva Roboto y se aloja la variante variable usada por el borrador en
`public/fonts/fhf-roboto-latin.woff2`, con su licencia SIL OFL en
`public/fonts/Roboto-OFL.txt`. Se aplica solo al módulo; las fuentes anteriores
de la portada permanecen. Los SVGs Lucide de la referencia se incluyen en
`AppointmentIcon.tsx`, con licencia en `docs/third-party/Lucide-LICENSE`; no
requieren CDN ni dependencias nuevas.

La etiqueta Confirmada usa texto `#076f61` sobre `#d8eee7` en claro para
superar contraste 4.5:1; es el único ajuste de color de accesibilidad respecto
del borrador. El tema oscuro y el interruptor fueron autorizados por el usuario.
Al incorporar el interruptor se colapsa el menú por debajo de 960px para
conservar controles táctiles sin desbordar. No se añadió movimiento estructural.
