# PRY07 · Entrega de Manuel Álvarez Puentes

## Reporte

- **Rama:** `feature/pry07-regresion-manual`, base `feature/pry07-e2e-historial-clinico` (que ya integra `pry06-integracion-final`). `main` no contiene PRY06 ni PRY07.
- **Commit:** ver el historial del PR.
- **Cambios:**
  - `scripts/pry07/regression-smoke.mjs` y el script npm `pry07:smoke`.
  - Pruebas de regresión en `src/__tests__/regression/`: `CrossModuleLinks`, `GlobalNavigation` y `PreviewRegression`.
  - Ajustes de interfaz en `AppointmentList.tsx`, `QuickNav.tsx`, `citas/vista-previa/page.tsx` y `_Appointments.scss` (detalle en el diff del PR).
- **Tests:**

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck` | NO EJECUTADO hasta el final: el proceso quedó colgado más de 25 minutos y se canceló |
| `npm run lint:strict` | NO EJECUTADO: falta de tiempo |
| Jest `src/__tests__/regression` | NO EJECUTADO por el autor: el revisor debe correrlo |
| `npm run pry07:smoke` | NO EJECUTADO: falta de tiempo |

- **Evidencia:** `evidencias/PRY07/05-manuel/` (29 capturas, 1440 px y 390 px, datos ficticios). No se revisaron una por una; revisar antes de usarlas en el PDF.
- **PR y revisor:** ver el PR #__ y el revisor asignado en GitHub.
- **Incidencias:** se agotó el límite gratuito de OpenCode durante la sesión y no se terminaron la validación completa de interfaz ni las correcciones adicionales.
- **Siguiente integrante:** ejecutar `npm install`, `npm run typecheck`, `npm run lint:strict`, `npm run test -- --runInBand src/__tests__/regression` y `npm run pry07:smoke`, y anotar los resultados reales.

## Manual de usuario resumido (provisional)

Basado en las pantallas capturadas y en el traspaso de PRY06. Sin verificar de punta a punta.

1. **Acceso:** el responsable del entorno entrega un usuario de prueba y su rol. No se documentan credenciales.
2. **Entrar:** abrir `/citas/acceso` e iniciar sesión.
3. **Agenda:** `/citas` lista las citas con médico, horario y estado.
4. **Nueva cita:** `/citas/nueva`.
5. **Pacientes y expediente:** `/pacientes`. Solo el rol médico ve el enlace «Ver expediente».
6. **Salir:** NO VERIFICADO.

**Roles:** recepción y administración gestionan citas; solo médico accede al expediente (RF-12).

**Fallos frecuentes:** «Sesión requerida» (sin iniciar sesión), «Acceso restringido» (rol sin permiso) y «Expediente no disponible» (paciente sin asociación).

## Guion de video (máximo 2 minutos)

Rodrigo hará la grabación. Todavía no existe enlace de video.

| Tiempo | Pantalla |
| --- | --- |
| 0:00–0:15 | Portada `/` |
| 0:15–0:40 | `/citas/acceso`: inicio de sesión |
| 0:40–1:10 | `/citas` y `/citas/nueva` |
| 1:10–1:35 | `/pacientes` y expediente con rol médico |
| 1:35–1:50 | Acceso restringido con otro rol |
| 1:50–2:00 | Cierre |