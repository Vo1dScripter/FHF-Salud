import type { AppointmentActor } from '@/features/appointments/contracts';
import {
  canOpenClinicalHistory,
  evaluateClinicalAccess,
} from '@/features/clinical-records';

const physician: AppointmentActor = {
  physicianId: '33333333-3333-4333-8333-333333333333',
  role: 'physician',
  userId: '44444444-4444-4444-8444-444444444444',
};

describe('matriz RF-12 de acceso al historial clínico', () => {
  it('rechaza una sesión ausente como no autenticada', () => {
    expect(evaluateClinicalAccess(null)).toEqual({
      allowed: false,
      code: 'unauthenticated',
    });
    expect(canOpenClinicalHistory(null)).toBe(false);
  });

  it.each(['admin', 'receptionist'] as const)(
    'rechaza el rol no clínico %s como prohibido',
    (role) => {
      const actor: AppointmentActor = { role, userId: 'user-ficticio' };
      expect(evaluateClinicalAccess(actor)).toEqual({
        allowed: false,
        code: 'forbidden',
      });
      expect(canOpenClinicalHistory(actor)).toBe(false);
    },
  );

  it('autoriza al médico y devuelve la identidad verificada', () => {
    expect(evaluateClinicalAccess(physician)).toEqual({
      actor: physician,
      allowed: true,
    });
    expect(canOpenClinicalHistory(physician)).toBe(true);
  });
});
