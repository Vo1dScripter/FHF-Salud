# Acuerdo de integración del módulo de citas · PRY05

Preparación del integrante 1 para RF-01 a RF-06. Este documento acuerda límites;
no afirma que las seis funciones estén implementadas. La base de conexión a Supabase se integró después de aprobar la preparación.
El flujo de acceso, las políticas por cita y la persistencia del módulo siguen
pendientes; el shell no expone datos médicos.

## Estado y componentes reutilizables

Next.js 16 / React 19 / TypeScript; App Router, Tailwind 4 y SCSS compilado por
Gulp. La portada `/` compone Header → QuickNav, Main y Footer. Reutilizar estos
componentes, marca textual, tipografía local y estilos `.fhf-*`. Conservar las
anclas `#inicio`, `#alcance` y `#siguiente-etapa`, así como `/api/hello`.
No hay sesión, proveedor de citas ni tablas. Hay formulario y detalle de
preparación sin envío ni consulta de datos médicos.
`QuickContactForm` es un formulario genérico de contacto, no una fuente de
pacientes ni una implementación de alta de citas.

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
| createdAt            | IsoDateTime                    | Fecha de creación asignada por servidor         |
| updatedAt            | IsoDateTime                    | Última actualización asignada por servidor      |

`PatientReference` y `PhysicianReference` aportan `id` y `displayName`; los
nombres no se duplican como identidad dentro de Appointment. La capa de lectura
resolverá sus referencias autorizadas. `IsoDateTime` documenta el formato: un
alias TypeScript no valida valores recibidos en ejecución.

`CreateAppointmentInput` recibe paciente, médico, inicio, duración y motivo;
no recibe identificador, estado ni auditoría del navegador. El servicio futuro
creará en estado `pending`. `RescheduleAppointmentInput` recibe inicio y duración.
`CancelAppointmentInput.reason` es el motivo de cancelación, separado del motivo
de consulta; la implementación deberá conservarlo en la auditoría de cancelación.

El contrato anterior usaba `scheduled` y estados adicionales `attended` y
`no_show`. Ningún consumidor ni persistencia existentes los utiliza. Se alineó
el contrato a los tres estados del PROMPT 1; no hay migración de datos ni tablas.

## URLs y operaciones acordadas

`appointmentRoutes` centraliza las URLs de las páginas; no crea endpoints de
operaciones ni sustituye la persistencia.
Las tres rutas ya renderizan la estructura aprobada en modo preparación.

| URL prevista | Región / componentes previstos                                     |
| ------------ | ------------------------------------------------------------------ |
| /citas       | Listado: AppointmentList y estado de preparación/carga/error/vacío |
| /citas/nueva | Formulario: AppointmentForm con campos etiquetados                 |
| /citas/[id]  | Detalle: AppointmentDetail y AppointmentActions                    |

Colocar esos componentes bajo `src/app/components/appointments/`, con páginas
pequeñas que los compongan. Reusar el shell existente; no duplicar una portada.
La entrada «Citas médicas» ya navega a `/citas`; se conservan las anclas previas
y se usa `aria-current` dentro del módulo.

`AppointmentService` es el límite de aplicación que usará la interfaz:

| Operación  | Entrada                                   | Salida                                                      |
| ---------- | ----------------------------------------- | ----------------------------------------------------------- |
| list       | AppointmentQuery opcional                 | Appointment[] autorizado                                    |
| getById    | AppointmentId                             | Appointment o null si no existe dentro del ámbito permitido |
| create     | CreateAppointmentInput                    | Appointment persistida                                      |
| confirm    | AppointmentId                             | Appointment actualizada                                     |
| reschedule | AppointmentId, RescheduleAppointmentInput | Appointment actualizada                                     |
| cancel     | AppointmentId, CancelAppointmentInput     | Appointment actualizada                                     |

La interfaz todavía no tiene implementación. Un adaptador futuro puede usar
Server Actions o API, pero no se declaran endpoints HTTP inexistentes como
operativos. `AppointmentRepository` conserva create/findById/list/update como
límite interno de persistencia y nunca se expone directamente al navegador.

Requisitos para la siguiente implementación: validar entradas en servidor,
referencias existentes, disponibilidad sin solapamientos y ámbito del usuario;
confirmar pendiente → confirmada, cancelar pendiente/confirmada → cancelada,
rechazar cambios sobre canceladas. Propuesta para acordar con el equipo: la reprogramación de una confirmada
vuelve a pendiente para confirmar el nuevo horario. Estos son acuerdos para
la implementación futura, no reglas ya ejecutadas por los tipos. Crear y
reprogramar deben resolver concurrencia en persistencia, no solo en el formulario.
Los fallos se comunicarán como errores recuperables; una dependencia no disponible
no significa `[]`, éxito ni ausencia de citas.

## Control de acceso previsto

- El shell informativo puede ser público. Leer datos médicos y operar citas
  requiere sesión verificada y autorización del usuario en servidor.
- No existe autenticación reutilizable actualmente. Al integrar Supabase,
  verificar su sesión mediante el mecanismo oficial server-side y aplicar RLS
  para el ámbito autorizado en cada operación, incluidas lecturas y detalle.
- El responsable de datos definirá y documentará los permisos del equipo antes
  de habilitar operaciones; negar por defecto cualquier operación sin política.
  Una sesión válida por sí sola no concede acceso a todas las citas.
- Obtener identidad y permisos del servidor/proveedor; no aceptar un rol, ID de
  usuario o selector visual enviado por el navegador como prueba de autorización.
- Validar en cada operación y sobre cada cita, incluidos IDs proporcionados por
  URL; ocultar botones o bloquear una página no protege la base de datos.
- Hasta completar sesión, políticas y servicio, no leer ni escribir citas,
  mostrar registros ficticios ni ofrecer guardados o inicios de sesión falsos.

## Supabase: base integrada

Se creó el proyecto gratuito exclusivo `fhf-salud`; se configuró su URL y clave
`sb_publishable_` en `.env.local` (ignorado por Git) y Vercel para Production,
Preview y Development. `.env.example` contiene nombres vacíos. El cliente
rechaza claves secretas/legacy y orígenes inseguros, sin imprimir credenciales.

Clientes SSR en `src/lib/supabase/client.ts` y `server.ts`; renovación/verificación
de claims en `src/proxy.ts`, limitada al módulo. La preparación pública permanece
accesible; no se considera autenticado a un usuario por tener clave pública ni
se habilitan acciones médicas. La autorización por registro deberá añadirse junto
con el servicio y sus políticas RLS. El servidor no debe confiar en getSession()
como prueba de identidad.

Exposición automática de tablas nuevas desactivada y RLS automático activado
al crear el proyecto. No se crearon tablas de citas, políticas clínicas ni usuarios.
Nunca usar `sb_secret_`, `service_role` o contraseña de Postgres en frontend.
La clave pública no sustituye autorización ni RLS.

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

| Estado                   | Tratamiento acordado                                                            |
| ------------------------ | ------------------------------------------------------------------------------- |
| Preparación actual       | Servicio/acceso pendientes; escritura deshabilitada y explicada; no falso vacío |
| Cargando futuro          | Estado anunciado y skeleton; sin porcentaje inventado                           |
| Poblado futuro           | Todas las citas autorizadas; nombres/motivos largos con wrap; detalle accesible |
| Vacío futuro             | Solo tras consulta exitosa; distinguir filtros sin coincidencias                |
| Error/unavailable futuro | Explicación y recuperación real cuando exista adaptador                         |
| Sin sesión futuro        | Sin datos médicos, acceso a autenticación real cuando exista                    |
| Sin permiso futuro       | Mensaje de acceso restringido y retorno seguro; sin exponer registro            |
| Formulario futuro        | Labels, errores inline, deshabilitado/enviando/éxito según respuesta real       |
| Detalle/acciones futuro  | Auditoría y motivos, confirmación de acciones, reglas y permisos server-side    |

Los datos sintéticos del mockup se identificarán expresamente como propuesta,
no se incorporarán como fallback productivo. Cualquier fixture futura será
exclusivamente opt-in de desarrollo/test y mantendrá visible el error genuino.

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

No crear el commit con una cuenta ajena. Mensaje previsto para el único commit
propio del integrante: `chore: preparar modulo de citas RF01-RF06`.

## Propuesta disponible y comprobaciones de esta revisión

[Propuesta visual de Citas médicas](https://p.superdesign.dev/draft/787cd3ae-b265-42f4-b270-a4c553b91b4b),
versión 3 aprobada. El selector de variantes y la guía de tamaños se excluyeron
de la interfaz productiva con autorización expresa del integrante. La
comparación conserva el resto de regiones, SVGs y jerarquía de referencia;
el interruptor de tema es una adición autorizada.

Validación local: lint estricto, TypeScript, Jest (5 suites / 12 pruebas),
multimedia (8 pruebas), formato de archivos modificados y build de producción
correctos. La portada conserva sus tres anclas y menú responsive, comprobados
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
