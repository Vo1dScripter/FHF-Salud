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
            Agenda conectada a Supabase cuando el entorno y la sesión están
            configurados. La escritura requiere personal autorizado y las citas
            se validan en servidor.
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
