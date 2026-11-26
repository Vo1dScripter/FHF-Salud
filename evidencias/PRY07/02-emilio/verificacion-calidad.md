# PRY07 · Emilio · Comprobaciones de calidad del proyecto

Fecha: 26 de noviembre de 2026 (UTC).

Estas comprobaciones se ejecutaron en el árbol de trabajo de
`feature/pry07-integridad-seguridad` después de instalar dependencias con
`npm.cmd ci`. No sustituyen la evidencia de base de datos, que está en
`resultados.json` y `verify-integrity-security.log`.

| Comando | Resultado observado | Estado |
| --- | --- | --- |
| `npm.cmd run lint:strict` | `eslint . --max-warnings=0` sin mensajes de error | PASS |
| `npm.cmd run typecheck` | `tsc --noEmit --incremental false` sin errores | PASS |
| `npm.cmd test -- --runInBand` | `Test Suites: 11 passed, 11 total` / `Tests: 75 passed, 75 total` | PASS |
| `python -m unittest discover -s tests -p "test_*.py"` | `Ran 8 tests in 0.771s` / `OK` | PASS |
| `npm.cmd run integrations:test` | `tests 4` / `pass 4` / `fail 0` | PASS |
| `npm.cmd run build` | Build de Next.js, `postbuild` y sitemap completados | PASS |

## Limitaciones reales del entorno

- `npm.cmd run img:test` invoca `python3`, que no existe en este Windows. Se
  ejecutó la misma suite con `python -m unittest discover -s tests -p "test_*.py"`
  y las 8 pruebas pasaron. El script del repositorio no se modificó.
- `python -m unittest discover -s scripts/pry07` no puede importar
  `local-e2e.py` en Windows porque usa el módulo `fcntl`, exclusivo de
  Linux/macOS. No se ejecutó localmente; el job `e2e` de GitHub Actions lo cubre
  en Ubuntu. No se alteró la prueba existente.
- `npm.cmd ci` mostró `husky` con `git command not found` porque Git no estaba
  en el PATH de ese proceso. No afecta a la instalación ni a las pruebas; los
  comandos de Git se ejecutaron con la ruta absoluta del ejecutable.

## Efectos secundarios del build, revertidos

`npm.cmd run build` regeneró `public/sitemap.xml`, `public/sitemap-0.xml`,
`public/robots.txt` y `src/styles/app.css`. Eran artefactos de compilación sin
relación con esta aportación, así que se restauraron con `git checkout --`
quedando idénticos al commit base. El diff final solo contiene archivos de
PRY07.
