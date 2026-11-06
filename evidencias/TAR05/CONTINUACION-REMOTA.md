# Continuación remota TAR05 - 6 de noviembre de 2026

Esta nota actualiza el estado inicial de INFORME.md y del PDF, que describían
el bloqueo del proyecto antiguo. Se mantendrán como antecedentes hasta cerrar
la validación de la nueva conexión.

## Decisión y creación

El usuario autorizó usar la cuenta de incógnito y crear un proyecto nuevo para
FHF Salud. Se creó `fhf-salud-tar05` en la organización `Pollo` (plan Free),
referencia `oafwyfntjddrtjoqkktf`. No se reutilizó ni alteró el proyecto genérico
`sbsfivqpdkgapwhyqbkb`, ni se borró el antiguo FHF Salud.

Configuración de creación: Data API habilitada; exposición automática de nuevas
tablas desactivada; RLS automático habilitado. La contraseña fue generada en
Supabase y no se imprimió ni se registró en el repositorio.

Antes de aplicar: consulta pg_tables en public y supabase_migrations devolvió
`[]`. PostgreSQL remoto: 17.11, aarch64. No se afectaron datos previos de aplicación.

## Ejecución real comprobada

Se ejecutó en SQL Editor el SQL derivado de las seis migraciones versionadas,
con BEGIN/COMMIT y registro de versiones después de cada migración. Consulta
posterior confirmó:

- patients: RLS true.
- physicians: RLS true.
- appointments: RLS true.
- appointment_events: RLS true.
- physician_schedule_blocks: RLS true.
- Versiones: 202610250001, 202610250002, 202610260001, 202610260003,
  202611060001 y 202611060002.

Evidencia de esa consulta: supabase-catalogo-inicial.txt. Script preparado de
instalación: instalacion-remota.sql; generador: scripts/tar05/generate-remote-bootstrap.py.
No volver a ejecutar el bootstrap sobre una base ya poblada: contiene una
comprobación que lo rechaza. La variante preparada añade RLS/revocaciones
explícitas al ledger; su aplicación adicional todavía debe comprobarse.

## Límites actuales

No se completaron las suites SQL remotas, la concurrencia remota, Auth ni el
recorrido RF autenticado. La escritura lenta del editor se interrumpió antes
de ejecutar las pruebas. No se presenta esa entrada parcial como prueba PASS.

Al detener la escritura se cerró la última pestaña de incógnito por error del
agente, y la pestaña de reemplazo quedó en la cuenta normal. Se solicitó al
usuario abrir de nuevo la cuenta autorizada. Los objetos remotos creados no
se eliminaron. Hasta recuperar la sesión no se puede terminar la inspección.

La conexión local y las variables Vercel siguen en el proyecto antiguo; aún no
se obtuvieron ni aplicaron las claves públicas del nuevo proyecto. Ninguna
contraseña ni clave privada aparece en esta nota.

## Vercel y proyecto antiguo

El dashboard Vercel confirmó NEXT_PUBLIC_SUPABASE_URL,
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY y NEXT_PUBLIC_VAPID_PUBLIC_KEY para All
Environments. El despliegue de main e5299b5 aparece Ready en producción.
Las correcciones TAR05 locales todavía no están desplegadas.

El proyecto antiguo hvrkrycxbrnqpvyywpql está pausado. El intento de reanudarlo
fue rechazado por el límite de dos proyectos Free activos del propietario.
No se pausaron proyectos ajenos ni se contrató un plan de pago.
