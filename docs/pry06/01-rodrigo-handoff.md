# Traspaso Prompt 1 · Rodrigo Ruiz Aguilar

## Identificadores y estado

Base oficial y HEAD inicial: `474acf0bff4be32c094f711227f725dda83a106d`.
Commit de implementación y pruebas: `9b9b2413d150a3b34294353f8b77719289dd0ddd`.
Rama publicada: `feature/pry06-arquitectura-pacientes` en
https://github.com/Vo1dScripter/FHF-Salud/tree/feature/pry06-arquitectura-pacientes.
El commit posterior de documentación/evidencia se consulta con `git log -1`.

PR: pendiente de creación autenticada. El push SSH está confirmado, pero GitHub
CLI no tiene sesión y no hay navegador conectado. Enlace de creación (NO es un PR
existente): https://github.com/Vo1dScripter/FHF-Salud/pull/new/feature/pry06-arquitectura-pacientes.
Descripción lista: [pr-description.md](pr-description.md).
Revisor asignado: ninguno. Propuesto: Manuel (`Maquendo2512`, cuenta identificada
mediante el commit ef8a8bf); Emilio es la primera opción si confirma su usuario.
No existe revisión aprobada ni merge acreditado de esta entrega. No basar las ramas
del equipo en esta versión hasta cumplir ambos. La condición completa del Prompt 1
sigue pendiente de ese paso humano; no se simula ni se autoaprueba.

## Reproducción desde copia propia

```bash
git remote -v
git status --short --branch
git fetch origin --prune
git log -5 --oneline origin/main
# origin debe ser Vo1dScripter/FHF-Salud; preservar cualquier cambio antes de seguir.
# Para revisar esta entrega, usar una copia limpia o worktree de revisión:
git worktree add ../fhf-pry06-review origin/feature/pry06-arquitectura-pacientes
cd ../fhf-pry06-review
npm ci
npm run test:patients
npm run verify
python3 scripts/tar05/verify-database.py
# Requiere podman e imagen docker.io/library/postgres:17-alpine.
```

Para verificar presentación sin emplear configuración remota, construir y arrancar
con variables explícitamente vacías (Next incorpora NEXT*PUBLIC*\* al construir):

```bash
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run build
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run start -- -p 3106
# En otra terminal, con Playwright ya instalado:
PLAYWRIGHT_MODULE_PATH="$(npm root -g)/@playwright/cli/node_modules/playwright/index.mjs" \
node scripts/pry06/verify-ui.mjs
```

El script solo admite origen localhost/127.0.0.1/::1; no producción. Usa fixtures
de red exclusivamente dentro del navegador de pruebas, nunca como fallback de la
aplicación. Reescribe solo evidencia PRY06 de esta corrida. Requiere Chromium de la
instalación de Playwright. El puerto puede cambiar con PRY06_BASE_URL.

Demostración manual: abrir `/` → «Pacientes» (menú en móvil) → estado explícito de
configuración ausente. Con una sesión normal médica y configuración pública de un
entorno de prueba autorizado, `/pacientes` consulta pacientes por RLS. Buscar por
nombre, paginar, limpiar y volver a Citas. Sin sesión: 401 con acceso existente;
recepción/admin: 403; médico sin fila activa: 403. El alta y el historial no están
habilitados. No se requiere ni se debe usar clave administrativa en la app.

## Resultados auténticos

| Comprobación                                      | Resultado local                                                               |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| npm run verify (final, variables públicas vacías) | PASS: lint estricto, tipos, 122 Jest, 8 multimedia, 4 infraestructura y build |
| npm run test:patients                             | PASS: 47 pruebas en cinco suites                                              |
| python3 scripts/tar05/verify-database.py          | PASS: cinco migraciones médicas, cinco suites SQL y dos carreras              |
| scripts/pry06/verify-ui.mjs                       | PASS: 27 comprobaciones en escritorio/tableta/móvil; fixtures UI + 503 real   |
| Contraste Buscar, claro/oscuro                    | PASS: 4.71:1 / 4.66:1; alcance puntual, sin auditoría WCAG completa           |
| npm run supabase:check con variables vacías       | Exit 1 esperado: configuración ausente; no valida remoto                      |
| git diff --check                                  | PASS                                                                          |
| CI GitHub                                         | Pendiente apertura del PR; no confundir checks locales con ejecución remota   |
| E2E autenticado en Supabase/Vercel                | No ejecutado: reservado Prompt 6; TAR05 es evidencia histórica distinta       |

Runtime usado: Node 26.13.0, Python 3.14.10; CI conserva Node 24/Python 3.12.
Evidencia: [logs y capturas](../../evidencias/PRY06/01-rodrigo/README.md).

La primera verificación detectó un error de tipos en una opción de test y un aviso
lint de console.log del ejecutor; ambos fueron corregidos. En navegador se ajustó
el selector de alert para excluir el anunciador de Next y la consulta del enlace
oculto del menú cerrado. Una transición de paginación mostraba brevemente datos
anteriores: ahora se retiran al iniciar la acción y se prueba que una respuesta
obsoleta abortada no reaparece. Los logs finales corresponden a esas correcciones.

## Archivos exactos de implementación y pruebas

- `.github/workflows/verify.yml`
- `package.json`
- `scripts/pry06/verify-ui.mjs`
- `src/__tests__/patients/PatientDirectory.test.tsx`
- `src/app/api/pacientes/route.ts`
- `src/app/components/index/Header.tsx`
- `src/app/components/patients/PatientDirectory.tsx`
- `src/app/pacientes/layout.tsx`
- `src/app/pacientes/page.tsx`
- `src/features/patients/__tests__/contracts.test.ts`
- `src/features/patients/__tests__/repository.test.ts`
- `src/features/patients/contracts.ts`
- `src/features/patients/errors.ts`
- `src/features/patients/index.ts`
- `src/features/patients/service.ts`
- `src/features/patients/supabase-repository.ts`
- `src/features/patients/validation.ts`
- `src/lib/patients/__tests__/route.test.ts`
- `src/lib/patients/__tests__/server.test.ts`
- `src/lib/patients/server.ts`
- `src/proxy.ts`
- `supabase/tests/pry06-patients.sql`

## Documentación y evidencia

- `README.md`
- `docs/citas-implementacion.md`
- `docs/pry06/contratos-y-plan.md`
- `docs/pry06/01-rodrigo-handoff.md`
- `docs/pry06/pr-description.md`

- `evidencias/PRY06/01-rodrigo/README.md`, `verify.log`, `database.log`,
  `contrast.log`, `ui-results.json`, `SHA256SUMS` y 30 PNG listados en ese directorio
  (nueve estados/temas de Pacientes y una captura de retorno a Citas por viewport).

Los artefactos regenerados por build `src/styles/app.css.map` y
`public/sitemap-0.xml` se restauraron a su contenido previo para no incluir cambios
de caché/timestamps ajenos al alcance. Se preservaron la eliminación staged del
PDF TAR05 y los directorios locales preexistentes, excluidos de estos commits.

## Pendientes y secuencia de integración

1. Autenticar GitHub CLI en esta cuenta, abrir PR a main y pedir revisión real.
   No compartir tokens ni usar credenciales de compañeros. Comando preparado:
   `gh pr create --repo Vo1dScripter/FHF-Salud --base main --head feature/pry06-arquitectura-pacientes --title "feat: integrar consulta protegida de pacientes para PRY06" --body-file docs/pry06/pr-description.md`.
2. Solicitar revisión a un compañero con cuenta confirmada, por ejemplo Manuel;
   registrar URL, cuenta, revisión, checks remotos y merge real en este handoff.
3. Emilio/Yaird: acordar asociación médico-paciente y alta transaccional. RLS actual
   depende de citas y no resuelve un expediente nuevo sin cita.
4. Emilio/Jesús: acordar esquema clínico y auditoría versionada con fecha e identidad
   del servidor; integrar sus PR y control de concurrencia antes de habilitar edición.
5. Manuel: completar negativos y Happy Path integrado con cuenta normal y BD.
6. Rodrigo, Prompt 6: respaldo y acciones protegidas; no se aplicaron migraciones,
   cambios administrativos ni despliegues desde esta entrega.

Contratos, responsables, estados y distinción RF-08/RF-13–16:
[contratos-y-plan.md](contratos-y-plan.md). RF-07 a RF-12 no se declaran terminados.
