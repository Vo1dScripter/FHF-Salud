import type { AppointmentActor } from '@/features/appointments/contracts';

import type { PatientActor, PatientRepository } from './contracts';
import { PatientError } from './errors';
import { createPatientSchema, parsePatientQuery } from './validation';

export function requirePatientPhysician(
  actor: AppointmentActor | null,
): PatientActor {
  if (!actor) throw new PatientError('unauthenticated');
  if (actor.role !== 'physician') throw new PatientError('forbidden');
  return actor;
}
export class PatientService {
  constructor(private readonly repository: PatientRepository) {}
  async register(actor: AppointmentActor | null, input: unknown) {
    const physician = requirePatientPhysician(actor);
    if (!(await this.repository.isActivePhysician(physician.physicianId))) {
      throw new PatientError('forbidden');
    }
    const result = createPatientSchema.safeParse(input);
    if (!result.success)
      throw new PatientError('validation', 'Revisa el nombre del paciente.');
    return this.repository.register(result.data);
  }
  async list(actor: AppointmentActor | null, input: unknown) {
    const physician = requirePatientPhysician(actor);
    if (!(await this.repository.isActivePhysician(physician.physicianId))) {
      throw new PatientError('forbidden');
    }
    return this.repository.list(parsePatientQuery(input));
  }
}
