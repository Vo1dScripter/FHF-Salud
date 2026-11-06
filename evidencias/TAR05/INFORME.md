# TAR05 - FHF Salud - Equipo Amarillo

Ingeniería de Software SCD-1011, Instituto Tecnológico Superior de Xalapa. Actualización: 6 de noviembre de 2026. Este informe reemplaza el estado inicial del corte local; ese diagnóstico se conserva íntegro en INFORME-CORTE-LOCAL.md.

## A. Resumen ejecutivo

Se sincronizó el repositorio oficial, se auditaron las cinco integraciones PRY05 y se corrigieron una migración incompatible, un fallo de autorización SQL por rol NULL y documentación de autoría desactualizada. El proyecto nuevo de Supabase fhf-salud-tar05 fue creado en la organización Pollo con autorización del usuario, referencia oafwyfntjddrtjoqkktf. Las cinco tablas reales, las seis migraciones y las cuatro suites SQL quedaron verificadas en PostgreSQL remoto 17.11.

Se actualizaron NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY tanto en .env.local como en Vercel para All Environments. La comparación posterior verificó igualdad exacta de ambos valores; la evidencia conserva únicamente sus huellas SHA-256. Se preservó la configuración VAPID y el resto de los entornos privados.

Vercel redesplegó el código main e5299b5 con la nueva configuración: despliegue EX5SY1JEiqqWExEFgs6YyfzeG23c, estado Ready, producción. El sitio https://fhf-salud.vercel.app devuelve HTTP 200 y sus bundles contienen el nuevo dominio y la clave publicable local; no contienen el dominio Supabase anterior. Esto demuestra configuración efectiva en el navegador publicado, no solo variables guardadas en el panel.

Cierre E2E: 26 comprobaciones PASS contra https://fhf-salud.vercel.app y Supabase real con cuentas normales de recepción, médico y sin rol. RF-01 a RF-06 se recorrieron en escritorio (1440x1000) y móvil (390x844, movimiento reducido), con recargas y persistencia. Cinco carreras simultáneas de reservas y una carrera bloqueo/reserva tuvieron un único ganador. La limpieza remota dejó cero registros ficticios y eliminó las tres cuentas. Evidencia: e2e-tar05-1793949455394/resultados.json, capturas, e2e-limpieza-remota.txt y e2e-catalogo-final.txt. Los tests SQL con SET ROLE siguen diferenciados de este login real.

## B. Estado Git y contribuciones

Repositorio oficial: https://github.com/Vo1dScripter/FHF-Salud. La copia original apuntaba a origin Rodri040409/FHF-Salud; se conservó y se añadió el remoto oficial. Ambos main apuntaban al mismo commit e5299b5144d84723bd9ab77e904a54a72f4efc39. Se ejecutó fetch --all --prune y fast-forward desde 5bc865ba61bbad849370aa4091ea30b38c62fd32. Rama TAR05: feature/tar05-consolidacion-bd.

Los cambios locales previos quedaron protegidos en stash y en /home/voidscripter/.codex/tmp/fhf-tar05-backup-RHDBf8. No se usó reset --hard, clean ni reescritura de historial. Los cambios anteriores continúan separados para no mezclar documentación antigua con esta auditoría. Solo permanecen directorios de herramientas sin seguimiento y fuera de los commits TAR05.

Integración 1: c2a2e5d099e8dee25d67c70aaf4a640fe7f8ebed (c2a2e5d), Rodrigo Ruiz Aguilar, 2026-10-25T19:35:20-06:00. Mensaje real: feat: preparar citas con temas claro/oscuro e integrar Supabase. Aporta contratos, shell, rutas, temas y configuración Supabase. El mensaje exacto solicitado no existe. Rama original no verificable por el grafo actual.

Integración 2: 7963f97d4e041be1ea183152e3423f147d410b04 (7963f97), Emilio Martinez, 2026-10-25T22:04:49-06:00. feat: modelar citas y disponibilidad. Rama feature/base-datos-citas verificable mediante su referencia remota y el merge final. El borrador fue integrado en e5299b5 y duplicaba tablas con un contrato distinto. Se archivó su SQL sin alterar autoría y se corrigió la secuencia reproducible.

Integración 3: 9b8ee79593b02d451602004049f00d006f4b2031 (9b8ee79), yaird meyer, 2026-10-26T00:06:28-06:00. feat: registrar consultar y validar citas. API, adaptador PostgREST, servicio y pruebas RF-01/RF-02/RF-05. Integrado. Rama original no demostrable.

Integración 4: 77bd0310762b91b0aa143356ed6721f05081193f (77bd031), jesus_ff, 2026-10-26T01:32:49-06:00. feat:gestionar estados y cambios de citas. RPC transaccionales, eventos y acciones RF-03/RF-04/RF-06. Integrado. TAR05 repara posteriormente el rechazo de rol ausente. Rama original no demostrable.

Integración 5: ef8a8bf4f86e1f857f260a02ab120fe410caf26a (ef8a8bf), Manuel Alvarez, 2026-10-30T15:08:38-06:00. fix: integrar módulo completo de citas. Merge final e5299b5 por Manuel Alvarez, 2026-10-30T15:37:35-06:00. Integra feature/base-datos-citas. Archivos de cada contribución: historial-git.txt; ramas existentes: ramas.txt. No se inventaron autores, firmas ni commits.

Commits TAR05 anteriores: 0bf31a3d739f261bd2763bb18c3f5814bf85fa6d (correcciones y pruebas locales) y b2db8d7 (creación remota documentada). El último commit del trabajo se consulta con git log -1 --format=fuller. La rama TAR05 fue publicada con 9033f8754892daf6350b3ecbb435b55b950583a1 y PR #2. La evidencia autenticada se obtuvo sobre producción e5299b5 y la base ya corregida; los cambios posteriores del ejecutor y documentación no alteran el código de aplicación. El merge y despliegue posteriores se identifican en el cierre Git del PR, sin reconstruir ni atribuir commits previos.

## Stack efectivo y justificación

Versiones verificadas en package-lock: Next.js 16.2.0, React 19.2.4, TypeScript 5.9.3, @supabase/ssr 0.12.7, @supabase/supabase-js 2.118.0, Tailwind CSS 4.2.2 y Jest 30.3.0. Node local v22.23.1, gestor npm. SCSS/Gulp conserva los estilos existentes. No se cambió el framework, navegación ni identidad visual.

App Router y rutas API utilizan features/appointments para contratos, validación y servicio. SupabaseAppointmentRepository consulta tablas reales mediante PostgREST. Los arrays usados como dobles de pruebas no sustituyen la persistencia de producción. La sesión SSR se valida con auth.getUser y los permisos provienen de app_metadata. La aplicación no usa service_role. RLS y RPC aplican autorización también en PostgreSQL.

La combinación comparte tipos entre frontend y API, mantiene las convenciones existentes y reduce trabajo de infraestructura. PostgreSQL aporta integridad, intervalos, concurrencia y transacciones; Supabase integra Auth y PostgREST. Los índices y límites de consultas apoyan escalabilidad, pero no equivalen a certificar rendimiento bajo carga. Se utilizó el plan gratuito mostrado en el panel sin contratar ampliaciones ni afirmar precios o cuotas no comprobados.

GitHub Actions mantiene npm ci y npm run verify; TAR05 añade un job con PostgreSQL aislado. El script y verify también aprobaron en GitHub Actions, corrida 42180958553: verify 1m32s y database 12s. Evidencia github-actions-verificado.json. La revisión final del PR se controla con sus checks actuales. La infraestructura pg_cron/pg_net/Vault sí se creó ahora en Supabase: el catálogo confirma fhf-reminder-dispatch con active=false. No se habilitaron envíos ni se trasladaron secretos VAPID privados al proyecto nuevo.

## C. Matriz RF-01 a RF-06

RF-01 Registrar. Archivos: service.ts, validation.ts, supabase-repository.ts, API citas/route.ts y AppointmentForm.tsx. Pruebas appointments.sql y tar05-integrity.sql: alta válida, FK y duración. Resultado: SQL local y remoto PASS; Jest PASS. Alta UI en producción con usuario normal: PASS escritorio y móvil (capturas 01-registro).

RF-02 Consultar. Archivos: servicio, adaptador, AppointmentAgenda.tsx y AppointmentList.tsx. appointments.sql y appointment-actions.sql comprueban lecturas con permisos y relaciones. Resultado: SQL local/remoto y Jest PASS. El acceso público no expone pacientes ni citas. Recarga de detalle con nombre real del fixture y estado persistido: PASS escritorio/móvil (capturas 02-detalle-recargado).

RF-03 Reprogramar. API citas/[id], RPC reschedule_appointment, servicio y AppointmentActionDialog.tsx. appointment-actions.sql: modificación válida, versión obsoleta, conflicto y rechazo de cita cancelada. Resultado: SQL local/remoto y Jest PASS. Acción UI autenticada en producción: PASS escritorio/móvil (capturas de reprogramación y cancelación).

RF-04 Cancelar. RPC cancel_appointment, servicio y diálogo. appointment-actions.sql: conserva fila e historial, libera horario e impide duplicar efectos de la cancelación repetida. Resultado: SQL local/remoto y Jest PASS. Acción UI autenticada en producción: PASS escritorio/móvil (capturas de reprogramación y cancelación).

RF-05 Traslapes. availability.ts, adaptador, EXCLUDE appointments_no_overlap y trigger de bloqueos. appointments.sql prueba mismo médico rechazado y médicos diferentes aceptados; el ejecutor local prueba dos conexiones concurrentes. Resultado: integridad SQL local/remota PASS; concurrencia local PASS. Cinco carreras REST remotas con JWT normal: un ganador y SQLSTATE 23P01; médico diferente aceptado. Carrera bloqueo/reserva remota: un solo ganador. PASS.

RF-06 Confirmar. RPC confirm_appointment y acciones. appointment-actions.sql y null-role.sql: estado guardado, cancelada rechazada, permisos y rol ausente rechazado. Resultado: SQL local/remoto y Jest PASS. Confirmación UI y estado confirmed/confirmedAt tras recargar: PASS escritorio/móvil (capturas 04-confirmada-recargada).

Pruebas SQL remotas: supabase-pruebas-reales.txt. Mismos scripts versionados en supabase/tests. Pruebas locales: verificacion-bd-reproducible.log y validacion-conexion-nueva.log. Las capturas PRY05 continúan como evidencia histórica; no se recuentan como una ejecución autenticada nueva TAR05.

## D. Base de datos remota y conexiones

Destino autorizado y creado: fhf-salud-tar05, organización Pollo, referencia oafwyfntjddrtjoqkktf, PostgreSQL 17.11 aarch64. La consulta previa a pg_tables devolvió [] para public y supabase_migrations. No se sobrescribieron datos de aplicación. El proyecto genérico sbsfivqpdkgapwhyqbkb quedó intacto; el original hvrkrycxbrnqpvyywpql continúa pausado.

Modelo físico de cinco entidades: patients (PK UUID, display_name no vacío, active, created_at); physicians (identidad mínima equivalente); appointments (PK UUID, FK patient_id/physician_id con RESTRICT, starts_at, ends_at, duration_minutes, reason, status y metadatos de estados); appointment_events (PK bigint identity, FK appointment_id RESTRICT, tipo, valores anteriores/nuevos, actor y fecha); physician_schedule_blocks (PK UUID, FK physician_id RESTRICT, intervalo con zona horaria, motivo y created_at).

Relaciones: patients 1:N appointments; physicians 1:N appointments; appointments 1:N appointment_events; physicians 1:N physician_schedule_blocks. Identidades, reservas, eventos y ausencias tienen funciones separadas; ends_at y los valores históricos son redundancias controladas por triggers. No se agregaron expedientes, diagnósticos, recetas ni tratamientos ni se utilizaron cascadas destructivas para historial.

Restricciones: NOT NULL, PK, FK, CHECK de estados pending/confirmed/cancelled, duración 15/30/45/60, texto no vacío e intervalos positivos. EXCLUDE sobre rango semiabierto [inicio,fin) impide traslapes del mismo médico y permite citas contiguas. Canceladas no bloquean horario. El trigger de ausencias comparte bloqueo de la fila physicians con reservas; la carrera se verificó localmente.

Las cinco tablas tienen RLS true. Admin/recepción operan agenda y médicos consultan su agenda; cuentas sin rol no acceden. No hay UPDATE/DELETE directo de citas para authenticated. RPC validan usuario, rol, estado y versión, bloquean fila y registran eventos. Los bloqueos tienen políticas administrativas y lectura del médico correspondiente. No hay interfaz nueva de gestión de ausencias.

Migraciones aplicadas y confirmadas en supabase_migrations.schema_migrations: 202610250001 reminder_infrastructure; 202610250002 appointments; 202610260001 citas_medicas_schema (comprobación de compatibilidad); 202610260003 appointment_actions; 202611060001 authorization_null_role; 202611060002 physician_schedule_blocks. La ejecución se hizo desde SQL Editor con el contenido versionado y registro dentro de la transacción, no mediante un db push ficticio. Después se habilitó RLS y se revocó acceso de public/anon/authenticated al ledger.

El catálogo remoto documenta 21 restricciones, las políticas y la limpieza tras las suites: cero patients, physicians, appointments, events y blocks de prueba. Evidencias: supabase-migraciones.txt, supabase-catalogo-inicial.txt, supabase-catalogo-verificado.txt y catalogo-remoto-verificacion.sql. El job de recordatorios quedó inactivo.

.env.local contiene la URL nueva y la clave sb_publishable del mismo proyecto. Se respaldó antes de editar y sigue ignorado por Git. Vercel tiene valores idénticos en All Environments; vercel-configuracion-verificada.json registra igualdad y huellas, sin valores. No se añadieron claves privadas o service_role al frontend. .env conserva su configuración existente: las variables de Supabase del proyecto viven en .env.local.

## E. Ejecución y resultados

npm ci y npm run verify: PASS en el corte local. npm run verify se volvió a ejecutar con la conexión nueva: lint estricto, typecheck, 75 Jest, 8 Python, 4 Node y build PASS. Los subproductos generados de sitemap y sourcemap se restauraron para no introducir ruido. Archivo: validacion-conexion-nueva.log.

Cuatro suites SQL ejecutadas en Supabase real: appointments.sql, appointment-actions.sql, null-role.sql y tar05-integrity.sql. Resultado observado final: PASS: cuatro suites SQL en Supabase remoto. Comprueban inserciones válidas, PK duplicadas, referencias inexistentes, estado y duración inválidos, traslapes, médicos distintos, cancelación/historial/liberación, idempotencia, versión y RLS. Se usan datos ficticios y ROLLBACK. El catálogo posterior confirmó limpieza.

Las pruebas remotas usan una conexión administrativa para preparar datos, seguida de SET LOCAL ROLE authenticated y claims de admin/médico/sin rol. Esto comprueba autorización SQL bajo permisos normales. Adicionalmente, el E2E final inició sesión mediante el formulario real y Auth emitió JWT normales; las APIs de la app y las consultas REST se probaron con esos permisos, sin service_role. La concurrencia remota se ejecutó cinco veces para reservas y una vez para bloqueo/reserva, con Promise.all y comprobación de errores 23P01.

npm run supabase:check con la configuración nueva: Auth HTTP 200. Comprobación adicional: /auth/v1/settings 200; /rest/v1/patients y /rest/v1/appointments con clave publicable sin sesión responden 401. No se interpretó ese rechazo como base vacía ni como falla de conexión: es el resultado esperado para datos protegidos.

Publicación verificada: redespliegue Vercel EX5SY1JEiqqWExEFgs6YyfzeG23c aparece Ready. El dominio de producción responde 200; vercel-bundle-verificado.json confirma dominio nuevo presente, antiguo ausente y clave coincidente con .env.local. La configuración guardada se verificó mediante UI sin extraer credenciales de sesión.

Las capturas iniciales Playwright de escritorio/tablet/móvil, foco visible y movimiento reducido se conservan como evidencia histórica local sin sesión. Las 12 capturas finales del directorio e2e-tar05-1793949455394 muestran producción autenticada, registros y estados reales del fixture. La revisión actual de producción terminó en Playwright: escritorio 1440x1000 y móvil 390x844, API 401, mensaje de sesión requerido, formulario de acceso presente y sin overflow. Evidencia: produccion-playwright.json y capturas produccion-1440.png/produccion-390.png. El flujo autenticado final sí aprobó. No se certifica una auditoría completa de contraste ni Axe; no se añadió una dependencia de accesibilidad para suplir esa ausencia.

## F. Auditoría crítica de IA

El equipo declara uso de Codex y DeepSeek para planteamiento, elaboración, revisión, depuración y pruebas. Esta auditoría utilizó Codex y herramientas reales. No hay evidencia suficiente para atribuir un defecto previo a una IA específica; los problemas se describen como deficiencias reales de código detectadas mediante auditoría asistida.

Defecto 1: 202610260001 recreaba patients/physicians/appointments con scheduled_at y políticas incompatibles con el adaptador starts_at/ends_at. Se reprodujo ERROR relation patients already exists. Riesgo: instalación rota y contrato incoherente. Se conservó el original en docs/sql-historico y se cambió el paso a una comprobación de compatibilidad. La secuencia completa aprobó en contenedor nuevo y en Supabase. Commit de origen: 7963f97; corrección: 0bf31a3.

Defecto 2: IF appointment_role() NOT IN (...) no rechaza NULL en una función SECURITY DEFINER. La reproducción con authenticated sin rol alcanzó la búsqueda de una cita, devolviendo “La cita no existe” en vez de 42501. Se corrigieron las tres RPC con COALESCE mediante migración posterior 202611060001. null-role.sql exige insufficient_privilege en las tres; PASS local y remoto. Origen: 77bd031; corrección: 0bf31a3. Evidencias antes/después conservadas.

Defecto 3: documentación decía que el borrador de Emilio no estaba integrado y el quinto autor seguía pendiente. El grafo demuestra que e5299b5 incorpora la rama y ef8a8bf pertenece a Manuel Alvarez. Se corrigieron README y docs/demostracion sin cambiar identidades ni historial.

Durante la operación de herramientas hubo una escritura demasiado lenta en SQL Editor; al detenerla se cerró por error la sesión de incógnito. El usuario volvió a autenticar. No se presentó la escritura parcial como prueba ejecutada ni se repitió destructivamente el bootstrap. En la sesión recuperada se completaron las suites y las verificaciones. La verificación MFA de Vercel fue realizada por el usuario directamente, sin recopilar códigos.

El escaneo acotado de archivos versionados no encontró patrones de claves privadas/JWT; no equivale a un pentest integral ni a certificar todo el historial. No se alteraron configuraciones de proxies, DeepSeek, VNAI, Codex ni otros servicios. No se imprimieron valores de credenciales y los archivos privados permanecen fuera de Git.

## G. Archivos generados

Migraciones y pruebas permanecen en supabase/migrations y supabase/tests. Ejecutor reproducible local: scripts/tar05/verify-database.py; auth-bootstrap.sql es EXCLUSIVO de contenedor local, nunca de Supabase. Generador SQL inicial remoto: scripts/tar05/generate-remote-bootstrap.py. El bootstrap rechaza proyectos no vacíos y no debe repetirse sobre la base instalada.

Evidencias y consultas: evidencias/TAR05; informe inicial archivado: INFORME-CORTE-LOCAL.md; actualización cronológica: CONTINUACION-REMOTA.md. Informe actual: INFORME.md; PDF: TAR05-Amarillo.pdf; generador: scripts/tar05/build-report.py. El manifiesto SHA-256 se actualiza después de generar los artefactos.

No se encontró TAR05 previo con portada, declaración o firmas en el directorio académico. No se inventaron firmas ni identidades legales; los nombres de portada proceden de Git. PRY05-Equipo.pdf permanece intacto.

## H. Cierre y límites de entrega

Los requisitos técnicos de base física, integridad, RLS, RF-01 a RF-06, persistencia y concurrencia remota quedaron comprobados. Se eliminaron únicamente las cuentas y registros ficticios con UUID y marcador de corrida; el catálogo posterior confirmó cero pacientes, médicos, citas, eventos y bloqueos. No se dejó una cuenta de prueba activa ni se enviaron correos. La agenda queda vacía hasta el aprovisionamiento de usuarios y referencias reales por el responsable.

El ejecutor necesitó correcciones de prueba: esperar hidratación de React antes de enviar el login y elegir una cita cuyo physicianId perteneciera al otro médico, en vez de usar el último ID de una lista que también incluía una carrera del propio médico. La ejecución intermedia local-con-supabase-real se conserva como diagnóstico FAIL; no se suma a los 26 PASS finales de producción. No fue necesario cambiar autenticación, lógica de negocio ni consultas para que el E2E aprobara.

La rama publicada y PR #2 conservan las correcciones y evidencias. Los checks de la revisión final y el eventual merge/despliegue se comprueban en GitHub y Vercel. No hay pendientes de acceso o ejecución E2E. La única limitación documental externa sigue siendo la ausencia de un TAR05 original con portada y firmas: no se inventaron ni generaron firmas. Si existe fuera del entorno, debe integrarse conservándolo antes de la entrega académica.

El job de recordatorios permanece inactivo por diseño, fuera del alcance de RF-01 a RF-06. No se afirma una auditoría de penetración integral, de carga a gran escala ni de módulos no solicitados. El corte local y las notas cronológicas anteriores son históricos; este documento y el resultado final E2E contienen el estado vigente.
