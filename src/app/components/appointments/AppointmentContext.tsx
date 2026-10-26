export default function AppointmentContext() {
  return (
    <aside className='appointments-context' aria-label='Contexto del módulo'>
      <h3>Contexto del Módulo</h3>
      <p>
        Este panel acompaña la gestión de citas para ofrecer información de
        auditoría y reglas de negocio.
      </p>
      <ul>
        <li>
          <span aria-hidden='true' />
          <div>
            <h4>Reglas de servidor</h4>
            <p>
              Las citas se validarán contra la disponibilidad del profesional en
              tiempo real.
            </p>
          </div>
        </li>
        <li>
          <span aria-hidden='true' />
          <div>
            <h4>Acceso por Rol</h4>
            <p>
              Solo usuarios autorizados podrán editar o cancelar citas
              existentes.
            </p>
          </div>
        </li>
      </ul>
    </aside>
  );
}
