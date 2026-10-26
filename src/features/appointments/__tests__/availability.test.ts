import {
  conflictsWithAppointment,
  intervalsOverlap,
  isBlockingStatus,
} from '../availability';
import type { Appointment } from '../contracts';

const physicianId = '33333333-3333-4333-8333-333333333333';
const otherPhysicianId = '44444444-4444-4444-8444-444444444444';

function appointment(
  overrides: Partial<Appointment> = {},
): Appointment {
  return {
    createdAt: '2026-10-24T12:00:00-06:00',
    durationMinutes: 30,
    id: '55555555-5555-4555-8555-555555555555',
    patientId: '22222222-2222-4222-8222-222222222222',
    physicianId,
    reason: 'Consulta sintética',
    scheduledAt: '2030-01-15T10:00:00-06:00',
    status: 'pending',
    updatedAt: '2026-10-24T12:00:00-06:00',
    ...overrides,
  };
}

describe('availability', () => {
  it('considera intervalos semiabiertos: terminar justo al inicio no es conflicto', () => {
    expect(
      intervalsOverlap(
        '2030-01-15T10:00:00-06:00',
        '2030-01-15T10:30:00-06:00',
        '2030-01-15T10:30:00-06:00',
        '2030-01-15T11:00:00-06:00',
      ),
    ).toBe(false);
  });

  it('detecta superposición del mismo médico', () => {
    expect(
      conflictsWithAppointment(
        {
          durationMinutes: 30,
          physicianId,
          scheduledAt: '2030-01-15T10:15:00-06:00',
        },
        appointment(),
      ),
    ).toBe(true);
  });

  it('permite citas simultáneas con médicos diferentes', () => {
    expect(
      conflictsWithAppointment(
        {
          durationMinutes: 30,
          physicianId: otherPhysicianId,
          scheduledAt: '2030-01-15T10:00:00-06:00',
        },
        appointment(),
      ),
    ).toBe(false);
  });

  it('excluye una cita cancelada y libera el horario', () => {
    const cancelled = appointment({ status: 'cancelled' });
    expect(isBlockingStatus(cancelled.status)).toBe(false);
    expect(
      conflictsWithAppointment(
        {
          durationMinutes: 30,
          physicianId,
          scheduledAt: '2030-01-15T10:00:00-06:00',
        },
        cancelled,
      ),
    ).toBe(false);
  });
});
