import type { AppointmentActor } from '@/features/appointments/contracts';

import type { PatientActor, PatientRepository } from './contracts';
import { PatientError } from './errors';
import { parsePatientQuery } from './validation';

export function requirePatientPhysician(
  actor: AppointmentActor | null,
): PatientActor {
  if (!actor) throw new PatientError('unauthenticated');
  if (actor.role !== 'physician') throw new PatientError('forbidden');
  return actor;
}
export class PatientService {
  constructor(private readonly repository: PatientRepository) {}
  async list(actor: AppointmentActor | null, input: unknown) {
    const physician = requirePatientPhysician(actor);
    if (!(await this.repository.isActivePhysician(physician.physicianId))) {
      throw new PatientError('forbidden');
    }
    return this.repository.list(parsePatientQuery(input));
  }
}
