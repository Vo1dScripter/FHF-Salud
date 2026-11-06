# Actualización de evidencia remota

El estado actual está en INFORME.md. El índice original al final de este archivo
corresponde al corte local y conserva su contexto histórico.

| Archivos nuevos | Ejecución y resultado |
| --- | --- |
| supabase-migraciones.txt | SQL Editor: seis versiones verificadas; ledger protegido |
| supabase-pruebas-reales.txt | Cuatro suites versionadas: PASS en PostgreSQL remoto |
| supabase-catalogo-verificado.txt / .json | Catálogo: cinco tablas, 21 constraints, 10 políticas, RLS, limpieza y job inactivo |
| catalogo-remoto-verificacion.sql | Consulta real usada para la evidencia anterior |
| configuracion-local-nueva.json | URL nueva, huella de clave pública y respaldo; sin valores privados |
| vercel-actualizacion.log | Guardado de dos variables; VAPID preservado |
| vercel-configuracion-verificada.json | Lectura de UI posterior: iguales a .env.local y All Environments |
| vercel-bundle-verificado.json | Producción HTTP 200, dominio nuevo y clave coincidente; dominio antiguo ausente |
| vercel-redespliegue.json | Dashboard: redespliegue de main Ready en producción |
| supabase-conexion-publica-verificada.json | Auth 200 y tablas protegidas sin sesión 401 |
| validacion-conexion-nueva.log | npm run verify con entorno nuevo: PASS |
| produccion-playwright.json y produccion-1440.png / produccion-390.png | Playwright real de producción, escritorio/móvil, 401 esperado y sin overflow |
| INFORME-CORTE-LOCAL.md y CONTINUACION-REMOTA.md | Cortes históricos, no estado final |

La evidencia SQL remota usa SET ROLE y claims de prueba. No acredita login real
ni concurrencia remota. No contiene contraseñas, cookies ni claves privadas.

# Índice de evidencia TAR05

Todas las capturas son de la aplicación local real, sin sesión. Los logs SQL
son de PostgreSQL local real; ninguno acredita creación en Supabase remoto.

| Archivos | Cómo se obtuvo / comprobación | Resultado |
| --- | --- | --- |
| INFORME.md y TAR05-Amarillo.pdf | Auditoría del código, Git, SQL y pruebas; PDF desde build-report.py | Entrega parcial explícita, remoto bloqueado |
| historial-git.txt | git log oficial/main --name-only con hash/autor/fecha | Cinco áreas trazables y archivos por commit |
| ramas.txt | git branch -avv tras fetch | main y feature/base-datos-citas; rama TAR05 |
| estructura-inicial.txt | git ls-tree -r oficial/main | Árbol remoto inicial verificable |
| versiones.json | package-lock.json y process.version | Versiones efectivas, no supuestas |
| validacion-proyecto.log | npm run verify tras npm ci | Lint, tipos, 75 Jest, 8 Python, 4 Node, build PASS |
| reproduccion-migracion-original.log | SQL original 202610260001 tras esquema canónico | Falla esperada: patients ya existe |
| reproduccion-rol-ausente.log | null-role.sql antes de la reparación | Falla esperada: entra a RPC sin rol y alcanza búsqueda |
| regresion-rol-ausente.log | Mismo SQL después de 202611060001 | Tres RPC rechazan con 42501 |
| postgres-local.log | psql -v ON_ERROR_STOP=1 con migraciones canónicas | Aplicación local de esquema y funciones |
| pruebas-appointments.log | supabase/tests/appointments.sql | Integridad y RLS PASS, ROLLBACK |
| pruebas-actions.log | supabase/tests/appointment-actions.sql | Estados, historial, versión y permisos PASS, ROLLBACK |
| pruebas-integridad.log | supabase/tests/tar05-integrity.sql | Cinco tablas, PK/FK/CHECK/bloqueos/RLS PASS |
| verificacion-bd-reproducible.log | python scripts/tar05/verify-database.py | Instalación limpia, cuatro suites, concurrencia y catálogo PASS |
| supabase-proyectos.log | npx supabase projects list | AccessTokenRequiredError |
| supabase-cli.log | npx supabase migration list sin vínculo remoto | Intentó stack local 54322 inexistente; NO es historial remoto |
| supabase-conectividad.json | dns.lookup y fetch a Auth/REST configurados | ENOTFOUND; no se obtuvieron respuestas ni datos remotos |
| consultas-remotas.sql | Consultas preparadas a catálogo, historial, políticas y conteos | Pendientes de ejecutar en destino confirmado |
| seguridad-secretos.json | Escaneo acotado de archivos versionados por patrones, sin valores | Cero coincidencias; no certifica todo el historial |
| citas-desktop.png y .yaml | Playwright, /citas, 1440x1000 | Estado sin sesión visible |
| citas-mobile.png y .yaml | Playwright, /citas, 390x844 | Estado sin sesión; ancho contenido 390 |
| citas-tablet.png | Playwright, 768x1024 | Estado sin sesión con movimiento reducido |
| acceso-mobile.png | Playwright, /citas/acceso, 390x844 | Formulario real sin credenciales |
| citas-reduced-motion.png y reduced-motion.log | page.emulateMedia reducedMotion reduce | Media query activa y sin desbordamiento |
| api-sin-sesion.log | fetch /api/citas desde navegador | 401 esperado, ningún dato médico |
| teclado.log | Tab y document.activeElement | Enlace FHF Salud con outline solid |

Reproducción BD: ver README. La prueba usa claims sintéticos con SET ROLE;
no afirma un login GoTrue real. Las capturas históricas PRY05 no se recuentan
como pruebas actuales TAR05. Los datos ficticios se revierten o se eliminan
con el contenedor efímero; jamás se borran datos de otros usuarios.
