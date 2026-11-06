# Cierre E2E real de TAR05

Estado actual: **26 comprobaciones PASS en producción y Supabase real**.
Corrida `tar05-1793949455394`, con login de usuarios normales de recepción,
médico y sin rol. Cinco carreras reserva/reserva y una bloqueo/reserva aprobaron.
Resultados y capturas: `evidencias/TAR05/e2e-tar05-1793949455394/`.
Limpieza verificada: `e2e-limpieza-remota.txt` y `e2e-catalogo-final.txt`; se
eliminaron las tres cuentas y todos los registros ficticios.

Los archivos locales privados de la corrida anterior ya no representan cuentas
activas. Para repetir, crear una corrida nueva y aprovisionar nuevas cuentas;
no reutilizar credenciales de cuentas eliminadas.

El ejecutor utiliza la aplicación desplegada, Supabase Auth real, PostgREST real
y cuentas normales. No intercepta peticiones, no sustituye datos y no utiliza
service_role. No modifica consultas, autenticación ni lógica de producción.

## Preparación administrativa

```bash
node scripts/tar05/prepare-e2e.mjs
```

Esto solo crea `.demo-local/tar05-e2e/` (ignorado por Git): referencias con UUID
único, SQL de preparación y credenciales ficticias en `credentials.json` con
permisos 0600. No imprime las contraseñas. Si ya existe ese archivo, se detiene
sin sobrescribirlo. Para otra corrida, pasar un directorio distinto dentro de
`.demo-local/`.

En Supabase del proyecto indicado, usar **Authentication > Users > Create user**
para crear las tres cuentas ficticias definidas en ese archivo, con confirmación
directa y sin enviar invitaciones ni correos. No se deben copiar contraseñas al
chat, consola ni documentación. Después ejecutar el `seed.sql` generado en el
SQL Editor autorizado. Asigna roles mediante app_metadata y exige que existan
las tres cuentas; si falta alguna, revierte su transacción. Nunca aplicar
`scripts/tar05/auth-bootstrap.sql` a Supabase: pertenece al contenedor local.

## Ejecución con el runtime Playwright existente

Requiere Node, dependencias del proyecto y Playwright (por ejemplo la instalación
existente de `@playwright/cli`). No se añadieron dependencias a la aplicación.

```bash
TAR05_E2E_CREDENTIALS_FILE=.demo-local/tar05-e2e/credentials.json \
PLAYWRIGHT_MODULE_PATH="$(npm root -g)/@playwright/cli/node_modules/playwright/index.mjs" \
node scripts/tar05/verify-e2e.mjs
```

Si Playwright está instalado localmente, puede omitirse PLAYWRIGHT_MODULE_PATH.
El destino por defecto es https://fhf-salud.vercel.app. Para validar una app local
contra la misma base real, usar TAR05_E2E_BASE_URL. El proyecto Supabase debe
coincidir con el fixture; no se hace fallback a otra base.

Comprobaciones previstas: login normal; alta UI; consulta y recarga; reprogramar
UI; confirmar UI y recargar; conflicto 409; cancelar UI, conservar fila y liberar
horario; rechazar confirmar cancelada; cinco carreras REST concurrentes con un
ganador y SQLSTATE 23P01; citas simultáneas con médicos distintos; carrera entre
bloqueo y reserva; eventos conservados; UPDATE directo prohibido; médico ve solo
su agenda y recibe 403 al mutar/404 al consultar cita ajena; cuenta sin rol recibe
403, cero filas RLS y 42501 al invocar RPC. El recorrido se repite a 1440x1000 y
390x844, este último con movimiento reducido, y comprueba overflow.

La evidencia se escribe en `evidencias/TAR05/e2e-<runId>/`, sin cookies, tokens,
contraseñas, HAR ni storageState. `complete` solo indica que las comprobaciones
terminaron; `cleanupRequired` obliga a realizar y registrar la limpieza antes de
cerrar la actividad. Una excepción produce FAIL de la fase actual y código 1.
La ausencia del archivo de credenciales termina con código 2 sin escribir datos.

## Limpieza del único fixture

```bash
node scripts/tar05/generate-e2e-cleanup.mjs
```

El comando solo genera SQL, no lo ejecuta. Revisarlo y aplicarlo en el proyecto
autorizado. Aborta si encuentra citas o bloqueos ajenos al marcador de la corrida;
usa UUID concretos y motivos del fixture. Borra los eventos de esas citas, luego
sus citas, bloqueos, referencias y exclusivamente las tres cuentas ficticias.
No elimina tablas, no desactiva RLS ni utiliza TRUNCATE o cascadas de agenda.
Guardar el resultado de los conteos finales en la evidencia: todos deben ser 0.

Después del PASS real y la limpieza, actualizar INFORME.md, el PDF y el manifiesto
SHA-256 con la ejecución nueva. No transformar las comprobaciones de sintaxis o
lint de estos scripts en evidencia de funcionamiento remoto.
