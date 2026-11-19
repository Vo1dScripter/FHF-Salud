import type { ReactNode } from 'react';

import Footer from '@/app/components/index/Footer';
import Header from '@/app/components/index/Header';

export default function PatientsLayout({ children }: { children: ReactNode }) {
  return (
    <div className='appointments-route'>
      <Header patients />
      <main className='appointments-page' id='pacientes'>
        <div className='fhf-shell'>
          <header className='appointments-heading'>
            <p className='appointments-eyebrow'>Atención médica</p>
            <h1>Pacientes</h1>
            <p className='appointments-lead'>
              Consulta de pacientes autorizados para tu cuenta médica.
            </p>
          </header>
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
