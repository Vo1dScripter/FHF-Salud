La navegación ahora incluye Pacientes y conserva Citas. `/pacientes` consulta
`GET /api/pacientes` con sesión SSR verificada, rol médico y physician activo;
consulta la tabla patients existente con RLS, búsqueda validada y paginación.
Incluye carga, vacío, error, sesión y acceso denegado sin fallback ficticio.

Se añaden contratos TypeScript/Zod importables, servicio/repositorio y pruebas.
No se modifican consultas ni reglas de Citas, migraciones aplicadas, autenticación
existente ni permisos SQL. Alta e historial clínico requieren los PR del equipo;
esta entrega no declara RF-07–12 completos. El plan explicita el bloqueo de la
asociación médico-paciente y la auditoría versionada del futuro RF-08.

Validación local: lint estricto, tipos, 122 Jest (47 de pacientes), ocho pruebas
multimedia, cuatro de infraestructura y build PASS. PostgreSQL aislado: cinco
migraciones médicas, cinco suites SQL y dos carreras PASS. Playwright: 27 checks en
1440/768/390, fixtures de UI claramente identificadas y 503 real sin configuración.
No hubo E2E remoto, migraciones Supabase ni despliegue manual.

Evidencia, comandos, archivos exactos y límites: docs/pry06/01-rodrigo-handoff.md.
Solicitar revisión real a Emilio u otro compañero; no fusionar sin revisión y CI.
