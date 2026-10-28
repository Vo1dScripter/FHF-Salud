# Integraciones: guía para el equipo

Estado de referencia: 25 de octubre de 2026. Este documento describe infraestructura,
no acredita requisitos funcionales completos. Actualizarlo al publicar o activar servicios.

## 1. Qué existe y qué falta

| Plataforma o capacidad       | Estado                                                                                        | Pendiente                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| GitHub → Vercel              | Repositorio conectado y despliegue existente                                                  | Comprobar el despliegue de este commit en Vercel                                                |
| Supabase → aplicación/Vercel | Proyecto `fhf-salud`, cliente navegador/servidor y variables públicas configurados            | Tablas médicas, permisos por operación, RLS y flujos reales de acceso                           |
| Supabase Auth                | URL de producción y retorno local configurados; verificación/renovación de claims en `/citas` | Login, logout, callbacks específicos y recuperación; no hay autorización por cita terminada     |
| Edge Functions               | `reminder-dispatch` desplegada, exige secreto propio                                          | Implementar procesamiento real; actualmente devuelve `503 not_ready` con credenciales correctas |
| Cron + pg_net                | Extensiones habilitadas; job `fhf-reminder-dispatch` creado                                   | Permanece `active=false`; revisar frecuencia antes de activarlo                                 |
| Vault                        | Secreto de invocación y URL del endpoint configurados                                         | Mantener el secreto sincronizado con Edge Secrets si se rota                                    |
| Web Push / VAPID             | Par de claves generado y configurado en sus entornos                                          | Consentimiento explícito, suscripciones protegidas, emisor y prueba de entrega en dispositivo   |
| PWA / Service Worker         | Manifiesto y worker implementados y comprobados localmente en producción                      | Publicar código; comprobar instalación en navegadores/dispositivos compatibles                  |
| GitHub Actions               | Workflow de verificación creado                                                               | Comprobar la ejecución de este workflow en GitHub                                               |
| SMTP externo                 | Proveedor todavía no seleccionado ni conectado                                                | Cuenta, credenciales y remitente/dominio verificable; configurar Supabase Auth/SMTP             |

La arquitectura prevista en el maestro usa GitHub, Vercel y Supabase. Web Push es
una capacidad del navegador: no requiere contratar una plataforma de SMS.
Resend o Brevo son candidatos para SMTP, no proveedores contratados ni decisiones
cerradas. SMS, laboratorios y sistemas hospitalarios quedan fuera de esta etapa.
No se ha previsto añadir Firebase, otra base de datos o un servicio externo de PDF;
las recetas imprimibles se plantean mediante HTML e impresión del navegador.

## 2. Dónde están las variables

No existe un único `.env` con todo: el frontend y las funciones tienen entornos separados.

| Variable                               | Archivo local              | Servicio remoto                           | Visibilidad                                        |
| -------------------------------------- | -------------------------- | ----------------------------------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `.env.local`               | Vercel: Production, Preview y Development | Pública                                            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`               | Vercel: los tres entornos                 | Pública; no sustituye sesión ni RLS                |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`         | `.env.local`               | Vercel: los tres entornos                 | Pública                                            |
| `VAPID_PUBLIC_KEY`                     | `supabase/functions/.env`  | Supabase Edge Function Secrets            | Misma clave pública VAPID del frontend             |
| `VAPID_PRIVATE_KEY`                    | `supabase/functions/.env`  | Supabase Edge Function Secrets            | Privada; nunca frontend                            |
| `VAPID_SUBJECT`                        | `supabase/functions/.env`  | Supabase Edge Function Secrets            | Contacto del emisor; configurado con URL del sitio |
| `REMINDER_DISPATCH_SECRET`             | `supabase/functions/.env`  | Supabase Edge Function Secrets            | Privado                                            |
| `fhf_reminder_dispatch_secret`         | No corresponde al frontend | Supabase Vault                            | Mismo valor que `REMINDER_DISPATCH_SECRET`         |
| `fhf_reminder_function_url`            | No corresponde al frontend | Supabase Vault                            | URL de la función usada por Cron                   |

`.env`, `.env.local` y `supabase/functions/.env` están ignorados por Git. Las plantillas
[.env.example](../.env.example) y [supabase/functions/.env.example](../supabase/functions/.env.example)
contienen nombres sin secretos y sí se versionan. Git no entrega los valores reales
a los compañeros: solicitar al responsable los valores públicos necesarios mediante
un canal acordado. Quien solo desarrolla frontend no necesita las claves privadas.

Nunca copiar `service_role`, `sb_secret_`, contraseñas de base de datos ni claves
privadas en variables `NEXT_PUBLIC_*`. No regenerar VAPID cuando ya existan
suscripciones sin planificar su renovación. Las variables de Vercel necesitan un
nuevo despliegue para incorporarse a la aplicación.

## Repositorio público

Todo archivo publicado y su historial se consideran accesibles a cualquiera.
Esta guía y las plantillas no contienen secretos reales. Las variantes `.env.*`
están ignoradas, excepto `.env.example`; no forzar su inclusión con `git add -f`.
`.gitignore` no elimina archivos que ya estuvieran rastreados ni borra el historial.

Las claves públicas de Supabase y VAPID están diseñadas para llegar al navegador;
la seguridad de datos depende de sesiones verificadas, permisos y RLS. No usar
la clave pública como contraseña del endpoint de automatización. La URL del
proyecto tampoco es un secreto.

Los compañeros que trabajen con funciones privilegiadas necesitan acceso autorizado
a Supabase y los secretos por un canal privado, nunca en issues, pull requests,
comentarios, capturas, ejemplos o logs de GitHub Actions. No añadir secretos de
producción a este workflow: las verificaciones actuales no los necesitan.

Si se publica accidentalmente una clave privada, revocarla o rotarla en el servicio,
actualizar sus consumidores y revisar el historial; quitarla del último archivo no
revierte la exposición. Para el secreto de recordatorios, actualizar tanto Edge
Secrets como Vault antes de reanudar el job.

## 3. Arranque para un compañero

Requisitos: Node.js 22 o superior (CI usa 24), npm y, para las pruebas multimedia,
Python con Pillow. Instalar las dependencias de Python en un entorno virtual si
la distribución lo requiere.

```bash
npm ci
cp .env.example .env.local
```

Completar en `.env.local` las tres variables públicas de la tabla anterior con los
valores proporcionados por el responsable. No sobrescribir un `.env.local` ya configurado.

```bash
npm run supabase:check
npm run dev
```

Abrir `http://localhost:3000/citas`. `supabase:check` comprueba el acceso público a
Auth, no valida tablas, permisos ni el funcionamiento de citas. Las acciones
RF-03/RF-04/RF-06 están implementadas y probadas localmente; la migración y la
prueba E2E contra el proyecto Supabase remoto siguen pendientes de activación.

Para comprobar cambios:

```bash
npm run integrations:test
npm run verify
```

`verify` ejecuta lint estricto, TypeScript, Jest, pruebas Python, pruebas de
infraestructura y build. Para revisar el Service Worker usar una compilación de
producción (`npm run build`, después `npm start`): no se registra con `npm run dev`.
El worker no solicita permiso automáticamente y no guarda páginas ni respuestas
médicas en caché. Todavía no existe un flujo terminado de suscripción push.

## 4. Archivos que debe reutilizar el equipo

- `src/lib/supabase/client.ts`: cliente para navegador.
- `src/lib/supabase/server.ts`: cliente por petición para código de servidor.
- `src/proxy.ts`: verificación/renovación de claims; no es autorización por registro.
- [Contrato de citas](citas-integracion.md): nombres y límites del módulo existente.
- `public/favicon/site.webmanifest`, `public/sw.js` y
  `src/components/pwa/ServiceWorkerRegistration.tsx`: base PWA/recepción push.
- `supabase/functions/reminder-dispatch/index.ts`: punto de entrada de automatización.
- `supabase/config.toml`: configuración de la función. La verificación JWT legacy
  está desactivada porque la función exige su secreto dedicado; no eliminar ese control.
- `supabase/migrations/202610250001_reminder_infrastructure.sql`: infraestructura SQL.
- `.github/workflows/verify.yml`: verificación en push a `main`, pull requests y ejecución manual.
- `scripts/tests/infrastructure.node-test.mjs`: comprobaciones de autorización y privacidad.

La infraestructura SQL se aplicó desde el Dashboard y no se registró mediante
`supabase db push`. Antes de adoptar el CLI, conciliar el historial de migraciones.
La migración es idempotente, pero ejecutarla vuelve a dejar el job inactivo.

## 5. Cómo continuar y cuándo activar

1. Publicar los cambios de código y comprobar GitHub Actions y el despliegue Vercel.
2. Completar acceso autenticado, roles autorizados y callbacks concretos; comprobar
   que un usuario no puede acceder a datos ajenos.
3. Definir/versionar tablas de recordatorios, suscripciones e intentos con RLS y
   permisos mínimos. No hace falta cargar pacientes reales para desarrollar esto.
4. Implementar consentimiento explícito del dispositivo y alta/baja segura de
   suscripciones. Mantener contenido genérico en las notificaciones.
5. Implementar envío, reclamación transaccional de pendientes, idempotencia,
   exclusión de ejecuciones simultáneas, cancelaciones y reintentos limitados.
6. Verificar el flujo completo con datos sintéticos y un dispositivo autorizado.
7. Solo entonces activar el job y acordar su frecuencia; la programación preparada
   es cada cinco minutos y no constituye garantía de entrega a una hora exacta.
8. Para correo externo, elegir proveedor SMTP y configurar sus credenciales y
   remitente en Supabase Auth/SMTP. Variables SMTP en Vercel por sí solas no lo conectan.

No activar Cron para llamar repetidamente a la función de preparación: una llamada
correctamente autorizada sigue devolviendo `503`, sin procesar ni enviar mensajes.
Una llamada sin secreto o con secreto incorrecto devuelve `401`; otros métodos,
`405`. Estos estados fueron comprobados junto con las pruebas locales.

## 6. Evidencia y límites

Se comprobaron lint, TypeScript, build, 20 pruebas Jest, 8 pruebas Python y 4 pruebas
de infraestructura. En navegador se verificaron escritorio/móvil, cambio de tema,
registro activo del worker en producción, ausencia de cachés creadas y navegación
al formulario. Se comprobaron conexión pública a Auth, respuestas `401`/`503` de la
función y estado inactivo del job. Esto no demuestra instalación en todos los
navegadores, envío push real ni recuperación de cuentas con SMTP externo.

Los archivos de PWA, CI y documentación se incluyen en este commit. La configuración
remota indicada está guardada en Vercel y Supabase. Después del push, comprobar
por separado el resultado de GitHub Actions y del despliegue de Vercel: publicar
el código no demuestra que ambos hayan terminado correctamente.
