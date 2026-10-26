import type {
  Appointment,
  AppointmentActor,
  AppointmentDirectoryRepository,
  AppointmentReader,
  AppointmentRepository,
  AppointmentView,
  CreateAppointmentInput,
  RescheduleAppointmentInput,
} from '../contracts';
import { DefaultAppointmentAgendaService } from '../service';

const patientId = '22222222-2222-4222-8222-222222222222';
const physicianId = '33333333-3333-4333-8333-333333333333';
const otherPhysicianId = '44444444-4444-4444-8444-444444444444';
const appointmentId = '55555555-5555-4555-8555-555555555555';
const future = '2030-01-15T10:00:00-06:00';
const now = () => new Date('2026-10-25T12:00:00-06:00');

const staff: AppointmentActor = { role: 'receptionist', userId: 'user-staff' };
const physician: AppointmentActor = {
  physicianId,
  role: 'physician',
  userId: 'user-physician',
};

const input: CreateAppointmentInput = {
  durationMinutes: 30,
  patientId,
  physicianId,
  reason: 'Consulta sintética de prueba',
  scheduledAt: future,
};

const appointment: Appointment = {
  createdAt: '2026-10-24T12:00:00-06:00',
  durationMinutes: 30,
  id: appointmentId,
  patientId,
  physicianId,
  reason: input.reason,
  scheduledAt: future,
  status: 'pending',
  updatedAt: '2026-10-24T12:00:00-06:00',
};

const view: AppointmentView = {
  ...appointment,
  patient: { displayName: 'Paciente Sintético', id: patientId },
  physician: { displayName: 'Dra. Prueba', id: physicianId },
};

function createRepository(
  overrides: Partial<AppointmentRepository> = {},
): AppointmentRepository {
  return {
    cancel: jest.fn(
      async (): Promise<Appointment> => ({
        ...appointment,
        status: 'cancelled' as const,
      }),
    ),
    confirm: jest.fn(
      async (): Promise<Appointment> => ({
        ...appointment,
        status: 'confirmed',
      }),
    ),
    create: jest.fn(async () => appointment),
    findConflicts: jest.fn(async () => []),
    findById: jest.fn(async () => appointment),
    list: jest.fn(async () => [appointment]),
    reschedule: jest.fn(
      async (_id, value): Promise<Appointment> => ({
        ...appointment,
        ...value,
      }),
    ),
    ...overrides,
  };
}

function createReader(
  overrides: Partial<AppointmentReader> = {},
): AppointmentReader {
  return {
    findByIdView: jest.fn(async () => view),
    listView: jest.fn(async () => [view]),
    ...overrides,
  };
}

function createDirectory(
  overrides: Partial<AppointmentDirectoryRepository> = {},
): AppointmentDirectoryRepository {
  return {
    findPatient: jest.fn(async () => view.patient),
    findPhysician: jest.fn(async () => view.physician),
    listPatients: jest.fn(async () => [view.patient]),
    listPhysicians: jest.fn(async () => [view.physician]),
    ...overrides,
  };
}

function createService(
  overrides: {
    directory?: Partial<AppointmentDirectoryRepository>;
    reader?: Partial<AppointmentReader>;
    repository?: Partial<AppointmentRepository>;
  } = {},
) {
  const repository = createRepository(overrides.repository);
  const reader = createReader(overrides.reader);
  const directory = createDirectory(overrides.directory);
  return {
    directory,
    reader,
    repository,
    service: new DefaultAppointmentAgendaService(
      repository,
      reader,
      directory,
      now,
    ),
  };
}

describe('DefaultAppointmentAgendaService', () => {
  it('registra una cita válida con estado pending y referencias existentes', async () => {
    const { repository, service } = createService();

    await expect(service.create(staff, input)).resolves.toMatchObject({
      id: appointmentId,
      status: 'pending',
    });
    expect(repository.findConflicts).toHaveBeenCalledWith(
      physicianId,
      future,
      '2030-01-15T16:30:00.000Z',
    );
    expect(repository.create).toHaveBeenCalledWith(input);
  });

  it('rechaza campos incompletos antes de consultar la base', async () => {
    const { repository, service } = createService();

    await expect(
      service.create(staff, { ...input, reason: '   ' }),
    ).rejects.toMatchObject({
      code: 'validation',
      fieldErrors: { reason: 'El motivo de consulta es obligatorio.' },
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rechaza referencias inexistentes', async () => {
    const { repository, service } = createService({
      directory: { findPatient: jest.fn(async () => null) },
    });

    await expect(service.create(staff, input)).rejects.toMatchObject({
      code: 'validation',
      fieldErrors: { patientId: 'Selecciona un paciente existente.' },
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rechaza una cita en el pasado', async () => {
    const { service } = createService();

    await expect(
      service.create(staff, {
        ...input,
        scheduledAt: '2020-01-15T10:00:00-06:00',
      }),
    ).rejects.toMatchObject({
      code: 'validation',
      fieldErrors: { scheduledAt: 'Selecciona una fecha y hora futuras.' },
    });
  });

  it('rechaza una superposición del mismo médico', async () => {
    const { repository, service } = createService({
      repository: { findConflicts: jest.fn(async () => [appointment]) },
    });

    await expect(service.create(staff, input)).rejects.toMatchObject({
      code: 'conflict',
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('acepta médicos diferentes porque la consulta de conflictos está acotada al médico', async () => {
    const { repository, service } = createService();

    await expect(
      service.create(staff, { ...input, physicianId: otherPhysicianId }),
    ).resolves.toMatchObject({ id: appointmentId });
    expect(repository.findConflicts).toHaveBeenCalledWith(
      otherPhysicianId,
      future,
      '2030-01-15T16:30:00.000Z',
    );
  });

  it('traduce el conflicto concurrente de la restricción de base de datos', async () => {
    const { service } = createService({
      repository: {
        create: jest.fn(async () => {
          throw { code: '23P01' };
        }),
      },
    });

    await expect(service.create(staff, input)).rejects.toMatchObject({
      code: 'conflict',
    });
  });

  it('consulta la agenda con las referencias resueltas', async () => {
    const { reader, service } = createService();

    await expect(service.list(staff, { status: 'confirmed' })).resolves.toEqual([
      view,
    ]);
    expect(reader.listView).toHaveBeenCalledWith({ status: 'confirmed' });
  });

  it('devuelve una lista vacía como consulta exitosa', async () => {
    const { service } = createService({
      reader: { listView: jest.fn(async () => []) },
    });

    await expect(service.list(staff)).resolves.toEqual([]);
  });

  it('acota la agenda de un médico a su propio identificador', async () => {
    const { reader, service } = createService();

    await expect(service.list(physician)).resolves.toEqual([view]);
    expect(reader.listView).toHaveBeenCalledWith({ physicianId });
  });

  it('deniega a un médico consultar la agenda de otro médico', async () => {
    const { service } = createService();

    await expect(
      service.list(physician, { physicianId: otherPhysicianId }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('oculta a un médico una cita de otro médico en el detalle', async () => {
    const { service } = createService({
      reader: {
        findByIdView: jest.fn(async () => ({
          ...view,
          physicianId: otherPhysicianId,
        })),
      },
    });

    await expect(service.getById(physician, appointmentId)).resolves.toBeNull();
  });

  it('deniega a un médico registrar citas', async () => {
    const { repository, service } = createService();

    await expect(service.create(physician, input)).rejects.toMatchObject({
      code: 'forbidden',
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('entrega a un médico solo su propia referencia y ningún paciente', async () => {
    const { directory, service } = createService();

    await expect(service.listReferences(physician)).resolves.toEqual({
      canCreate: false,
      canManage: false,
      patients: [],
      physicians: [view.physician],
    });
    expect(directory.findPhysician).toHaveBeenCalledWith(physicianId);
    expect(directory.listPatients).not.toHaveBeenCalled();
  });

  it('entrega el directorio completo al personal autorizado', async () => {
    const { service } = createService();

    await expect(service.listReferences(staff)).resolves.toEqual({
      canCreate: true,
      canManage: true,
      patients: [view.patient],
      physicians: [view.physician],
    });
  });

  it('convierte un fallo de conexión en unavailable, no en lista vacía', async () => {
    const { service } = createService({
      reader: {
        listView: jest.fn(async () => {
          throw new Error('network down');
        }),
      },
    });

    await expect(service.list(staff)).rejects.toMatchObject({
      code: 'unavailable',
    });
  });

  describe('RF-03, RF-04 y RF-06', () => {
    it('confirma una cita pendiente y devuelve el nuevo estado', async () => {
      const { repository, service } = createService();

      await expect(
        service.confirm(staff, appointmentId, appointment.updatedAt),
      ).resolves.toMatchObject({ id: appointmentId, status: 'confirmed' });
      expect(repository.confirm).toHaveBeenCalledWith(
        appointmentId,
        appointment.updatedAt,
      );
    });

    it('rechaza confirmar una cita cancelada', async () => {
      const { repository, service } = createService({
        reader: {
          findByIdView: jest.fn(async () => ({
            ...view,
            status: 'cancelled' as const,
          })),
        },
      });

      await expect(
        service.confirm(staff, appointmentId, appointment.updatedAt),
      ).rejects.toMatchObject({ code: 'validation' });
      expect(repository.confirm).not.toHaveBeenCalled();
    });

    it('no repite efectos al confirmar una cita ya confirmada', async () => {
      const { repository, service } = createService({
        reader: {
          findByIdView: jest.fn(async () => ({
            ...view,
            status: 'confirmed' as const,
          })),
        },
      });

      await expect(
        service.confirm(staff, appointmentId, appointment.updatedAt),
      ).resolves.toMatchObject({ status: 'confirmed' });
      expect(repository.confirm).not.toHaveBeenCalled();
    });

    it('rechaza una mutación basada en una versión desactualizada', async () => {
      const { repository, service } = createService();

      await expect(
        service.confirm(
          staff,
          appointmentId,
          '2026-10-24T11:00:00-06:00',
        ),
      ).rejects.toMatchObject({ code: 'stale' });
      expect(repository.confirm).not.toHaveBeenCalled();
    });

    it('traduce la versión desactualizada detectada por PostgreSQL', async () => {
      const { service } = createService({
        repository: {
          confirm: jest.fn(async () => {
            throw { code: 'PT409' };
          }),
        },
      });

      await expect(
        service.confirm(staff, appointmentId, appointment.updatedAt),
      ).rejects.toMatchObject({ code: 'stale' });
    });

    it('rechaza una mutación de una cita inexistente', async () => {
      const { repository, service } = createService({
        reader: { findByIdView: jest.fn(async () => null) },
      });

      await expect(
        service.confirm(staff, appointmentId, appointment.updatedAt),
      ).rejects.toMatchObject({ code: 'not_found' });
      expect(repository.confirm).not.toHaveBeenCalled();
    });

    it('rechaza una reprogramación con duración no permitida', async () => {
      const { repository, service } = createService();

      await expect(
        service.reschedule(
          staff,
          appointmentId,
          {
            durationMinutes:
              20 as RescheduleAppointmentInput['durationMinutes'],
            scheduledAt: '2030-01-16T11:00:00-06:00',
          },
          appointment.updatedAt,
        ),
      ).rejects.toMatchObject({ code: 'validation' });
      expect(repository.reschedule).not.toHaveBeenCalled();
    });

    it('reprograma a un horario libre y excluye la propia cita', async () => {
      const { repository, service } = createService();
      const reschedule = {
        durationMinutes: 45 as const,
        scheduledAt: '2030-01-16T11:00:00-06:00',
      };

      await expect(
        service.reschedule(
          staff,
          appointmentId,
          reschedule,
          appointment.updatedAt,
        ),
      ).resolves.toMatchObject({
        id: appointmentId,
        scheduledAt: reschedule.scheduledAt,
        durationMinutes: 45,
      });
      expect(repository.findConflicts).toHaveBeenCalledWith(
        physicianId,
        reschedule.scheduledAt,
        '2030-01-16T17:45:00.000Z',
        appointmentId,
      );
      expect(repository.reschedule).toHaveBeenCalledWith(
        appointmentId,
        reschedule,
        appointment.updatedAt,
      );
    });

    it('rechaza un horario ocupado sin escribir la cita', async () => {
      const { repository, service } = createService({
        repository: {
          findConflicts: jest.fn(async () => [appointment]),
        },
      });

      await expect(
        service.reschedule(
          staff,
          appointmentId,
          {
            durationMinutes: 30,
            scheduledAt: '2030-01-16T11:00:00-06:00',
          },
          appointment.updatedAt,
        ),
      ).rejects.toMatchObject({ code: 'conflict' });
      expect(repository.reschedule).not.toHaveBeenCalled();
    });

    it('traduce el conflicto concurrente al reprogramar', async () => {
      const { service } = createService({
        repository: {
          reschedule: jest.fn(async () => {
            throw { code: '23P01' };
          }),
        },
      });

      await expect(
        service.reschedule(
          staff,
          appointmentId,
          {
            durationMinutes: 30,
            scheduledAt: '2030-01-16T11:00:00-06:00',
          },
          appointment.updatedAt,
        ),
      ).rejects.toMatchObject({ code: 'conflict' });
    });

    it('rechaza reprogramar una cita cancelada', async () => {
      const { repository, service } = createService({
        reader: {
          findByIdView: jest.fn(async () => ({
            ...view,
            status: 'cancelled' as const,
          })),
        },
      });

      await expect(
        service.reschedule(
          staff,
          appointmentId,
          {
            durationMinutes: 30,
            scheduledAt: '2030-01-16T11:00:00-06:00',
          },
          appointment.updatedAt,
        ),
      ).rejects.toMatchObject({ code: 'validation' });
      expect(repository.reschedule).not.toHaveBeenCalled();
    });

    it('documenta que reprogramar una confirmada la devuelve a pendiente', async () => {
      const { service } = createService({
        reader: {
          findByIdView: jest.fn(async () => ({
            ...view,
            status: 'confirmed' as const,
          })),
        },
        repository: {
          reschedule: jest.fn(async () => ({
            ...appointment,
            scheduledAt: '2030-01-16T11:00:00-06:00',
            status: 'pending' as const,
          })),
        },
      });

      await expect(
        service.reschedule(
          staff,
          appointmentId,
          {
            durationMinutes: 30,
            scheduledAt: '2030-01-16T11:00:00-06:00',
          },
          appointment.updatedAt,
        ),
      ).resolves.toMatchObject({ status: 'pending' });
    });

    it('cancela conservando el registro y guarda el motivo', async () => {
      const { repository, service } = createService({
        repository: {
          cancel: jest.fn(async () => ({
            ...appointment,
            cancelReason: 'Paciente no puede asistir',
            status: 'cancelled' as const,
          })),
        },
      });

      await expect(
        service.cancel(
          staff,
          appointmentId,
          { reason: 'Paciente no puede asistir' },
          appointment.updatedAt,
        ),
      ).resolves.toMatchObject({
        cancelReason: 'Paciente no puede asistir',
        id: appointmentId,
        status: 'cancelled' as const,
      });
      expect(repository.cancel).toHaveBeenCalledWith(
        appointmentId,
        { reason: 'Paciente no puede asistir' },
        appointment.updatedAt,
      );
    });

    it('repetir una cancelación no vuelve a escribir ni auditar', async () => {
      const cancelledView: AppointmentView = {
        ...view,
        cancelReason: 'Paciente no puede asistir',
        status: 'cancelled' as const,
      };
      const { repository, service } = createService({
        reader: { findByIdView: jest.fn(async () => cancelledView) },
      });

      await expect(
        service.cancel(
          staff,
          appointmentId,
          { reason: 'Paciente no puede asistir' },
          appointment.updatedAt,
        ),
      ).resolves.toEqual(cancelledView);
      expect(repository.cancel).not.toHaveBeenCalled();
    });

    it('exige un motivo de cancelación', async () => {
      const { repository, service } = createService();

      await expect(
        service.cancel(
          staff,
          appointmentId,
          { reason: '   ' },
          appointment.updatedAt,
        ),
      ).rejects.toMatchObject({
        code: 'validation',
        fieldErrors: { reason: 'Indica el motivo de la cancelación.' },
      });
      expect(repository.cancel).not.toHaveBeenCalled();
    });

    it('deniega las mutaciones a un médico', async () => {
      const { repository, service } = createService();

      await expect(
        service.confirm(physician, appointmentId, appointment.updatedAt),
      ).rejects.toMatchObject({ code: 'forbidden' });
      expect(repository.confirm).not.toHaveBeenCalled();
    });
  });
});
