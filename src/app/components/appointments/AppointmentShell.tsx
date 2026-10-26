import type { ReactNode } from 'react';

import AppointmentContext from './AppointmentContext';

export default function AppointmentShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className='appointments-page' id='citas'>
      <div className='fhf-shell'>
        <header className='appointments-heading'>
          <p className='appointments-eyebrow'>Gestión de Agenda</p>
          <h1>Citas médicas</h1>
          <p className='appointments-lead'>
            Módulo en etapa de preparación. Esta vista proyecta la estructura
            técnica y visual sin conexión activa a servicios de datos.
          </p>
        </header>
        <div className='appointments-grid'>
          <div className='appointments-content'>{children}</div>
          <AppointmentContext />
        </div>
      </div>
    </main>
  );
}
