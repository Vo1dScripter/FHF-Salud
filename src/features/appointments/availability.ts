import type {
  Appointment,
  AppointmentStatus,
  IsoDateTime,
} from './contracts';

/**
 * Intervalos semiabiertos [inicio, fin). Dos citas se superponen si cada una
 * empieza antes de que termine la otra. Una cita que empieza justo al terminar
 * la anterior no se considera conflicto.
 */
export function intervalsOverlap(
  firstStart: IsoDateTime,
  firstEnd: IsoDateTime,
  secondStart: IsoDateTime,
  secondEnd: IsoDateTime,
): boolean {
  const firstStartMs = new Date(firstStart).getTime();
  const firstEndMs = new Date(firstEnd).getTime();
  const secondStartMs = new Date(secondStart).getTime();
  const secondEndMs = new Date(secondEnd).getTime();
  return firstStartMs < secondEndMs && secondStartMs < firstEndMs;
}

export function isBlockingStatus(status: AppointmentStatus): boolean {
  return status !== 'cancelled';
}

export function conflictsWithAppointment(
  candidate: {
    durationMinutes: Appointment['durationMinutes'];
    physicianId: Appointment['physicianId'];
    scheduledAt: IsoDateTime;
  },
  existing: Appointment,
): boolean {
  if (candidate.physicianId !== existing.physicianId) return false;
  if (!isBlockingStatus(existing.status)) return false;
  const candidateEnd = new Date(
    new Date(candidate.scheduledAt).getTime() +
      candidate.durationMinutes * 60_000,
  ).toISOString();
  const existingEnd = new Date(
    new Date(existing.scheduledAt).getTime() +
      existing.durationMinutes * 60_000,
  ).toISOString();
  return intervalsOverlap(
    candidate.scheduledAt,
    candidateEnd,
    existing.scheduledAt,
    existingEnd,
  );
}
