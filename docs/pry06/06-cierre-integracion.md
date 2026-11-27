# PRY06 · Auditoría de la candidata de integración

**Equipo Amarillo · 25 de noviembre de 2026 · Responsable: Rodrigo Ruiz Aguilar**

## Estado de Git y procedencia

Se actualizó la información de `origin` por SSH y se consultaron los PR y sus revisiones en GitHub. El repositorio oficial es [Vo1dScripter/FHF-Salud](https://github.com/Vo1dScripter/FHF-Salud). La rama principal publicada y local partió de `474acf0` (TAR05, PR #2). El directorio original partió de `b562c1c`, sincronizado con `origin/feature/pry06-alta-paciente`. Su eliminación preparada de un PDF TAR05 y sus directorios sin seguimiento se conservaron. Se creó un worktree independiente con `feature/pry06-integracion-final`. La candidata incluye el historial publicado de los PR #3 a #10 y está publicada para revisión en el [PR #11](https://github.com/Vo1dScripter/FHF-Salud/pull/11).

| Integrante | Rama y punta publicada | Trabajo localizado | PR, revisión y estado |
| --- | --- | --- | --- |
| Rodrigo Ruiz Aguilar | `pry06-arquitectura-pacientes` · `3aad6cd` | `9b9b241` incorpora contratos, consulta protegida, endpoint, directorio y regresiones. El alta vinculada se incorporó posteriormente en `4e969fa` con autor de commit Codex y publicación desde la cuenta de Rodrigo. | [#3](https://github.com/Vo1dScripter/FHF-Salud/pull/3), Manuel solicitado. [#9](https://github.com/Vo1dScripter/FHF-Salud/pull/9), Emilio solicitado. Abiertos e incluidos en la candidata. |
| Emilio Martínez Hernández | `pry06-esquema-expedientes` · `c169206` | `3c1af77` y `2b13e65` aportan migraciones, RLS, RPC, pruebas SQL y exclusión de cita cancelada. `c169206` protege el rollback. | [#4](https://github.com/Vo1dScripter/FHF-Salud/pull/4), Rodrigo solicitado. Abierto e incluido. |
| Yaird Meyer Rodríguez | `pry06-registro-busqueda-pacientes` · `f3f74f0` | `026e55c` y `f3f74f0` incorporan por merge la arquitectura de Rodrigo y SQL de Emilio. Son los únicos commits de la rama atribuibles a Yaird. No se localizó implementación propia de alta o búsqueda en el remoto. | [#5](https://github.com/Vo1dScripter/FHF-Salud/pull/5), aprobado por Rodrigo sobre `f3f74f0`. Abierto e incluido. |
| Jesús Fuentes Avendaño | `pry06-historial-clinico` · `36956c9` | `3cef600` aporta interfaz, API, servicio, repositorio y pruebas de expediente y vínculo con citas. El traspaso registra 58 pruebas específicas del módulo. | [#6](https://github.com/Vo1dScripter/FHF-Salud/pull/6), Manuel solicitado. Abierto e incluido. |
| Manuel Álvarez Puentes | `pry06-pruebas-seguridad` · `e3f75c4` | `19dbf60` refuerza controles de RF-12 y pruebas Jest/SQL. `2730dc7` repara la cita cancelada ficticia del caso SQL. Su traspaso registra 200 pruebas Jest. | [#7](https://github.com/Vo1dScripter/FHF-Salud/pull/7), Rodrigo solicitado. Abierto e incluido. |

Todas las ramas publicadas anteriores llevan el prefijo `feature/`. Los [PR #8](https://github.com/Vo1dScripter/FHF-Salud/pull/8) y [#10](https://github.com/Vo1dScripter/FHF-Salud/pull/10) aportan conciliación de evidencia TAR05 (`3f32574`) y actualización de Next.js (`5727284`). Ambos fueron publicados por Rodrigo con autor de commit Codex y tienen revisión solicitada a Manuel. Los checks históricos por contribución están en [GitHub Actions](https://github.com/Vo1dScripter/FHF-Salud/actions). Los cinco heads de aportación pasaron CI. Existe una ejecución fallida de Manuel sobre `19dbf60`, seguida de una verde en `2730dc7`. La revisión solicitada en #11 corresponde a Manuel. Su aprobación es independiente de la emitida en #5.

## Alcance técnico

La aplicación conserva Next.js App Router, React y TypeScript, Supabase Auth (sesión SSR), PostgreSQL mediante PostgREST/RPC, Zod, Jest, Testing Library, Playwright y GitHub Actions, con alojamiento en Vercel. Las citas conservan transiciones de estado, historial, llaves foráneas y protección de traslape en la base. El alta invoca una RPC que escribe en una sola transacción paciente, vínculo médico y expediente. La búsqueda usa el directorio paginado bajo RLS. El historial carga el expediente por paciente y crea revisiones de contenido inmutables con autoría de sesión, fecha del servidor y control de revisión esperada. La cita puede referenciar al paciente que se acaba de registrar.

El alta revisada requería verificar también el UUID del expediente de la respuesta del servidor. El código ahora exige HTTP 201 y ambos identificadores antes de navegar. Una respuesta no JSON o sin confirmación del expediente deja el nombre en el formulario y muestra un mensaje recuperable. Se agregaron dos casos de regresión. La actualización de Zod reveló otra regresión: un texto clínico opcional omitido provocaba un error de validación y enmascaraba el conflicto de revisión. Se hizo explícita la admisión de valores ausentes y nulos, con normalización a null y un caso de regresión adicional.

El commit técnico de la candidata es `293f425`. GitHub confirmó los jobs verify y database exitosos y Vercel publicó el preview de ese commit. Los diagnósticos y tratamientos son campos de las revisiones. Los módulos clínicos independientes quedan fuera de esta entrega. El alta por nombre admite homónimos. La prevención de traslapes de citas está implementada en PostgreSQL. La edición de RF-11 corresponde al contenido clínico mediante una nueva revisión, conservando las anteriores.

## Verificación remota

Vercel confirmó producción `Ready`, ref `main` y commit `474acf0bff4be32c094f711227f725dda83a106d`. Inicio y agenda respondieron 200, API de citas sin sesión 401, ruta y API de pacientes 404. El proyecto asociado tiene las claves públicas requeridas de Supabase y VAPID configuradas en producción, preview y desarrollo. El contenido de esas variables se mantiene privado.

La configuración de la copia original identifica un destino Supabase cuya resolución DNS falló. El CLI de Supabase tampoco dispone de token administrativo. Por ello el catálogo, el libro de migraciones, los respaldos y la persistencia remota de PRY06 quedan bloqueados. Las cuatro migraciones clínicas `202611170001` a `202611170004` se verificaron en PostgreSQL aislado. La migración de infraestructura `202610250001` se omite en el ejecutor local por requerir extensiones administradas. La promoción de PRY06 en Vercel depende del cierre de revisión y verificación segura de Supabase.

## Resultados y reproducción

| Nivel | Comando y entorno | Total | Satisfactorias | Fallidas | Omitidas |
| --- | --- | ---: | ---: | ---: | ---: |
| Jest (unidad, componentes y contratos con dobles) | `npm test -- --runInBand`, Node 24.15.0 | 206 en 26 suites | 206 | 0 | 0 |
| Multimedia | `npm run img:test`, Python local | 8 | 8 | 0 | 0 |
| Integración de infraestructura | `npm run integrations:test`, Node 24.15.0 | 4 | 4 | 0 | 0 |
| Integración SQL y concurrencia | `python3 scripts/tar05/verify-database.py`, Podman y PostgreSQL 17.11 | 8 suites + 2 carreras | 10 | 0 | 0 |
| E2E autenticado local | `node scripts/pry06/verify-happy-path.mjs`, Chromium, Next.js, GoTrue 2.177 y PostgREST 13.0.4 con PostgreSQL real | 12 grupos (6 por viewport) | 12 | 0 | 0 |

`npm ci`, `npm run lint:strict`, `npm run typecheck` y `npm run build` finalizaron correctamente. El ejecutor de DB aplicó nueve migraciones médicas. La actualización compatible del lockfile redujo la auditoría de producción de cinco avisos a cero y la auditoría completa de 41 a 35, con cero críticos. Los 35 avisos restantes (13 altos, 21 moderados, uno bajo) corresponden al árbol de desarrollo. Se conservó la configuración del proyecto y quedó pendiente evaluar una actualización amplia del tooling. Los casos críticos cubren validación y búsqueda paginada, alta válida y fallos de transporte/contrato, roles de sesión, autoría y fechas, edición mediante revisión, permisos en API y SQL, citas y traslapes.

Para reproducir E2E, crear una instancia Supabase **local descartable**, aplicar las migraciones del repositorio y crear dos cuentas ficticias ya confirmadas. Registrar un médico activo y asignar en `app_metadata` de su usuario `appointment_role=physician` y `physician_id` con su UUID. Para la segunda cuenta usar `appointment_role=receptionist`. Configurar exclusivamente una URL local y clave pública para compilar y arrancar la aplicación. Reservar los horarios ficticios del 10 y 11 de agosto de 2035 en una base de prueba, sin otros registros en esos horarios. El archivo privado de cuentas debe tener las claves `physician` y `receptionist`, cada una con `email` y `password`. El script utiliza `PRY06_E2E_ACCOUNTS`, `PRY06_E2E_PHYSICIAN_ID`, `PRY06_BASE_URL` (por defecto `http://127.0.0.1:3107`) y `PLAYWRIGHT_MODULE_PATH` cuando Playwright está instalado fuera del proyecto. `PRY06_E2E_OUTPUT` permite guardar capturas en un directorio ya creado. Las credenciales de prueba deben mantenerse fuera de Git.

La corrida aislada usa PostgreSQL, GoTrue y PostgREST en un pod local. Un proxy de loopback aporta CORS y traduce la clave pública ficticia al JWT anónimo del pod. La aplicación se compiló y ejecutó con su configuración normal. Las peticiones de sesión y datos llegaron a Auth y PostgreSQL reales. Se usaron únicamente pacientes y cuentas ficticias.

## Evidencias y declaración de IA

Los logs y capturas de la candidata se encuentran en `evidencias/PRY06/cierre` y el PDF en `evidencias/PRY06/PRY06-Amarillo.pdf`. Las evidencias de la primera contribución residen en `evidencias/PRY06/01-rodrigo`; sus fixtures de presentación se distinguen de la corrida autenticada del cierre.

Se utilizó Codex para revisar el historial Git, contrastar contratos de datos, corregir el alta, añadir regresiones y ejecutar la auditoría y las pruebas descritas. La revisión crítica detectó que un estado HTTP exitoso con solo un UUID permitía navegar aunque faltase el identificador de expediente. Se corrigió verificando ambas salidas y se añadieron casos adversos. El uso de DeepSeek por otros integrantes requiere confirmación directa de sus autores para atribuir tareas concretas. El PDF reserva las cinco firmas originales.

**Estado de entrega** · Candidata verificada localmente. Pendientes la aprobación humana de integración, la incorporación a `main`, la validación de Supabase remoto, el despliegue de PRY06 y las firmas auténticas. La comprobación de producción corresponde a TAR05.
