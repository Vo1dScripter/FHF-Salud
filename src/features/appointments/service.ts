import type {
  Appointment,
  AppointmentActor,
  AppointmentAgendaService,
  AppointmentDirectory,
  AppointmentDirectoryRepository,
  AppointmentId,
  AppointmentQuery,
  AppointmentReader,
  AppointmentRepository,
  AppointmentView,
  CreateAppointmentInput,
} from './contracts';
import { AppointmentError, mapDatabaseError } from './errors';
import {
  appointmentEndIso,
  assertScheduledAtNotPast,
  parseAppointmentQuery,
  parseCreateAppointmentInput,
} from './validation';

function isStaff(
  actor: AppointmentActor,
): actor is Extract<AppointmentActor, { role: 'admin' | 'receptionist' }> {
  return actor.role === 'admin' || actor.role === 'receptionist';
}

/**
 * Servicio de aplicación de RF-01, RF-02 y RF-05.
 *
 * Suposiciones conservadoras documentadas:
 * - La agenda la opera personal autenticado (admin/recepción).
 * - Un médico autenticado solo puede leer su propia agenda.
 * - El estado inicial siempre es pending y lo fija el servidor.
 * - No se implementan confirmación, reprogramación ni cancelación.
 */
export class DefaultAppointmentAgendaService
  implements AppointmentAgendaService
{
  constructor(
    private readonly repository: AppointmentRepository,
    private readonly reader: AppointmentReader,
    private readonly directory: AppointmentDirectoryRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(
    actor: AppointmentActor,
    rawInput: CreateAppointmentInput,
  ): Promise<Appointment> {
    this.assertCanCreate(actor);
    const input = parseCreateAppointmentInput(rawInput);
    assertScheduledAtNotPast(input.scheduledAt, this.now());

    const [patient, physician] = await Promise.all([
      this.directory.findPatient(input.patientId),
      this.directory.findPhysician(input.physicianId),
    ]);
    if (!patient) {
      throw new AppointmentError(
        'validation',
        'El paciente seleccionado no existe o no está activo.',
        { patientId: 'Selecciona un paciente existente.' },
      );
    }
    if (!physician) {
      throw new AppointmentError(
        'validation',
        'El médico seleccionado no existe o no está activo.',
        { physicianId: 'Selecciona un médico existente.' },
      );
    }

    const endsAt = appointmentEndIso(
      input.scheduledAt,
      input.durationMinutes,
    );

    try {
      const conflicts = await this.repository.findConflicts(
        input.physicianId,
        input.scheduledAt,
        endsAt,
      );
      if (conflicts.length > 0) {
        throw new AppointmentError('conflict');
      }
      return await this.repository.create(input);
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  async getById(
    actor: AppointmentActor,
    id: AppointmentId,
  ): Promise<AppointmentView | null> {
    this.assertValidId(id);
    let appointment: AppointmentView | null;
    try {
      appointment = await this.reader.findByIdView(id);
    } catch (error) {
      throw mapDatabaseError(error);
    }
    if (!appointment) return null;
    if (actor.role === 'physician' && appointment.physicianId !== actor.physicianId) {
      return null;
    }
    return appointment;
  }

  async list(
    actor: AppointmentActor,
    rawQuery: AppointmentQuery = {},
  ): Promise<AppointmentView[]> {
    const query = parseAppointmentQuery(rawQuery);
    if (actor.role === 'physician') {
      if (query.physicianId && query.physicianId !== actor.physicianId) {
        throw new AppointmentError('forbidden');
      }
      query.physicianId = actor.physicianId;
    }
    try {
      return await this.reader.listView(query);
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  async listReferences(
    actor: AppointmentActor,
  ): Promise<AppointmentDirectory> {
    try {
      if (actor.role === 'physician') {
        const physician = await this.directory.findPhysician(
          actor.physicianId,
        );
        return {
          canCreate: false,
          patients: [],
          physicians: physician ? [physician] : [],
        };
      }
      const [patients, physicians] = await Promise.all([
        this.directory.listPatients(),
        this.directory.listPhysicians(),
      ]);
      return { canCreate: true, patients, physicians };
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  private assertCanCreate(actor: AppointmentActor): void {
    if (!isStaff(actor)) {
      throw new AppointmentError(
        'forbidden',
        'Solo administración o recepción puede registrar citas.',
      );
    }
  }

  private assertValidId(id: AppointmentId): void {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      throw new AppointmentError('validation', 'El identificador no es válido.');
    }
  }
}
