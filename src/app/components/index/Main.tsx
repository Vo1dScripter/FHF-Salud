import type { CSSProperties } from 'react';

import type {
  RevealPreset,
  TextPreset,
  TextSplit,
} from '@/components/animation';
import {
  AnimatedCounter,
  Countdown,
  FloatingElement,
  MagneticButton,
  Marquee,
  ParallaxLayer,
  Reveal,
  RevealGrid,
  ScrambleText,
  ScrollProgress,
  StaggerText,
  TiltCard,
  TypewriterText,
} from '@/components/animation';
import { QuickContactForm } from '@/components/forms';
import { ImageGallery } from '@/components/media';
import { QuickNav } from '@/components/navigation';
import { QuickSection } from '@/components/sections';

type Theme = {
  background: string;
  border: string;
  chip: string;
  codeBackground: string;
  foreground: string;
  muted: string;
  panel: string;
  shadow: string;
  titleShadow: string;
};

type RevealDemo = {
  description: string;
  label: string;
  preset: RevealPreset;
  title: string;
};

type TextDemo = {
  delay?: number;
  description: string;
  label: string;
  preset: TextPreset;
  split: TextSplit;
  stagger: number;
  text: string;
};

const revealDemos: RevealDemo[] = [
  {
    description: 'Entrada vertical directa para hero copy, secciones y grids.',
    label: 'fade-up',
    preset: 'fade-up',
    title: 'Sube limpio desde abajo.',
  },
  {
    description:
      'Sirve para bloques que deben caer con presencia, no con ruido.',
    label: 'fade-down',
    preset: 'fade-down',
    title: 'Cae desde arriba con suavidad.',
  },
  {
    description:
      'Útil para navegación secundaria, listas laterales o side notes.',
    label: 'fade-left',
    preset: 'fade-left',
    title: 'Llega desde la izquierda.',
  },
  {
    description: 'Ideal para resaltar contenido complementario o comparativas.',
    label: 'fade-right',
    preset: 'fade-right',
    title: 'Entra lateral desde la derecha.',
  },
  {
    description: 'Más atmosférico para copy grande o piezas editoriales.',
    label: 'blur-up',
    preset: 'blur-up',
    title: 'Aparece con blur ascendente.',
  },
  {
    description: 'Mantiene el mismo tono difuso, pero con trayectoria opuesta.',
    label: 'blur-down',
    preset: 'blur-down',
    title: 'Desciende con desenfoque.',
  },
  {
    description: 'Una entrada simple para tarjetas, logos o stats puntuales.',
    label: 'scale',
    preset: 'scale',
    title: 'Escala desde un tamaño menor.',
  },
  {
    description:
      'Combina escala y desplazamiento para un acento más expresivo.',
    label: 'pop',
    preset: 'pop',
    title: 'Hace pop al llegar.',
  },
  {
    description:
      'Para bloques que necesitan una entrada con un poco más de gesto.',
    label: 'rotate',
    preset: 'rotate',
    title: 'Rota y aterriza en eje.',
  },
];

const textDemos: TextDemo[] = [
  {
    description:
      'Escalona palabras con una entrada vertical legible y elegante.',
    label: 'slide-up',
    preset: 'slide-up',
    split: 'words',
    stagger: 110,
    text: 'El texto entra desde abajo sin perder ritmo.',
  },
  {
    delay: 120,
    description: 'Hace el mismo reveal vertical pero con dirección opuesta.',
    label: 'slide-down',
    preset: 'slide-down',
    split: 'words',
    stagger: 110,
    text: 'Cada palabra cae y se asienta en el centro.',
  },
  {
    delay: 160,
    description:
      'Buena base cuando sólo necesitas timing, sin exagerar el gesto.',
    label: 'fade',
    preset: 'fade',
    split: 'words',
    stagger: 100,
    text: 'Aparece por opacidad y secuencia.',
  },
  {
    delay: 180,
    description:
      'Conviene para títulos donde quieres textura y profundidad visual.',
    label: 'blur-up',
    preset: 'blur-up',
    split: 'words',
    stagger: 108,
    text: 'El blur se limpia mientras sube.',
  },
  {
    delay: 220,
    description: 'La misma idea anterior, pero entrando desde arriba.',
    label: 'blur-down',
    preset: 'blur-down',
    split: 'words',
    stagger: 108,
    text: 'Desenfoque descendente y progresivo.',
  },
  {
    delay: 260,
    description:
      'Cada letra entra desde el borde izquierdo del viewport hasta fijarse.',
    label: 'edge-left',
    preset: 'edge-left',
    split: 'chars',
    stagger: 60,
    text: 'LEFT EDGE',
  },
  {
    delay: 300,
    description:
      'Hace lo mismo desde la derecha, sin generar scroll horizontal.',
    label: 'edge-right',
    preset: 'edge-right',
    split: 'chars',
    stagger: 60,
    text: 'RIGHT EDGE',
  },
  {
    delay: 340,
    description: 'Más útil en caracteres individuales para remarcar precisión.',
    label: 'flip',
    preset: 'flip',
    split: 'chars',
    stagger: 58,
    text: 'FLIP TYPO',
  },
  {
    delay: 380,
    description:
      'Una entrada compacta para titulares cortos y mensajes puntuales.',
    label: 'scale',
    preset: 'scale',
    split: 'chars',
    stagger: 54,
    text: 'POP SCALE',
  },
  {
    delay: 420,
    description: 'Da una sensación más teatral sin depender de lógica manual.',
    label: 'swing',
    preset: 'swing',
    split: 'words',
    stagger: 130,
    text: 'Balancea el titular antes de fijarlo.',
  },
  {
    delay: 460,
    description: 'Oculta cada palabra bajo una máscara vertical limpia.',
    label: 'mask-up',
    preset: 'mask-up',
    split: 'words',
    stagger: 110,
    text: 'Máscara vertical para titulares sólidos.',
  },
  {
    delay: 500,
    description: 'Revela líneas completas manteniendo el bloque legible.',
    label: 'clip-reveal',
    preset: 'clip-reveal',
    split: 'lines',
    stagger: 130,
    text: 'Primera línea con intención\nsegunda línea bien sincronizada',
  },
  {
    delay: 540,
    description: 'Resalta palabras con un barrido visual tipo marcador.',
    label: 'highlight-sweep',
    preset: 'highlight-sweep',
    split: 'words',
    stagger: 95,
    text: 'Un barrido destaca el mensaje principal.',
  },
];

const navItems = [
  { href: '#animaciones', label: 'Animaciones' },
  { href: '#media', label: 'Media' },
  { href: '#formulario', label: 'Formulario' },
];

const galleryImages = [
  {
    alt: 'Imagen optimizada desde recursos',
    caption: 'Imagen base optimizada desde recursos',
    height: 630,
    src: '/imagenes/og.jpg',
    width: 1200,
  },
  {
    alt: 'Open Graph generado',
    caption: 'Open Graph listo para compartir',
    height: 630,
    src: '/og/og.jpg',
    width: 1200,
  },
  {
    alt: 'Imagen webp optimizada',
    caption: 'Versión WebP generada automáticamente',
    height: 630,
    src: '/imagenes/og.webp',
    width: 1200,
  },
];

const marqueeItems = [
  'RevealGrid',
  'QuickNav',
  'LightboxImage',
  'Countdown',
  'AnimatedCounter',
  'QuickContactForm',
  'Marquee',
  'TiltCard',
];

const themes: Theme[] = [
  {
    background:
      'linear-gradient(135deg, #eff6ff 0%, #dbeafe 42%, #bfdbfe 100%)',
    border: 'rgba(255, 255, 255, 0.72)',
    chip: 'rgba(15, 23, 42, 0.08)',
    codeBackground: 'rgba(255, 255, 255, 0.5)',
    foreground: '#0f172a',
    muted: 'rgba(15, 23, 42, 0.78)',
    panel: 'rgba(255, 255, 255, 0.62)',
    shadow: '0 30px 120px -60px rgba(15, 23, 42, 0.35)',
    titleShadow: '0 10px 30px rgba(255, 255, 255, 0.32)',
  },
  {
    background:
      'linear-gradient(135deg, #fef3c7 0%, #fde68a 48%, #fca5a5 100%)',
    border: 'rgba(255, 255, 255, 0.55)',
    chip: 'rgba(120, 53, 15, 0.1)',
    codeBackground: 'rgba(255, 251, 235, 0.5)',
    foreground: '#451a03',
    muted: 'rgba(69, 26, 3, 0.8)',
    panel: 'rgba(255, 251, 235, 0.56)',
    shadow: '0 32px 130px -70px rgba(146, 64, 14, 0.38)',
    titleShadow: '0 12px 28px rgba(255, 251, 235, 0.28)',
  },
  {
    background:
      'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 48%, #c4b5fd 100%)',
    border: 'rgba(255, 255, 255, 0.58)',
    chip: 'rgba(46, 16, 101, 0.1)',
    codeBackground: 'rgba(248, 245, 255, 0.48)',
    foreground: '#2e1065',
    muted: 'rgba(46, 16, 101, 0.78)',
    panel: 'rgba(248, 245, 255, 0.52)',
    shadow: '0 32px 130px -70px rgba(76, 29, 149, 0.34)',
    titleShadow: '0 10px 26px rgba(248, 245, 255, 0.28)',
  },
  {
    background:
      'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 50%, #86efac 100%)',
    border: 'rgba(255, 255, 255, 0.6)',
    chip: 'rgba(20, 83, 45, 0.1)',
    codeBackground: 'rgba(240, 253, 244, 0.5)',
    foreground: '#14532d',
    muted: 'rgba(20, 83, 45, 0.8)',
    panel: 'rgba(240, 253, 244, 0.56)',
    shadow: '0 32px 130px -70px rgba(21, 128, 61, 0.35)',
    titleShadow: '0 10px 28px rgba(240, 253, 244, 0.28)',
  },
  {
    background:
      'linear-gradient(135deg, #0f172a 0%, #1e293b 42%, #334155 100%)',
    border: 'rgba(255, 255, 255, 0.18)',
    chip: 'rgba(255, 255, 255, 0.08)',
    codeBackground: 'rgba(255, 255, 255, 0.08)',
    foreground: '#e2e8f0',
    muted: 'rgba(226, 232, 240, 0.82)',
    panel: 'rgba(15, 23, 42, 0.4)',
    shadow: '0 34px 140px -74px rgba(2, 6, 23, 0.7)',
    titleShadow: '0 14px 44px rgba(15, 23, 42, 0.55)',
  },
  {
    background:
      'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 44%, #f9a8d4 100%)',
    border: 'rgba(255, 255, 255, 0.62)',
    chip: 'rgba(131, 24, 67, 0.1)',
    codeBackground: 'rgba(253, 242, 248, 0.5)',
    foreground: '#831843',
    muted: 'rgba(131, 24, 67, 0.78)',
    panel: 'rgba(253, 242, 248, 0.58)',
    shadow: '0 32px 130px -70px rgba(157, 23, 77, 0.34)',
    titleShadow: '0 10px 30px rgba(253, 242, 248, 0.3)',
  },
];

const introTheme = themes[4];

function getTheme(index: number): Theme {
  return themes[index % themes.length];
}

function createPanelStyle(theme: Theme): CSSProperties {
  return {
    backgroundColor: theme.panel,
    borderColor: theme.border,
    boxShadow: theme.shadow,
    color: theme.foreground,
  };
}

function createChipStyle(theme: Theme): CSSProperties {
  return {
    backgroundColor: theme.chip,
    borderColor: theme.border,
    color: theme.foreground,
  };
}

function createDisplayStyle(theme: Theme): CSSProperties {
  return {
    color: theme.foreground,
    textShadow: theme.titleShadow,
  };
}

function createMutedTextStyle(theme: Theme): CSSProperties {
  return {
    color: theme.muted,
  };
}

function createCodeStyle(theme: Theme): CSSProperties {
  return {
    backgroundColor: theme.codeBackground,
    borderColor: theme.border,
    color: theme.muted,
  };
}

export default function Main() {
  return (
    <main className='relative right-1/2 left-1/2 mr-[-50vw] ml-[-50vw] flex w-screen flex-col overflow-x-clip'>
      <ScrollProgress className='text-cyan-300' />

      <section className='sticky top-0 z-50 border-b border-white/20 bg-slate-950/80 px-6 py-4 text-white backdrop-blur-xl'>
        <QuickNav
          brand='Starter Lab'
          cta={{ href: '#formulario', label: 'Contacto' }}
          items={navItems}
          variant='floating'
        />
      </section>

      <section
        id='animaciones'
        className='flex min-h-[78svh] w-screen items-center justify-center overflow-x-clip px-6 py-16 md:px-10 lg:px-14'
        style={{
          background: introTheme.background,
          color: introTheme.foreground,
        }}
      >
        <div className='w-full max-w-6xl text-center'>
          <Reveal
            as='div'
            preset='blur-up'
            once={false}
            distance={40}
            duration={860}
            threshold={0.25}
            className='mx-auto max-w-4xl rounded-[2.2rem] border px-8 py-10 backdrop-blur-xl md:px-12 md:py-14'
            style={createPanelStyle(introTheme)}
          >
            <span
              className="mx-auto inline-flex rounded-full border px-4 py-1 font-['Montserrat'] text-[11px] tracking-[0.34em] uppercase"
              style={createChipStyle(introTheme)}
            >
              Galería de animaciones
            </span>

            <StaggerText
              as='h2'
              text='Cada bloque muestra un preset en pantalla completa.'
              split='words'
              preset='slide-up'
              delay={180}
              duration={960}
              stagger={120}
              once={false}
              threshold={0.25}
              className="mt-7 font-['Arapey'] text-5xl leading-none text-balance md:text-7xl"
              style={createDisplayStyle(introTheme)}
            />

            <Reveal
              as='p'
              preset='fade-up'
              once={false}
              delay={420}
              duration={920}
              className="mx-auto mt-6 max-w-2xl font-['Montserrat'] text-sm leading-7 md:text-base"
              style={createMutedTextStyle(introTheme)}
            >
              Ahora la home sirve como laboratorio visual: un bloque por efecto,
              ancho completo, fondo dedicado y el preset centrado para revisar
              cómo se comporta al entrar y reentrar en viewport.
            </Reveal>
          </Reveal>
        </div>
      </section>

      {revealDemos.map((item, index) => {
        const theme = getTheme(index);

        return (
          <section
            key={`reveal-${item.preset}`}
            className='flex min-h-[72svh] w-screen items-center justify-center overflow-x-clip px-6 py-14 md:px-10 lg:px-14'
            style={{ background: theme.background, color: theme.foreground }}
          >
            <div className='w-full max-w-5xl text-center'>
              <Reveal
                as='article'
                preset={item.preset}
                once={false}
                distance={48}
                duration={1040}
                threshold={0.34}
                className='mx-auto rounded-[2rem] border px-7 py-9 backdrop-blur-xl md:px-12 md:py-12'
                style={createPanelStyle(theme)}
              >
                <p
                  className="mx-auto inline-flex rounded-full border px-4 py-1 font-['Montserrat'] text-[11px] tracking-[0.34em] uppercase"
                  style={createChipStyle(theme)}
                >
                  Reveal / {item.label}
                </p>

                <h3 className="mt-6 font-['Arapey'] text-5xl leading-none text-balance md:text-7xl">
                  <span style={createDisplayStyle(theme)}>{item.title}</span>
                </h3>

                <p
                  className="mx-auto mt-5 max-w-2xl font-['Montserrat'] text-sm leading-7 md:text-base"
                  style={createMutedTextStyle(theme)}
                >
                  {item.description}
                </p>

                <code
                  className="mt-7 block rounded-full border px-5 py-3 font-['Montserrat'] text-xs tracking-[0.22em] md:text-sm"
                  style={createCodeStyle(theme)}
                >
                  {`<Reveal preset="${item.preset}" />`}
                </code>
              </Reveal>
            </div>
          </section>
        );
      })}

      {textDemos.map((item, index) => {
        const theme = getTheme(index + revealDemos.length);

        return (
          <section
            key={`text-${item.preset}`}
            className='flex min-h-[72svh] w-screen items-center justify-center overflow-x-clip px-6 py-14 md:px-10 lg:px-14'
            style={{ background: theme.background, color: theme.foreground }}
          >
            <div className='w-full max-w-5xl text-center'>
              <div
                className='mx-auto rounded-[2rem] border px-7 py-9 backdrop-blur-xl md:px-12 md:py-12'
                style={createPanelStyle(theme)}
              >
                <p
                  className="mx-auto inline-flex rounded-full border px-4 py-1 font-['Montserrat'] text-[11px] tracking-[0.34em] uppercase"
                  style={createChipStyle(theme)}
                >
                  StaggerText / {item.label}
                </p>

                <StaggerText
                  as='h3'
                  text={item.text}
                  delay={item.delay}
                  duration={1160}
                  preset={item.preset}
                  split={item.split}
                  stagger={item.stagger}
                  once={false}
                  threshold={0.34}
                  className="mt-7 font-['Arapey'] text-5xl leading-none text-balance md:text-7xl"
                  style={createDisplayStyle(theme)}
                />

                <Reveal
                  as='p'
                  preset='fade-up'
                  once={false}
                  delay={560}
                  duration={940}
                  className="mx-auto mt-5 max-w-2xl font-['Montserrat'] text-sm leading-7 md:text-base"
                  style={createMutedTextStyle(theme)}
                >
                  {item.description}
                </Reveal>

                <Reveal
                  as='code'
                  preset='fade-up'
                  once={false}
                  delay={760}
                  duration={980}
                  className="mt-7 block rounded-full border px-5 py-3 font-['Montserrat'] text-xs tracking-[0.22em] md:text-sm"
                  style={createCodeStyle(theme)}
                >
                  {`<StaggerText preset="${item.preset}" split="${item.split}" />`}
                </Reveal>
              </div>
            </div>
          </section>
        );
      })}

      <QuickSection
        className='bg-[radial-gradient(circle_at_15%_12%,rgba(34,211,238,0.22),transparent_28rem),linear-gradient(135deg,#f8fafc_0%,#e2e8f0_100%)] text-slate-950'
        eyebrow='Toolkit reutilizable'
        intro='Módulos pensados para copiar, pegar y adaptar en proyectos nuevos sin rearmar patrones comunes.'
        title='Animaciones, navegación y bloques típicos listos.'
      >
        <RevealGrid className='grid gap-5 md:grid-cols-3' stagger={120}>
          <TiltCard className='rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70'>
            <p className='text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase'>
              Counter
            </p>
            <AnimatedCounter
              className='mt-4 block text-6xl font-black tracking-tight'
              suffix='+'
              to={128}
            />
            <p className='mt-3 text-base text-slate-600'>
              Números animados para métricas, invitados, ventas o estadísticas.
            </p>
          </TiltCard>

          <TiltCard className='rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70'>
            <p className='text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase'>
              Countdown
            </p>
            <Countdown className='mt-4' targetDate='2026-12-31T23:59:59' />
            <p className='mt-3 text-base text-slate-600'>
              Cuenta regresiva para eventos, lanzamientos o promociones.
            </p>
          </TiltCard>

          <TiltCard className='rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70'>
            <p className='text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase'>
              Text FX
            </p>
            <TypewriterText
              as='p'
              className='mt-4 text-3xl leading-tight font-black'
              start='in-view'
              text='Escritura lista para hero.'
            />
            <ScrambleText
              as='p'
              className='mt-4 font-mono text-xl text-slate-600'
              text='SCRAMBLE_READY'
            />
          </TiltCard>
        </RevealGrid>

        <div className='mt-8 overflow-hidden rounded-[1.6rem] border border-slate-800/20 bg-slate-950 py-4 text-white shadow-2xl shadow-slate-300/70'>
          <Marquee duration={26} gap='1.2rem' repeat={8}>
            {marqueeItems.map((item) => (
              <span
                className='rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-bold tracking-wide whitespace-nowrap text-white'
                key={item}
              >
                {item}
              </span>
            ))}
          </Marquee>
        </div>

        <div className='mt-8 flex flex-wrap items-center gap-4'>
          <MagneticButton className='bg-slate-950 text-white'>
            Botón magnético
          </MagneticButton>
          <FloatingElement className='rounded-full bg-emerald-200 px-5 py-3 font-bold text-emerald-950'>
            FloatingElement
          </FloatingElement>
        </div>
      </QuickSection>

      <QuickSection
        className='bg-[radial-gradient(circle_at_12%_20%,rgba(14,165,233,0.22),transparent_30rem),linear-gradient(135deg,#020617_0%,#0f172a_48%,#111827_100%)] text-white'
        eyebrow='Navegación'
        intro='Variantes rápidas para no rehacer navbars desde cero.'
        title='Inline, hamburguesa, drawer y floating.'
        variant='split'
      >
        <div className='grid gap-5'>
          <div className='rounded-2xl border border-white/15 bg-white/5 p-5'>
            <QuickNav brand='Inline' items={navItems} variant='inline' />
          </div>
          <div className='rounded-2xl border border-white/15 bg-white/5 p-5'>
            <QuickNav brand='Hamburger' items={navItems} variant='hamburger' />
          </div>
          <div className='rounded-2xl border border-white/15 bg-white/5 p-5'>
            <QuickNav brand='Drawer' items={navItems} variant='drawer' />
          </div>
        </div>
      </QuickSection>

      <QuickSection
        id='media'
        className='bg-[radial-gradient(circle_at_86%_14%,rgba(251,191,36,0.24),transparent_26rem),linear-gradient(135deg,#fff7ed_0%,#ffedd5_48%,#fed7aa_100%)] text-stone-950'
        eyebrow='Media UX'
        intro='Galerías e imágenes con previsualización grande, navegación por flechas, Escape para cerrar y controles visibles.'
        title='Lightbox completo para imágenes.'
      >
        <ParallaxLayer speed={0.06}>
          <ImageGallery images={galleryImages} layout='showcase' />
        </ParallaxLayer>
      </QuickSection>

      <QuickSection
        id='formulario'
        className='bg-[radial-gradient(circle_at_18%_18%,rgba(20,184,166,0.24),transparent_27rem),linear-gradient(135deg,#ecfeff_0%,#ccfbf1_52%,#a7f3d0_100%)] text-cyan-950'
        eyebrow='Formulario'
        intro='Base rápida para contacto, cotizaciones o registros. Ya trae estado local y campos típicos.'
        title='Formulario listo para conectar.'
        variant='split'
      >
        <Reveal preset='fade-left'>
          <QuickContactForm />
        </Reveal>
      </QuickSection>
    </main>
  );
}
