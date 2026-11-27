import { render, screen } from '@testing-library/react';

import AppointmentState from '@/app/components/appointments/AppointmentState';
import ClinicalHistory from '@/app/components/clinical-records/ClinicalHistory';
import ClinicalState from '@/app/components/clinical-records/ClinicalState';
import type { ClinicalHistory as ClinicalHistoryContract } from '@/features/clinical-records';

const patient = {
  active: true,
  birthDate: '1990-05-10',
  displayName: 'Paciente ficticio',
  id: '22222222-2222-4222-8222-222222222222',
  sex: 'female' as const,
};

const history: ClinicalHistoryContract = {
  appointments: [],
  canRegister: true,
  patient,
  record: null,
  revisions: [],
};

describe('enlaces entre citas, pacientes y expediente', () => {
  it('desde una sesión ausente dirige al acceso de citas', () => {
    render(<AppointmentState actionHref='/citas/acceso' kind='unauthenticated' />);

    expect(
      screen.getByRole('link', { name: 'Iniciar sesión' }),
    ).toHaveAttribute('href', '/citas/acceso');
  });

  it.each([
    ['unauthenticated', '/citas/acceso', 'Iniciar sesión'],
    ['forbidden', '/citas', 'Ir a Citas médicas'],
    ['not_found', '/pacientes', 'Volver a pacientes'],
  ] as const)(
    'el estado clínico %s conserva la navegación permitida',
    (kind, href, label) => {
      render(<ClinicalState actionHref={href} actionLabel={label} kind={kind} />);

      expect(screen.getByRole('link', { name: label })).toHaveAttribute(
        'href',
        href,
      );
    },
  );

  it('el expediente enlaza de vuelta a pacientes y a la agenda', () => {
    render(<ClinicalHistory initialHistory={history} />);

    expect(
      screen.getByRole('link', { name: 'Volver a pacientes' }),
    ).toHaveAttribute('href', '/pacientes');
    expect(
      screen.getByRole('link', { name: 'Ir a Citas médicas' }),
    ).toHaveAttribute('href', '/citas');
  });
});
