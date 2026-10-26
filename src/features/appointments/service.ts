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
  CancelAppointmentInput,
  CreateAppointmentInput,
  IsoDateTime,
  RescheduleAppointmentInput,
} from './contracts';
import { AppointmentError, mapDatabaseError } from './errors';
import {
  appointmentEndIso,
  assertScheduledAtNotPast,
  parseAppointmentQuery,
  parseCancelAppointmentInput,
  parseCreateAppointmentInput,
  parseExpectedUpdatedAt,
  parseRescheduleAppointmentInput,
} from './validation';

function isStaff(
  actor: AppointmentActor,
): actor is Extract<AppointmentActor, { role: 'admin' | 'receptionist' }> {
  return actor.role === 'admin' || actor.role === 'receptionist';
}

/**
 * Servicio de aplicación de RF-01, RF-02, RF-03, RF-04, RF-05 y RF-06.
 *
 * Reglas conservadoras documentadas:
 * - La agenda la opera personal autenticado (admin/recepción).
 * - Un médico autenticado solo puede leer su propia agenda y no mutarla.
 * - El estado inicial siempre es pending y lo fija el servidor.
 * - Confirmar solo aplica a pendientes; confirmar una cancelada se rechaza.
 * - Reprogramar una confirmada la devuelve a pending para revalidar el nuevo
 *   horario. Una cancelada no se puede reprogramar.
 * - Cancelar conserva la fila; repetir la cancelación es idempotente y no
 *   genera otra auditoría.
 * - Las mutaciones exigen `expectedUpdatedAt`; la persistencia vuelve a
 *   comprobarlo bajo bloqueo y la restricción de exclusión resuelve carreras.
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
          canManage: false,
          patients: [],
          physicians: physician ? [physician] : [],
        };
      }
      const [patients, physicians] = await Promise.all([
        this.directory.listPatients(),
        this.directory.listPhysicians(),
      ]);
      return { canCreate: true, canManage: true, patients, physicians };
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  async confirm(
    actor: AppointmentActor,
    id: AppointmentId,
    rawExpectedUpdatedAt: IsoDateTime,
  ): Promise<AppointmentView> {
    this.assertCanManage(actor);
    this.assertValidId(id);
    const expectedUpdatedAt = parseExpectedUpdatedAt(rawExpectedUpdatedAt);
    const current = await this.loadForMutation(id);

    if (current.status === 'cancelled') {
      throw new AppointmentError(
        'validation',
        'No se puede confirmar una cita cancelada.',
        { status: 'La cita está cancelada.' },
      );
    }
    if (current.status === 'confirmed') {
      // Confirmar de nuevo no produce efectos ni auditoría adicional.
      return current;
    }

    this.assertExpectedVersion(current, expectedUpdatedAt);

    try {
      const updated = await this.repository.confirm(id, expectedUpdatedAt);
      return this.withReferences(updated, current);
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  async reschedule(
    actor: AppointmentActor,
    id: AppointmentId,
    rawInput: RescheduleAppointmentInput,
    rawExpectedUpdatedAt: IsoDateTime,
  ): Promise<AppointmentView> {
    this.assertCanManage(actor);
    this.assertValidId(id);
    const input = parseRescheduleAppointmentInput(rawInput);
    const expectedUpdatedAt = parseExpectedUpdatedAt(rawExpectedUpdatedAt);
    const current = await this.loadForMutation(id);

    if (current.status === 'cancelled') {
      throw new AppointmentError(
        'validation',
        'No se puede reprogramar una cita cancelada.',
        { status: 'La cita está cancelada.' },
      );
    }

    assertScheduledAtNotPast(input.scheduledAt, this.now());
    this.assertExpectedVersion(current, expectedUpdatedAt);

    const endsAt = appointmentEndIso(
      input.scheduledAt,
      input.durationMinutes,
    );

    try {
      const conflicts = await this.repository.findConflicts(
        current.physicianId,
        input.scheduledAt,
        endsAt,
        id,
      );
      if (conflicts.length > 0) {
        throw new AppointmentError(
          'conflict',
          'El nuevo horario ya está ocupado para este médico.',
          { scheduledAt: 'Selecciona otro horario disponible.' },
        );
      }
      const updated = await this.repository.reschedule(
        id,
        input,
        expectedUpdatedAt,
      );
      return this.withReferences(updated, current);
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  async cancel(
    actor: AppointmentActor,
    id: AppointmentId,
    rawInput: CancelAppointmentInput,
    rawExpectedUpdatedAt: IsoDateTime,
  ): Promise<AppointmentView> {
    this.assertCanManage(actor);
    this.assertValidId(id);
    const input = parseCancelAppointmentInput(rawInput);
    const expectedUpdatedAt = parseExpectedUpdatedAt(rawExpectedUpdatedAt);
    const current = await this.loadForMutation(id);

    if (current.status === 'cancelled') {
      // La fila se conserva y un reintento no vuelve a escribir ni auditar.
      return current;
    }

    this.assertExpectedVersion(current, expectedUpdatedAt);

    try {
      const updated = await this.repository.cancel(
        id,
        input,
        expectedUpdatedAt,
      );
      return this.withReferences(updated, current);
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  private async loadForMutation(
    id: AppointmentId,
  ): Promise<AppointmentView> {
    let current: AppointmentView | null;
    try {
      current = await this.reader.findByIdView(id);
    } catch (error) {
      throw mapDatabaseError(error);
    }
    if (!current) {
      throw new AppointmentError('not_found');
    }
    return current;
  }

  private assertExpectedVersion(
    current: AppointmentView,
    expectedUpdatedAt: IsoDateTime,
  ): void {
    if (current.updatedAt !== expectedUpdatedAt) {
      throw new AppointmentError('stale');
    }
  }

  private withReferences(
    updated: Appointment,
    current: AppointmentView,
  ): AppointmentView {
    return {
      ...updated,
      patient: current.patient,
      physician: current.physician,
    };
  }

  private assertCanCreate(actor: AppointmentActor): void {
    if (!isStaff(actor)) {
      throw new AppointmentError(
        'forbidden',
        'Solo administración o recepción puede registrar citas.',
      );
    }
  }

  private assertCanManage(actor: AppointmentActor): void {
    if (!isStaff(actor)) {
      throw new AppointmentError(
        'forbidden',
        'Solo administración o recepción puede modificar citas.',
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
