# PRY07 · Base E2E y coordinación del equipo

## Base compartida

La intervención de Rodrigo parte de `origin/main` en `474acf0`, el merge del [PR #2 de TAR05](https://github.com/Vo1dScripter/FHF-Salud/pull/2). El trabajo local preexistente se conservó en su directorio original. La rama candidata de PRY06 está en `c77e36e`. El [PR #11](https://github.com/Vo1dScripter/FHF-Salud/pull/11) sigue abierto, con revisión solicitada a Manuel y sin aprobación. El [PR #5](https://github.com/Vo1dScripter/FHF-Salud/pull/5) tiene una aprobación de Rodrigo y sigue abierto.

| Alcance       | Evidencia en la base                                                                                                                                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RF-01 a RF-06 | `/citas`, `/citas/nueva`, `/citas/acceso`, detalle `/citas/[id]`, API de citas y SQL están en `main`. Registro, agenda, traslape y permisos se prueban en navegador en esta intervención. Reprogramación, cancelación y confirmación se comprueban mediante las suites existentes de acciones, sin repetirlas en el nuevo E2E. |
| RF-07 a RF-12 | Las rutas `/pacientes` y `/pacientes/[id]`, las API de pacientes/expediente y las migraciones clínicas están en la candidata #11. Quedan pendientes de integración en `main`. El E2E de esta rama se limita a citas.                                                                                                           |

La base usa Next.js 16.2.0, React 19.2.4, Supabase JS 2.118.0 y Jest 30.3.0 según la instalación de `package-lock.json`. Las APIs validan la sesión con Auth y aplican reglas de negocio y RLS en PostgreSQL. La prueba TAR05 usaba un proyecto remoto y credenciales preparadas previamente. Se reutilizaron sus selectores, rutas, bootstrap de roles y flujo de compilación para una ejecución local.

## Ejecutar la base local

Requisitos: Git, Node 24 como en CI, Python 3.12 o superior, Podman o Docker disponibles y Chromium de Playwright. El runner usa `fcntl` y se ejecuta en Linux, macOS o WSL con el motor de contenedores configurado. Se usa acceso a los registros de paquetes e imágenes al preparar dependencias.

```bash
npm ci
npm run verify
python3 scripts/tar05/verify-database.py

export PLAYWRIGHT_PREFIX="$(mktemp -d)"
npm install --prefix "$PLAYWRIGHT_PREFIX" --no-audit --no-fund playwright@1.65.1
"$PLAYWRIGHT_PREFIX/node_modules/.bin/playwright" install chromium

export PLAYWRIGHT_MODULE_PATH="$PLAYWRIGHT_PREFIX/node_modules/playwright/index.mjs"
export PRY07_E2E_OUTPUT="$(mktemp -d)/evidencia"
python3 -u scripts/pry07/local-e2e.py
```

Docker: usar `CONTAINER_ENGINE=docker` para las dos pruebas con contenedores. Si Chromium requiere librerías de sistema, el workflow ejecuta la instalación con `--with-deps`. Una instalación de Chromium compatible ya disponible puede indicarse con `PRY07_CHROMIUM_PATH`. El directorio de salida debe ser nuevo.

Cada corrida crea una red y tres contenedores efímeros (PostgreSQL 17, GoTrue 2.177 y PostgREST 13.0.4). Auth y PostgREST publican puertos dinámicos de loopback. La aplicación se compila con URL y clave pública exclusivamente locales. El gateway adapta la clave pública al JWT anónimo del entorno y preserva el JWT emitido al iniciar sesión. PostgREST usa un rol de conexión sin superusuario. La migración de notificaciones depende de extensiones administradas y se omite explícitamente en este entorno.

El runner genera UUID y contraseñas de prueba por corrida y prepara un paciente, un médico y tres cuentas confirmadas: `receptionist`, `physician` y `unassigned`. El fichero privado de fixtures se pasa por `PRY07_FIXTURES`, el origen local por `PRY07_BASE_URL` y los reportes por `PRY07_E2E_OUTPUT`. Al terminar se retiran los contenedores, la red, el proceso y el fichero privado, también ante un error de prueba. Cada corrida tiene su propia BD y dos ventanas de cita distintas. Usar un checkout por ejecución paralela, porque Next comparte la carpeta de compilación. Las capturas se toman después de la autenticación, con registros ficticios.

Para probar otro recorrido, definir `PRY07_E2E_SCRIPT` con la ruta a un script del checkout. Leer el fixture privado dentro del proceso y conservar en la evidencia solo estados, identificadores ficticios y capturas sin datos de acceso. Usar tiempos de cita distintos cuando un solo escenario cree varias reservas. En CI el job `e2e` ejecuta el mismo runner y publica los artefactos sin requerir secretos del proyecto.

## Actualización · E2E clínico

El recorrido clínico ya está implementado y ejecutado en
`feature/pry07-e2e-historial-clinico` (PR #15), apilado sobre el PR #11. El
resultado real, los defectos corregidos y las limitaciones están en
[02-historial-clinico.md](02-historial-clinico.md) y
`evidencias/PRY07/01-jesus/`. Este documento conserva el estado de la base de
citas; no implica que PRY06 esté fusionado en `main`.

## Traspaso a los prompts 2–5

| Integrante                      | Entorno y recorrido                                                                                                                                                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Emilio · BD y seguridad         | Ejecutar suites SQL, verificar migraciones, roles y RLS. Cubrir traslapes y carreras, además de acceso clínico cuando estén disponibles las migraciones del PR #11. Usar una BD desechable por corrida.                                       |
| Yaird · Citas y pacientes       | Extender el flujo de citas con reprogramación, confirmación y cancelación desde la UI. Al disponer de #11, probar alta, búsqueda y vinculación de la cita a un paciente creado durante la corrida.                                            |
| Jesús · Historial y permisos    | Usar una rama que contenga #11 o un checkout temporal para probar expediente. Cubrir autoría, fecha, revisión persistida tras recarga, denegación a recepción y a un médico sin vínculo. Preparar un segundo médico ficticio en su escenario. |
| Manuel · Regresión, UX y manual | Correr el flujo base en escritorio y móvil, comprobar navegación por teclado, feedback de error y persistencia tras recarga. Registrar navegador, viewport, commit y resultados. Incorporar las rutas clínicas cuando su base las contenga.   |

Para trabajar sobre rutas clínicas antes del merge, identificar el commit de #11 y la rama candidata usada. Publicar en ramas propias y describir la dependencia en el PR. Las cuentas, capturas y logs de otros compañeros se deben generar en su propio entorno. No enviar contraseñas ni almacenar sesiones del navegador. La revisión corresponde a otro integrante y se solicita en GitHub. La ejecución verde de CI y la aprobación humana son comprobaciones separadas.

## Resultados de la intervención

| Comando ejecutado                                  | Resultado                                                                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `npm ci` y `npm run verify`                        | Lint estricto, tipos y build correctos. 75 Jest, 8 multimedia y 4 integraciones de infraestructura aprobadas. Cero fallos. |
| `python3 -u scripts/tar05/verify-database.py`      | 5 migraciones de citas, 4 suites SQL y 2 carreras aprobadas. Cero fallos.                                                  |
| `python3 -m unittest discover -s scripts/pry07 -v` | 2 regresiones del ejecutor aprobadas. Cero fallos.                                                                         |
| `python3 -u scripts/pry07/local-e2e.py`            | 8 casos aprobados, 0 fallidos. Chromium a 1440 y 390 px. Limpieza concluida y verificada.                                  |

Los primeros intentos se interrumpieron durante la preparación. Se corrigió el sondeo de disponibilidad ante conexiones reiniciadas, la escritura del fixture con permisos 0600 y la limpieza de contenedores y volúmenes. Los tests del ejecutor cubren reintentos de disponibilidad y limpieza. La corrida final guardó la cita desde la interfaz, la encontró en la agenda y verificó su estado tras recargar el detalle. En ambos tamaños, verificó HTTP 409 por traslape, 401 sin sesión, 403 con sesión sin rol y un recuento sin cambios tras las solicitudes rechazadas.

Los reportes y las capturas están en `evidencias/PRY07/01-rodrigo`. Se conservaron las salidas de los comandos con normalización de espacios finales. Esta intervención dejó sin ejecutar el E2E clínico pendiente del PR #11, la migración de notificaciones administrada y las pruebas contra producción. GitHub informó que la protección clásica de `main` está desactivada. El PR publica un check E2E adicional, con revisión humana requerida por el procedimiento del equipo.
