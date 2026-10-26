import AppointmentSessionControl from './AppointmentSessionControl';

export default function AppointmentContext() {
  return (
    <aside className='appointments-context' aria-label='Contexto del módulo'>
      <h3>Contexto del Módulo</h3>
      <p>
        La agenda aplica validación de servidor, referencias activas y una
        restricción de base de datos contra solapamientos.
      </p>
      <ul>
        <li>
          <span aria-hidden='true' />
          <div>
            <h4>Reglas de servidor</h4>
            <p>
              La disponibilidad se comprueba antes de guardar y la base de datos
              rechaza conflictos concurrentes del mismo médico.
            </p>
          </div>
        </li>
        <li>
          <span aria-hidden='true' />
          <div>
            <h4>Acceso por Rol</h4>
            <p>
              Administración y recepción registran citas; cada médico consulta
              su propia agenda. Las políticas RLS se aplican en la base.
            </p>
          </div>
        </li>
      </ul>
      <AppointmentSessionControl />
    </aside>
  );
}
