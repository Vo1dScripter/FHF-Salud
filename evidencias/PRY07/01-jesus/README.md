# Evidencia PRY07 · historial clínico y permisos

Corrida de referencia: commit `5463638`, run
<https://github.com/Vo1dScripter/FHF-Salud/actions/runs/45925241586>.
Todos los datos usados son ficticios; no se incluyen credenciales, tokens,
sesiones ni datos médicos reales.

## Archivos y hashes

```text
13231933ab3dba7a99e62f3b9713a08320ccb047d13e859109ecd41726c3d151  e2e-ci-annotation.txt
fe5bbfbfbf9870dded1aa3a01d2957ae15c3c6c9a0b5addf9ff895c51407c02f  e2e-ci-run.json
7e73695aceeac4617de8b74a1b47c803d61a7e6bcd7a193998d89b27728c39df  verify-local.log
9db7785cebf6d20da38590083208d797805a8bedafe554276c98c687c08801c0  clinical-sql-local.log
247c97136fa4ade38d97dcba524337ec01a8abd7e62f069e32613f3a42cd1e96  harness-tests-local.log
```

## Qué contiene cada archivo

| Archivo                   | Origen                                                                                 | Resultado                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `e2e-ci-annotation.txt`   | Anotación pública del check `e2e` de GitHub Actions, obtenida por API tras la corrida. | 27 PASS: 8 citas, 12 clínicos (6 × 1440/390) y 7 negativos RF-12; SQL y limpieza PASS. |
| `e2e-ci-run.json`         | Metadatos del run, job y artefacto.                                                    | `e2e` = success; artefacto `pry07-e2e` (599 948 bytes).                                |
| `verify-local.log`        | `npm run verify` en Windows.                                                           | 206/206 Jest, 8/8 multimedia, 4/4 integraciones, lint, tipos y build PASS.             |
| `clinical-sql-local.log`  | Cuatro suites SQL sobre PostgreSQL 18.6 aislado.                                       | 4/4 suites PASS; incluye RLS, RPC, inmutabilidad y RF-12.                              |
| `harness-tests-local.log` | `python -m unittest discover -s scripts/pry07 -v`.                                     | 8/8 PASS.                                                                              |

## Reproducción

### CI

El workflow `.github/workflows/verify.yml` ejecuta `verify`, `database` y `e2e`.
El job `e2e` levanta PostgreSQL, GoTrue y PostgREST efímeros, compila Next,
ejecuta `scripts/pry07/appointments.mjs` y `scripts/pry07/clinical-history.mjs`,
verifica el resultado en SQL y publica el resumen en anotaciones. Para repetirlo,
hacer push a la rama del PR #15 o relanzar el workflow desde GitHub.

### SQL local sin contenedores

Con PostgreSQL 18 instalado y un clúster desechable:

```bash
initdb -D "$PGDATA" -U postgres -A trust
pg_ctl -D "$PGDATA" -o "-p 55432 -h 127.0.0.1" start
# Crear esquema auth y funciones de prueba (solo entorno local), aplicar
# supabase/migrations/*.sql excepto 202610250001_reminder_infrastructure.sql
# y ejecutar cada archivo de supabase/tests/ con psql -v ON_ERROR_STOP=1.
```

No aplicar `scripts/tar05/auth-bootstrap.sql` a Supabase ni a producción.

## Límites de la evidencia

- El E2E de navegador no se ejecutó en la computadora Windows de esta sesión
  porque no hay Docker, Podman ni WSL. Se ejecutó en CI (Linux + Docker).
- Las capturas y JSON del navegador están en el artefacto de Actions; su
  descarga requiere autenticación, por lo que no se versionan aquí.
- No se ejecutó nada contra Supabase/Vercel ni producción.
- No existe aprobación de otro integrante en el PR #15 a la fecha de esta
  evidencia.
