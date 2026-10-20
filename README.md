# FHF Salud

Base de construcción para el sistema de gestión médica de la materia Ingeniería
de Software (SCD-1011). La plantilla conserva su interfaz actual y esta entrega
prepara contratos estables para el futuro módulo de Gestión de Citas Médicas.

## Preparación inicial de Gestión de Citas Médicas

La aplicación conserva la ruta `/`, sus componentes, navegación, estilos y
funcionalidades actuales. La única ruta API incluida por la plantilla es
`GET /api/hello`. No se añadió una pantalla de citas, autenticación, una base
de datos ni datos de prueba.

La nueva estructura de dominio es:

```text
src/features/
  appointments/
    contracts.ts  # contrato del módulo y límite de persistencia
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
3. Conservar los estados `scheduled`, `confirmed`, `cancelled`, `attended` y
   `no_show`. La cancelación es un cambio de estado, no una eliminación.
4. Implementar una fuente de datos detrás de `AppointmentRepository` cuando el
   equipo elija su infraestructura. Las rutas API o Server Actions deben usar
   el contrato, no depender directamente de una tecnología de base de datos.
5. Colocar componentes exclusivos de futuras pantallas de citas bajo
   `src/app/components/appointments/`. Sólo promover piezas a `src/components/`
   cuando sean reutilizables fuera del módulo.
6. Añadir rutas de citas únicamente al iniciar su interfaz y conservar la ruta
   raíz de la plantilla mientras siga siendo necesaria para el proyecto.

La configuración de identidad está en `src/constant/config.ts`; actualiza
`siteConfig.url` al definir el dominio de despliegue. No existe persistencia,
autenticación ni proveedor de API configurado, por lo que esta entrega no
introduce tecnologías adicionales.

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
