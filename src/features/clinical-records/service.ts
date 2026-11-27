import type { AppointmentActor } from '@/features/appointments/contracts';

import { evaluateClinicalAccess } from './access';
import type {
  ClinicalActor,
  ClinicalHistory,
  ClinicalRepository,
  SaveClinicalRevisionInput,
  SaveClinicalRevisionResult,
} from './contracts';
import { ClinicalError } from './errors';
import {
  parseClinicalPatientId,
  parseClinicalRevisionInput,
} from './validation';

export function requireClinicalPhysician(
  actor: AppointmentActor | null,
): ClinicalActor {
  const decision = evaluateClinicalAccess(actor);
  if (!decision.allowed) throw new ClinicalError(decision.code);
  return decision.actor;
}

/**
 * Autoriza, valida y delega. La sesión se recibe desde el servidor; nunca se
 * acepta médico, rol, autor ni fecha del cuerpo de la petición.
 */
export class ClinicalRecordService {
  constructor(private readonly repository: ClinicalRepository) {}

  async getHistory(
    actor: AppointmentActor | null,
    patientId: unknown,
  ): Promise<ClinicalHistory> {
    const physician = requireClinicalPhysician(actor);
    const id = parseClinicalPatientId(patientId);
    if (!(await this.repository.isActivePhysician(physician.physicianId))) {
      throw new ClinicalError('forbidden');
    }
    return this.repository.getHistory(id, physician.physicianId);
  }

  async saveRevision(
    actor: AppointmentActor | null,
    patientId: unknown,
    input: unknown,
  ): Promise<SaveClinicalRevisionResult> {
    const physician = requireClinicalPhysician(actor);
    const id = parseClinicalPatientId(patientId);
    if (!(await this.repository.isActivePhysician(physician.physicianId))) {
      throw new ClinicalError('forbidden');
    }
    const parsed = parseClinicalRevisionInput(input);
    const revision = await this.repository.saveRevision(
      id,
      parsed satisfies SaveClinicalRevisionInput,
    );
    const history = await this.repository.getHistory(id, physician.physicianId);
    return { history, revision };
  }
}
