const areas = [
  {
    description:
      'Una base preparada para identificar y consultar información cuando se integre el registro.',
    eyebrow: '01',
    title: 'Pacientes',
  },
  {
    description:
      'Un contrato independiente para mantener la información profesional separada de la agenda.',
    eyebrow: '02',
    title: 'Profesionales',
  },
  {
    description:
      'Estados y duración definidos para construir después el flujo de programación y seguimiento.',
    eyebrow: '03',
    title: 'Citas médicas',
  },
];

export default function Main() {
  return (
    <main className='fhf-page'>
      <section className='fhf-hero' id='inicio'>
        <div className='fhf-shell fhf-hero__grid'>
          <div className='fhf-hero__copy'>
            <p className='fhf-eyebrow'>Sistema de gestión médica</p>
            <h1>
              Una atención más clara empieza con una cita bien organizada.
            </h1>
            <p className='fhf-lead'>
              FHF Salud establece una base confiable para conectar pacientes,
              profesionales y citas en las siguientes etapas del proyecto.
            </p>
            <a className='fhf-button' href='#alcance'>
              Conocer el alcance
              <span aria-hidden='true'>↓</span>
            </a>
          </div>

          <aside className='fhf-status' aria-label='Estado del primer avance'>
            <p className='fhf-status__eyebrow'>Primer avance</p>
            <p className='fhf-status__title'>
              La estructura ya está lista para crecer.
            </p>
            <p className='fhf-status__copy'>
              Preparamos contratos y puntos de integración sin exponer datos
              médicos ni adelantar funcionalidades que aún no existen.
            </p>
            <dl className='fhf-status__list'>
              <div>
                <dt>Base técnica</dt>
                <dd>Preparada</dd>
              </div>
              <div>
                <dt>Datos clínicos</dt>
                <dd>No incluidos</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <section className='fhf-section' id='alcance'>
        <div className='fhf-shell'>
          <div className='fhf-section__heading'>
            <p className='fhf-eyebrow'>Alcance del avance</p>
            <h2>Tres áreas que compartirán una misma base de trabajo.</h2>
            <p>
              La organización inicial reduce cambios de nombre y estructura
              cuando el equipo incorpore los flujos funcionales.
            </p>
          </div>

          <div className='fhf-areas'>
            {areas.map((area) => (
              <article className='fhf-area' key={area.title}>
                <p className='fhf-area__number'>{area.eyebrow}</p>
                <h3>{area.title}</h3>
                <p>{area.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className='fhf-roadmap' id='siguiente-etapa'>
        <div className='fhf-shell fhf-roadmap__grid'>
          <div className='fhf-roadmap__intro'>
            <p className='fhf-eyebrow'>Siguiente etapa</p>
            <h2>La gestión de citas se construirá sobre esta preparación.</h2>
            <p>
              Cuando exista acceso por rol, la experiencia podrá avanzar de una
              solicitud a una confirmación usando reglas y disponibilidad
              reales.
            </p>
          </div>

          <ol className='fhf-steps'>
            <li>
              <span>01</span>
              <div>
                <h3>Identificar</h3>
                <p>Relacionar a la persona y al profesional autorizado.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Validar</h3>
                <p>Consultar disponibilidad antes de reservar un horario.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Confirmar</h3>
                <p>Representar el estado de la cita de forma consistente.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </main>
  );
}
