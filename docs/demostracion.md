# Demostración del módulo de citas — PRY05

Fecha de evidencia: **26 de octubre de 2026**.
Repositorio: <https://github.com/Vo1dScripter/FHF-Salud> (público, lectura sin
invitación).

## Entorno de la evidencia

La corrida E2E se ejecutó contra una base PostgreSQL 18.4 real, PostgREST 16.5 y
un servidor de autenticación local compatible con GoTrue. No se usó una base de
datos simulada: las migraciones, RLS, RPC, restricción de solapamientos y
auditoría se aplicaron y consultaron directamente.

> **Límite declarado:** esta evidencia es local. El proyecto Supabase remoto no
> se modificó porque esta copia de trabajo no tiene URL, clave publicable,
> usuarios ni acceso al panel/CLI de Supabase. El PDF y las capturas no afirman
> que la prueba se haya ejecutado contra Supabase remoto.

Versiones comprobadas: Node.js 26.12.1, Next.js 16.2.0, PostgreSQL 18.4,
PostgREST 16.5, Chrome headless. La zona horaria de la agenda es
`America/Mexico_City` (UTC−06:00).

## Autores e historial

| Autor | Aporte | Commits |
| --- | --- | --- |
| Rodrigo Ruiz Aguilar | Base del proyecto, portada, Supabase, temas e infraestructura | `bcf715e`, `6ad6eba`, `44fbfaa`, `c2a2e5d`, `5bc865b` |
| Emilio Martinez | Borrador de modelo de citas y disponibilidad en rama | `7963f97` (`feature/base-datos-citas`) |
| yaird meyer | Registro, consulta y validación de citas | `9b8ee79` |
| jesus_ff | Estados y cambios de citas | `77bd031` |
| Integrante de integración | Integración final, E2E, correcciones visuales, documentación y evidencias | Commit final previsto `fix: integrar modulo completo de citas` (pendiente de identidad) |

El commit de Emilio no se fusionó: su borrador duplicaba tipos y tablas que ya
quedaron resueltos por las migraciones `202610250002_appointments.sql` y
`202610260003_appointment_actions.sql`. Se conserva en la rama para el historial.

## Guion de demostración

1. Abrir `/` y entrar a **Citas médicas** desde la navegación principal.
2. En `/citas` sin sesión, comprobar que no se muestran datos médicos y que la
   API responde `401`.
3. Entrar a `/citas/acceso` con una cuenta de recepción autorizada.
4. **RF-01:** abrir `/citas/nueva`, elegir paciente, médico, fecha futura,
   duración y motivo. Guardar. La confirmación muestra el ID de la cita y el
   enlace **Ver detalle**; el detalle repite el identificador.
5. **RF-02:** volver a `/citas`, recargar con F5 y comprobar paciente, médico,
   fecha, duración y estado.
6. **RF-03:** pulsar **Editar** en la cita, cambiar fecha/hora y duración,
   guardar y verificar el cambio en pantalla y en PostgreSQL.
7. **RF-04:** pulsar **Cancelar**, escribir el motivo y confirmar. La fila sigue
   en el historial como **CANCELADA**; después se registra otra cita en el mismo
   médico y horario para comprobar que el espacio quedó libre.
8. **RF-05:** intentar registrar una cita solapada del mismo médico. La interfaz
   muestra el conflicto y la base conserva una sola cita activa en el rango.
9. **RF-06:** confirmar otra cita pendiente, recargar y comprobar el estado
   **CONFIRMADA** y `confirmed_at`.
10. **Negativo:** intentar confirmar por API la cita cancelada. La respuesta es
    `400` con mensaje claro y la fila no cambia.
11. **Permisos:** entrar como médico. Solo ve su agenda, no tiene **Nueva cita**
    ni acciones de mutación, el formulario muestra **Acceso restringido** y una
    mutación directa por API responde `403`.
12. **Móvil:** repetir agenda, detalle, formulario y portada a 390×844; no debe
    existir desplazamiento horizontal.

## Resultados de la corrida

| Comprobación | Resultado |
| --- | --- |
| RF-01 alta con ID visible y persistencia en PostgreSQL | PASS |
| RF-02 recarga con paciente, médico, horario y estado | PASS |
| RF-03 reprogramación y verificación en base | PASS |
| RF-04 cancelación, historial y reutilización del horario | PASS |
| RF-05 rechazo de solapamiento sin fila duplicada | PASS |
| RF-06 confirmación visible tras recargar | PASS |
| Filtro por estado | PASS |
| Negativo: confirmar una cita cancelada | PASS |
| Permisos de médico y respuesta `403` | PASS |
| Compatibilidad móvil sin desbordamiento | PASS |
| Respuestas HTTP esperadas (401/409/400) | PASS |
| Errores de consola de la aplicación | PASS |
| Total | **14/14** |

También pasaron los dos tests SQL (`appointments.sql` y
`appointment-actions.sql`), las 75 pruebas Jest, las 8 pruebas de multimedia,
las 4 pruebas de integración, `lint:strict`, `typecheck` y el build de
producción.

## Evidencias

- PDF: [`PRY05-Equipo.pdf`](../evidencias/PRY05-Equipo.pdf).
- Capturas reales: [`evidencias/capturas`](../evidencias/capturas).
- Resultados legibles por máquina:
  [`resultados.json`](../evidencias/logs/resultados.json).
- Respuestas de la API:
  [`api-respuestas.json`](../evidencias/logs/api-respuestas.json).

Los HAR completos no se versionan por tamaño; la transcripción saneada de las
llamadas a la API es `api-respuestas.json`. No se publican cookies, tokens ni
contraseñas.

Las capturas muestran la interfaz real con la marca, colores, tipografía y
componentes existentes. No se usaron pantallas de `vista-previa` ni datos
ficticios como evidencia.

## Reproducción local

El harness de QA vive en `.demo-local/` y está ignorado por Git porque incluye
binarios y datos temporales. La corrida se puede repetir con:

```powershell
npm.cmd ci
node .demo-local\full-demo.mjs
```

El script inicia PostgreSQL/PostgREST/auth local, compila y sirve Next en el
puerto 3100, ejecuta los escenarios, guarda capturas en `evidencias/capturas` y
detiene el stack al final. Para una demostración interactiva, el stack puede
iniciarse con `startStack()` y mantener Next en ejecución; esa variante no forma
parte del commit.

## Configuración con Supabase real

Cuando se disponga de acceso al proyecto:

1. Colocar en `.env.local` únicamente `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (clave `sb_publishable_`).
2. Aplicar las migraciones de citas y crear las políticas/roles descritos en
   [`integraciones.md`](integraciones.md).
3. Aprovisionar pacientes, médicos y cuentas de Auth con
   `app_metadata.appointment_role` (`admin`, `receptionist` o `physician`).
4. Ejecutar `npm run dev` y repetir el guion anterior; generar una nueva corrida
   E2E contra Supabase y reemplazar la evidencia local.

No se deben incluir claves `sb_secret_`, `service_role`, contraseñas de Postgres,
cookies ni tokens en el repositorio, el PDF o las capturas.

## Seguridad y alcance

- `.env.local`, `.demo-local/` y los HAR crudos están ignorados por Git.
- Los HAR publicados fueron sanitizados: se eliminaron cabeceras
  `Authorization`/`Cookie`/`Set-Cookie` y se redactaron tokens y contraseñas.
- No se encontraron claves privadas reales en el historial revisado.
- El repositorio es público; el acceso de lectura queda cubierto sin agregar
  colaboradores.
- El commit final previsto es único y usa el mensaje exacto
  `fix: integrar modulo completo de citas`; queda pendiente de confirmar la
  identidad del quinto integrante y no se creó en esta entrega.

## Pendientes explícitos

- Activar y verificar el proyecto Supabase remoto (migraciones, usuarios,
  pacientes/médicos y E2E) cuando existan credenciales.
- Confirmar la identidad del quinto integrante para el commit final.
- Publicar el commit en `main` para que GitHub y el despliegue lo reflejen.
