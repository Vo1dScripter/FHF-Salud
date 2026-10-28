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
              Editar y confirmar revalidan la versión y el estado. Cancelar
              conserva la fila, guarda el motivo y libera el horario.
            </p>
          </div>
        </li>
        <li>
          <span aria-hidden='true' />
          <div>
            <h4>Acceso por Rol</h4>
            <p>
              Administración y recepción gestionan la agenda; cada médico
              consulta la suya. Las políticas RLS se aplican en la base.
            </p>
          </div>
        </li>
      </ul>
      <AppointmentSessionControl />
    </aside>
  );
}
