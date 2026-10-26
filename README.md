# FHF Salud

Base de construcción para el sistema de gestión médica de la materia Ingeniería
de Software (SCD-1011). La plantilla conserva su interfaz actual y esta entrega
prepara contratos estables para el futuro módulo de Gestión de Citas Médicas.

## Preparación inicial de Gestión de Citas Médicas

La aplicación conserva la ruta `/`, su contenido y las anclas anteriores. El
menú añade «Citas médicas» y el interruptor claro/oscuro. La única ruta API
existente sigue siendo `GET /api/hello`. El módulo añade pantallas de preparación
en `/citas`, `/citas/nueva` y `/citas/[id]`, sin autenticación, persistencia ni
operaciones médicas. La ruta de QA `/citas/vista-previa` requiere modo desarrollo
y una bandera explícita; sus datos sintéticos nunca son fallback de producción.

La nueva estructura de dominio es:

```text
src/features/
  appointments/
    contracts.ts  # datos, persistencia y servicio de aplicación previstos
    routes.ts     # URLs acordadas y etiquetas de estados
    index.ts      # API pública del módulo
  patients/
    types.ts      # identificador y referencia mínima de paciente
    index.ts
  physicians/
    types.ts      # identificador y referencia mínima de médico
    index.ts
```

`src/features/appointments/contracts.ts` es la fuente de verdad inicial para
los nombres de citas. Define `Appointment`, sus estados, duración, entradas
para alta, reprogramación y cancelación, filtros de consulta y
`AppointmentRepository`. No contiene datos médicos, datos de prueba ni una
implementación de almacenamiento.

### Contrato de trabajo para los siguientes integrantes

1. Importar contratos desde los `index.ts` públicos, por ejemplo
   `@/features/appointments`; no duplicar tipos de paciente, médico o cita en
   rutas y componentes.
2. Mantener identificadores como `string` mediante `PatientId`, `PhysicianId`
   y `AppointmentId`. Las fechas se intercambian como `IsoDateTime` en formato
   ISO 8601 con zona horaria.
3. Conservar los estados `pending` (pendiente), `confirmed` (confirmada) y
   `cancelled` (cancelada). La cancelación es un cambio de estado, no una
   eliminación. El motivo de consulta (`Appointment.reason`) es distinto del
   motivo de cancelación (`CancelAppointmentInput.reason`).
4. Implementar una fuente de datos detrás de `AppointmentRepository` cuando el
   equipo elija su infraestructura. Las rutas API o Server Actions deben usar
   el contrato, no depender directamente de una tecnología de base de datos.
5. Colocar componentes exclusivos de futuras pantallas de citas bajo
   `src/app/components/appointments/`. Sólo promover piezas a `src/components/`
   cuando sean reutilizables fuera del módulo.
6. Usar `appointmentRoutes` para las URLs acordadas: `/citas`, `/citas/nueva`
   y `/citas/[id]`. Las pantallas y el menú ya están incorporados como estructura
   en preparación; la escritura permanece deshabilitada. Conservar la ruta raíz
   y sus anclas.
7. Implementar las operaciones detrás de `AppointmentService`: `list`,
   `getById`, `create`, `confirm`, `reschedule` y `cancel`. El contrato no
   ejecuta operaciones ni da por cumplidos los RF.

El detalle de campos, responsabilidades, acceso y validación está en
[el acuerdo de integración](docs/citas-integracion.md).

La configuración de identidad está en `src/constant/config.ts`; actualiza
`siteConfig.url` al definir el dominio de despliegue. La base de conexión a Supabase ya está configurada con clientes de navegador y
servidor, cookies SSR y renovación de sesión en `src/proxy.ts`. Aún no existen
login, persistencia ni políticas de autorización por cita; la interfaz conserva
su modo de preparación y no permite operaciones médicas.

## Plantilla Next.js

Plantilla base para arrancar proyectos rápido con `Next.js`, `React`,
`TypeScript`, `Tailwind`, `SCSS`, `Jest` y un pipeline propio para optimizar
recursos multimedia antes de publicarlos.

La idea de esta plantilla es separar claramente:

- código de aplicación
- componentes reutilizables
- recursos originales sin optimizar
- recursos finales listos para producción

## Objetivo de la plantilla

Esta base está pensada para:

- prototipar proyectos rápido sin reconfigurar tooling
- mantener una estructura consistente entre proyectos
- procesar imágenes, videos, audios, OG y favicons con un flujo repetible
- trabajar cómodo tanto manualmente como con asistentes como Codex

## Stack principal

- `Next.js 16.2.0`
- `React 19.2.4`
- `TypeScript 5.9.3`
- `Tailwind CSS 4.2.2`
- `SCSS + Gulp`
- `ESLint 9`
- `Prettier 3`
- `Jest 30`

## Inicio rápido

Requisitos: Node.js >=22.0.0 y npm. Python y ffmpeg son necesarios solo para
el pipeline multimedia descrito más abajo.

```bash
npm ci
cp .env.example .env
npm run dev
```

Abrir `http://localhost:3000`. Para probar producción:

```bash
npm run build
npm run start
```

También se admite la instalación habitual:

```bash
npm install
npm run dev
```

Si vas a trabajar con recursos multimedia:

```bash
npm run img
```

## Scripts principales

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run lint:strict
npm run lint:fix
npm run typecheck
npm run verify
npm test
npm run img
npm run img:test
npx gulp css
```

Notas:

- `npm run dev` levanta `Next.js` y `gulp` en paralelo.
- `npm run img` ejecuta [multimedia.py](./multimedia.py).
- `npm run img:test` ejecuta las pruebas del pipeline multimedia.
- `npm run verify` ejecuta lint estricto, typecheck, tests, pruebas multimedia
  y build.
- `prebuild` recompila estilos y limpia caché antes del build.
- `.env.example` es la referencia versionada; `.env` queda como configuración
  local de cada copia del proyecto.

## Estructura del proyecto

```text
recursos/
public/
src/
  app/
    components/
  components/
  lib/
  constant/
  scss/
  styles/
tests/
multimedia.py
```

## Convención de carpetas

### `recursos/`

Aquí van los archivos fuente originales:

- imágenes
- videos
- audios
- SVG
- imagen OG
- fuente de favicon

Ejemplo recomendado:

```text
recursos/
  imagenes/
  videos/
  audios/
  svg/
  og/
  favicon/
```

Estos archivos no deberían consumirse directamente desde la app. Primero pasan
por `multimedia.py`.

### `public/`

Aquí quedan los archivos ya optimizados y listos para ser consumidos por la app.

Ejemplo:

```text
public/
  imagenes/
  videos/
  audios/
  svg/
  og/
  favicon/
  gif/
  registros/
```

`public/registros/` guarda los manifests del pipeline para saber qué archivos ya
se procesaron, qué salidas generaron y cuándo volver a procesarlos.

### `src/app/components/`

Esta carpeta se usa para componentes del proyecto actual, normalmente
organizados por página, bloque o apartado.

Convención recomendada:

- crear una carpeta por sección principal
- dividir cada sección en piezas pequeñas
- componer desde la página o desde un contenedor de sección

Ejemplo:

```text
src/app/components/
  index/
    Header.tsx
    Hero.tsx
    Main.tsx
    Nav.tsx
    Footer.tsx
```

Úsala para componentes específicos del proyecto, no para piezas genéricas.

### `src/components/`

Aquí van únicamente componentes reutilizables o utilidades visuales compartidas
entre varias secciones o páginas.

Ejemplos válidos:

- cards
- botones reutilizables
- wrappers de animación
- títulos reutilizables
- componentes decorativos

Ejemplo:

```text
src/components/
  animation/
  text/
  cards/
```

Regla práctica:

- `src/app/components/`: implementación específica de una página o apartado
- `src/components/`: piezas genéricas reutilizables

## Flujo multimedia

El flujo esperado es este:

1. Colocar recursos originales dentro de `recursos/`.
2. Ejecutar `npm run img`.
3. Dejar que `multimedia.py` optimice y convierta los archivos.
4. Consumir los archivos resultantes desde `public/`.

Ejemplo:

- `recursos/imagenes/hero.png`
- `npm run img`
- salidas en `public/imagenes/hero.jpg`, `public/imagenes/hero.webp` y, si está
  disponible el plugin, `public/imagenes/hero.avif`

### Qué hace `multimedia.py`

- procesa imágenes
- transcodifica videos
- copia audios
- copia SVG
- genera imagen OG
- genera favicons
- crea manifests en `public/registros`
- elimina salidas huérfanas si desaparece el recurso fuente

### Dependencias del pipeline

- `Python 3`
- `Pillow`
- `ffmpeg`
- `pillow-avif-plugin` opcional para generar `.avif`

### Comandos útiles del pipeline

```bash
npm run img
npm run img -- --force
npm run img -- --only=imagenes,og,favicon
npm run img:test
```

### Variables relevantes en `.env`

- `MULTIMEDIA_SOURCE`
- `MULTIMEDIA_DEST`
- `MULTIMEDIA_ONLY`
- `MULTIMEDIA_FORCE`
- `MULTIMEDIA_OG_INPUT`
- `MULTIMEDIA_OG_OUTPUT`
- `MULTIMEDIA_FAVICON_INPUT`
- `MULTIMEDIA_OG_WIDTH`
- `MULTIMEDIA_OG_HEIGHT`
- `MULTIMEDIA_OG_QUALITY`
- `MULTIMEDIA_FAVICON_NAME`
- `MULTIMEDIA_FAVICON_SHORT_NAME`
- `MULTIMEDIA_FAVICON_THEME_COLOR`
- `MULTIMEDIA_FAVICON_BACKGROUND_COLOR`
- `MULTIMEDIA_FAVICON_DISPLAY`
- `MULTIMEDIA_IMAGE_MAX_MB`
- `MULTIMEDIA_VIDEO_WIDTH`

## Guía para trabajar rápido con Codex

Si usas esta plantilla con Codex, estas convenciones son importantes:

- los recursos originales van en `recursos/`
- después se ejecuta `multimedia.py` con `npm run img`
- los archivos finales que consume la app salen de `public/`
- los componentes específicos de una página o apartado van en
  `src/app/components/`
- los componentes reutilizables van en `src/components/`
- si se crea una landing, lo normal es hacer una carpeta como
  `src/app/components/index/` y dentro dividir en `Nav`, `Header`, `Main`,
  `Footer`, `Hero`, etc.

Prompt operativo recomendado para Codex dentro de esta plantilla:

```text
Respeta esta estructura:
- recursos fuente en recursos/
- salida optimizada en public/ mediante multimedia.py
- componentes específicos de página en src/app/components/
- componentes reutilizables en src/components/
- divide las páginas por secciones pequeñas y componibles
```

## Sistema de animaciones reutilizables

La base de animaciones vive principalmente en:

- [Reveal.tsx](./src/components/animation/Reveal.tsx)
- [StaggerText.tsx](./src/components/animation/StaggerText.tsx)
- [TypewriterText.tsx](./src/components/animation/TypewriterText.tsx)
- [ScrambleText.tsx](./src/components/animation/ScrambleText.tsx)
- [MotionGroup.tsx](./src/components/animation/MotionGroup.tsx)
- [AnimatedCounter.tsx](./src/components/animation/AnimatedCounter.tsx)
- [Countdown.tsx](./src/components/animation/Countdown.tsx)
- [Marquee.tsx](./src/components/animation/Marquee.tsx)
- [MagneticButton.tsx](./src/components/animation/MagneticButton.tsx)
- [TiltCard.tsx](./src/components/animation/TiltCard.tsx)
- [ScrollProgress.tsx](./src/components/animation/ScrollProgress.tsx)
- [ParallaxLayer.tsx](./src/components/animation/ParallaxLayer.tsx)
- [RevealGrid.tsx](./src/components/animation/RevealGrid.tsx)
- [useMotionInView.ts](./src/components/animation/useMotionInView.ts)
- [motionConfig.ts](./src/components/animation/motionConfig.ts)
- [\_Motion.scss](./src/scss/base/_Motion.scss)

### `Reveal`

Se usa para animar bloques completos al entrar en viewport.

Props principales:

- `preset`
- `duration`
- `delay`
- `distance`
- `once`
- `threshold`
- `rootMargin`

Presets disponibles:

- `fade-up`
- `fade-down`
- `fade-left`
- `fade-right`
- `blur-up`
- `blur-down`
- `scale`
- `pop`
- `rotate`

### `StaggerText`

Se usa para dividir texto por palabras o caracteres y animarlo por partes.

Props principales:

- `text`
- `split`
- `preset`
- `stagger`
- `duration`
- `delay`
- `once`

Presets disponibles:

- `slide-up`
- `slide-down`
- `fade`
- `blur-up`
- `blur-down`
- `edge-left`
- `edge-right`
- `flip`
- `scale`
- `swing`
- `mask-up`
- `clip-reveal`
- `wave`
- `scramble`
- `typewriter`
- `highlight-sweep`

También soporta:

- `split='lines'`
- `start='in-view' | 'immediate' | 'manual'`
- `onComplete`
- `renderToken`
- `disabled`

### `TypewriterText`

Animación de escritura progresiva. Útil para hero copy, frases cortas o estados
de interfaz.

### `ScrambleText`

Animación de texto con caracteres aleatorios que se resuelven al valor final.
Funciona bien en títulos técnicos, portfolio o secciones con acento visual.

### `MotionGroup`

Escalona la entrada de varios elementos hijos sin tener que envolver cada uno en
`Reveal`.

### `Marquee`

Carrusel continuo para logos, tags, beneficios o mensajes repetitivos.

Props útiles:

- `duration`
- `direction='left' | 'right'`
- `repeat`
- `gap`
- `fadeEdges`
- `pauseOnHover`

## Navegación rápida

La plantilla incluye [QuickNav.tsx](./src/components/navigation/QuickNav.tsx)
como maquetador base para navegación responsive con marca, links y CTA.

Variantes disponibles:

- `inline`
- `centered`
- `floating`
- `hamburger`
- `drawer`

## Componentes típicos reutilizables

Además de animaciones, la plantilla incluye módulos rápidos para necesidades
comunes:

- [ImageGallery.tsx](./src/components/media/ImageGallery.tsx)
- [LightboxImage.tsx](./src/components/media/LightboxImage.tsx)
- [QuickContactForm.tsx](./src/components/forms/QuickContactForm.tsx)
- [QuickSection.tsx](./src/components/sections/QuickSection.tsx)

`ImageGallery` incluye lightbox con cierre por `Escape`, navegación por flechas,
botones anterior/siguiente, botón de cierre y layouts `grid`, `masonry` y
`showcase`.

## Calidad y validación

Comandos recomendados antes de cerrar cambios:

```bash
npm run lint:strict
npm run typecheck
npm test -- --runInBand
npm run img:test
npm run build
```

## Observaciones prácticas

- el script que procesa recursos se llama `multimedia.py`
- no existe actualmente un `recursos.py`
- si en documentación futura se menciona `recursos.py`, conviene unificar ese
  nombre para no confundir el flujo real del proyecto

## Despliegue previsto en Vercel

La plantilla usa Next.js App Router y genera un build de producción sin
adaptadores adicionales. Importar el repositorio con preset Next.js, raíz del
repositorio y comando `npm run build`; este comando ejecuta también Gulp en
`prebuild` y genera el sitemap en `postbuild`. No configurar exportación
estática: existe `/api/hello`. No hace falta ejecutar el pipeline multimedia
en el hosting si se conservan los recursos optimizados versionados.

El plan [Hobby](https://vercel.com/docs/plans/hobby) es para uso personal no
comercial y está sujeto a sus límites. Next.js tiene
[soporte nativo en Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).
Compatibilidad local comprobada; no se realizó un despliegue remoto.

El dominio confirmado `https://fhf-salud.vercel.app` ya está configurado en
`src/constant/config.ts` y `next-sitemap.config.js`. Si cambia el dominio,
actualizar ambos archivos y Site URL de Supabase para conservar metadatos,
sitemap y retornos de autenticación coherentes. En el hosting,
no cargar variables del pipeline local ni secretos que la aplicación no use.

## Estado de la preparación PRY05

Contratos, acuerdo técnico, menú, rutas renderizadas y componentes de citas
preparados a partir de la propuesta aprobada (versión 3). Se excluyeron el selector
de revisión y la guía de tamaños según autorización del integrante. Se añadió
tema claro/oscuro con preferencia local persistente. La base de Supabase ya está integrada; el flujo de acceso y la autorización
efectiva quedan pendientes de los siguientes integrantes. Esto no acredita RF-01 a RF-06
ni operaciones médicas funcionales.

El integrante debe revisar y seleccionar sus archivos para un único commit
auténtico desde su cuenta:

```text
chore: preparar modulo de citas RF01-RF06
```

No incluir capturas, documentos personales ni carpetas locales de herramientas
por usar `git add .` sin revisar el estado.

## Temas y vista de desarrollo

El interruptor «Modo oscuro» del encabezado alterna claro/oscuro en la portada
y en el módulo. El tema inicial es claro y la elección se guarda en
`localStorage` bajo `fhf-theme`; si el almacenamiento está bloqueado, sigue
funcionando en la pestaña. La preferencia se aplica antes de pintar la página.

Para revisar los estados con fixtures sintéticas, sin tocar consultas reales:

```bash
FHF_APPOINTMENT_PREVIEW=true npm run dev
```

Abrir `/citas/vista-previa?estado=poblado`. Estados admitidos: `preparacion`,
`cargando`, `poblado`, `vacio`, `error`, `sesion`, `permiso`, `formulario`,
`validacion`, `enviando`, `exito`, `detalle`. Son vistas de QA; no envían datos ni
simulan una sesión real. Las pantallas normales siempre muestran preparación.
La vista previa devuelve 404 sin la bandera o en producción incluso con ella.
No establecer esta variable en el hosting. Los fixtures están aislados en
`src/features/appointments/__fixtures__/preview.ts`.

## Integración base de Supabase

Se creó un proyecto gratuito exclusivo `fhf-salud` y se prepararon los clientes
con `@supabase/supabase-js` y `@supabase/ssr`. La URL y la clave publicable se
guardan localmente en `.env.local`, ignorado por Git, y en Vercel para
Production, Preview y Development. `.env.example` contiene solo nombres vacíos:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Obtener los valores del proyecto Supabase → Settings → API Keys. Usar
exclusivamente la clave `sb_publishable_`; el validador rechaza claves secretas,
JWT legacy y URLs inseguras. La clave pública identifica la aplicación y no
reemplaza sesión, autorización ni RLS. Nunca colocar claves `sb_secret_`,
`service_role` ni contraseña de Postgres en frontend.

- Navegador: importar `createClient` desde `@/lib/supabase/client`.
- Server Components, Server Actions y Route Handlers: importar `createClient`
  desde `@/lib/supabase/server` y usar `await createClient()`. La instancia se
  crea por petición y utiliza cookies.
- `src/proxy.ts` renueva/verifica claims en `/citas/:path*` y conserva cookies y
  cabeceras devueltas por Supabase. Mantiene público el shell sin datos médicos;
  no implementa autorización por cita.
- Para proteger datos, verificar identidad con `auth.getClaims()` o
  `auth.getUser()`, aplicar permisos en cada operación y añadir RLS. No confiar
  en `auth.getSession()` como prueba de identidad en servidor.

El proyecto se creó con exposición automática de tablas nuevas **desactivada**
y RLS automático **activado**. No se crearon tablas médicas, políticas de
acceso a citas, usuarios ni registros de demostración en Supabase.

Supabase Auth tiene Site URL `https://fhf-salud.vercel.app` y retorno local
`http://localhost:3000/`. Los callbacks específicos se definirán al implementar
el flujo real de acceso, sin comodines globales.

Después de guardar variables en Vercel se necesita un despliegue nuevo. Los
cambios locales no se publican automáticamente por configurar el entorno;
el integrante debe crear y subir su commit auténtico para que el proyecto Git
conectado lo despliegue.

Comprobar la conexión pública sin acceder a tablas: `npm run supabase:check`.

El SDK de Supabase instalado requiere Node.js 22 o superior; el requisito de
`package.json` se alineó con esa versión.
