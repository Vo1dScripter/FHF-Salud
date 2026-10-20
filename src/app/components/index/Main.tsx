import { QuickNav } from '@/components/navigation';

const navItems = [
  { href: '#inicio', label: 'Inicio' },
  { href: '#modulos', label: 'Módulos' },
  { href: '#citas', label: 'Citas médicas' },
];

const modules = [
  {
    description:
      'La estructura inicial deja listo el punto de integración para el registro y consulta de pacientes.',
    title: 'Pacientes',
  },
  {
    description:
      'Los médicos tendrán un contrato propio para que su información no se mezcle con la agenda.',
    title: 'Médicos',
  },
  {
    description:
      'Las citas ya cuentan con estados, duración y una interfaz de persistencia definida para su futura implementación.',
    title: 'Citas médicas',
  },
];

export default function Main() {
  return (
    <main className='w-full overflow-x-clip bg-slate-50 text-slate-900'>
      <section className='border-b border-teal-950/10 bg-slate-950 px-4 py-4 text-white sm:px-6'>
        <QuickNav
          brand='FHF Salud'
          cta={{ href: '#citas', label: 'Ver preparación' }}
          items={navItems}
          variant='floating'
        />
      </section>

      <section
        className='border-b border-teal-950/10 bg-[radial-gradient(circle_at_83%_22%,rgba(45,212,191,0.18),transparent_22rem),linear-gradient(135deg,#f0fdfa_0%,#f8fafc_54%,#ecfeff_100%)] px-6 py-16 sm:px-10 lg:px-14 lg:py-24'
        id='inicio'
      >
        <div className='mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:items-end'>
          <div>
            <p className='text-xs font-bold tracking-[0.24em] text-teal-700 uppercase'>
              Sistema de gestión médica
            </p>
            <h1
              className='mt-5 max-w-3xl font-semibold tracking-tight text-slate-950'
              style={{
                fontSize: 'clamp(2.75rem, 8vw, 5rem)',
                lineHeight: 0.95,
              }}
            >
              Atención organizada desde la primera cita.
            </h1>
            <p className='mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl'>
              FHF Salud reúne las bases para gestionar pacientes, médicos y
              citas médicas con una estructura clara y preparada para crecer.
            </p>
            <a
              className='mt-8 inline-flex items-center rounded-full text-sm font-bold text-white transition focus-visible:outline-none'
              href='#citas'
              style={{
                backgroundColor: '#0f172a',
                minHeight: '44px',
                padding: '0.75rem 1.5rem',
              }}
            >
              Conocer el módulo de citas
            </a>
          </div>

          <aside
            className='border-l-4 border-teal-600 bg-white px-6 py-7 shadow-sm'
            aria-label='Estado del proyecto'
          >
            <p className='text-sm font-bold tracking-[0.18em] text-teal-700 uppercase'>
              Primer avance
            </p>
            <p className='mt-4 text-2xl font-semibold text-slate-900'>
              Base técnica preparada
            </p>
            <p className='mt-3 text-base leading-7 text-slate-600'>
              La interfaz de gestión se construirá sobre contratos estables, sin
              comprometer todavía datos reales ni una tecnología de
              persistencia.
            </p>
          </aside>
        </div>
      </section>

      <section className='px-6 py-16 sm:px-10 lg:px-14 lg:py-20' id='modulos'>
        <div className='mx-auto max-w-6xl'>
          <div className='max-w-2xl'>
            <p className='text-xs font-bold tracking-[0.24em] text-teal-700 uppercase'>
              Organización inicial
            </p>
            <h2
              className='mt-4 font-semibold tracking-tight text-slate-950'
              style={{
                fontSize: 'clamp(2.25rem, 6vw, 4rem)',
                lineHeight: 0.98,
              }}
            >
              Tres áreas, una misma base de trabajo.
            </h2>
          </div>

          <div className='mt-10 grid gap-px overflow-hidden border border-slate-200 bg-slate-200 md:grid-cols-3'>
            {modules.map((module, index) => (
              <article className='bg-white p-7 sm:p-8' key={module.title}>
                <p className='text-sm font-bold text-teal-700'>0{index + 1}</p>
                <h3 className='mt-8 text-2xl font-semibold text-slate-900'>
                  {module.title}
                </h3>
                <p className='mt-4 leading-7 text-slate-600'>
                  {module.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className='bg-slate-950 px-6 py-16 text-white sm:px-10 lg:px-14 lg:py-20'
        id='citas'
      >
        <div className='mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)] lg:items-center'>
          <div>
            <p className='text-xs font-bold tracking-[0.24em] text-teal-300 uppercase'>
              Gestión de citas médicas
            </p>
            <h2
              className='mt-4 font-semibold tracking-tight'
              style={{
                fontSize: 'clamp(2.25rem, 6vw, 4rem)',
                lineHeight: 0.98,
              }}
            >
              Lista para su siguiente etapa de construcción.
            </h2>
            <p className='mt-5 max-w-2xl text-lg leading-8 text-slate-300'>
              El proyecto ya establece cómo identificar pacientes y médicos, y
              cómo representar una cita, sus estados y las operaciones que
              llegarán en las siguientes iteraciones.
            </p>
          </div>

          <dl className='divide-y divide-white/15 border-y border-white/15 text-sm'>
            <div className='flex items-center justify-between gap-6 py-4'>
              <dt className='text-slate-300'>Contrato de citas</dt>
              <dd className='font-semibold text-teal-300'>Preparado</dd>
            </div>
            <div className='flex items-center justify-between gap-6 py-4'>
              <dt className='text-slate-300'>Rutas operativas</dt>
              <dd className='font-semibold text-slate-100'>Pendientes</dd>
            </div>
            <div className='flex items-center justify-between gap-6 py-4'>
              <dt className='text-slate-300'>Datos clínicos reales</dt>
              <dd className='font-semibold text-slate-100'>No incluidos</dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}
