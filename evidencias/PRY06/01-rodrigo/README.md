# Evidencia PRY06 · integración de Rodrigo

Los PNG `*-fixture.png` se capturaron ejecutando la aplicación real local con
Playwright e interceptando exclusivamente GET /api/pacientes. Son datos ficticios
para validar presentación e interacción; no acreditan autenticación, BD ni E2E
remoto. El fixture existe solo en scripts/pry06/verify-ui.mjs y no en producción.
Los PNG `*-configuration-real.png` y las comprobaciones HTTP asociadas usan la API
real con variables públicas vacías: error 503 de configuración, sin consulta remota.
Los PNG `*-citas-regression.png` muestran el retorno real a la ruta de Citas.

ui-results.json registra 27 PASS y completed=true. Capturas en 1440×1000,
768×1024 y 390×844, escala 1, tema claro/oscuro; móvil con reducedMotion=reduce.
Se verificaron 25 registros, nombre largo, activo/inactivo, búsqueda, paginación,
vacío, loading, 400/401/403/503, retorno a Citas, foco visible por teclado y ausencia
de overflow horizontal y pageerror. No se instaló Axe: el repositorio no lo incluye.
contrast.log mide el botón Buscar: 4.71:1 claro y 4.66:1 oscuro, ambos >=4.5:1.
No equivale a una auditoría WCAG completa.

verify.log: ejecución local final de npm run verify, 122 pruebas Jest, ocho de
multimedia, cuatro de infraestructura, lint estricto, tipos y build exitosos.
Incluye 47 pruebas de pacientes. Los avisos de npm sobre enable-pre-post-scripts,
Browserslist desactualizado, localStorage experimental y module.register son avisos;
no se actualizaron dependencias ni se ocultaron resultados.

database.log: PostgreSQL 17 aislado mediante podman, cinco migraciones médicas,
cinco suites SQL (incluye pry06-patients.sql) y dos carreras concurrentes PASS.
El contenedor temporal se elimina en finally. La migración de infraestructura de
Supabase pg_cron/pg_net/Vault se omite explícitamente por el ejecutor existente.
No se aplicó ninguna migración remota ni se ejecutó SQL administrativo en Supabase.

Reproducción y limitaciones: docs/pry06/01-rodrigo-handoff.md. No se guardaron
cookies, storageState, contraseñas, tokens, HAR ni datos clínicos reales.
