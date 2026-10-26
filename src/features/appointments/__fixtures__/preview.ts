import type { AppointmentView } from '@/app/components/appointments/types';

/** Datos sintéticos públicos para QA opt-in. No son fallback ni una fuente productiva. */
export const appointmentPreviewRecords: AppointmentView[] = [
  {
    id: 'preview-1',
    patientId: 'preview-patient-1',
    physicianId: 'preview-physician-1',
    patient: {
      id: 'preview-patient-1',
      displayName: 'Hernández Rodríguez, Maximiliano Alejandro',
    },
    physician: {
      id: 'preview-physician-1',
      displayName: 'Dra. Sofía Valenzuela (Cardiología)',
    },
    scheduledAt: '2026-10-15T09:30:00-06:00',
    durationMinutes: 30,
    reason:
      'Consulta de seguimiento y revisión de indicaciones del tratamiento.',
    status: 'confirmed',
    createdAt: '2026-10-14T12:00:00-06:00',
    updatedAt: '2026-10-14T12:30:00-06:00',
  },
  {
    id: 'preview-2',
    patientId: 'preview-patient-2',
    physicianId: 'preview-physician-2',
    patient: {
      id: 'preview-patient-2',
      displayName: 'García-López de la Vega, María de los Ángeles',
    },
    physician: {
      id: 'preview-physician-2',
      displayName: 'Dr. Roberto Méndez (General)',
    },
    scheduledAt: '2026-10-15T11:00:00-06:00',
    durationMinutes: 30,
    reason:
      'Consulta de seguimiento y revisión de indicaciones del tratamiento.',
    status: 'pending',
    createdAt: '2026-10-14T12:00:00-06:00',
    updatedAt: '2026-10-14T12:00:00-06:00',
  },
  {
    id: 'preview-3',
    patientId: 'preview-patient-3',
    physicianId: 'preview-physician-1',
    patient: { id: 'preview-patient-3', displayName: 'Ramírez, Juan Carlos' },
    physician: {
      id: 'preview-physician-1',
      displayName: 'Dra. Sofía Valenzuela (Cardiología)',
    },
    scheduledAt: '2026-10-16T08:00:00-06:00',
    durationMinutes: 30,
    reason:
      'Seguimiento de tratamiento hipertensivo tras cirugía y revisión de indicaciones para el seguimiento con su profesional.',
    status: 'cancelled',
    createdAt: '2026-10-14T12:00:00-06:00',
    updatedAt: '2026-10-15T12:00:00-06:00',
  },
];

/** Registro de muestra de la variante de detalle del borrador; otra cita del mismo paciente. */
export const appointmentPreviewDetail: AppointmentView = {
  ...appointmentPreviewRecords[0],
  id: 'preview-detail',
  physician: {
    id: 'preview-physician-1',
    displayName: 'Dra. Sofía Valenzuela',
  },
  scheduledAt: '2026-10-20T09:30:00-06:00',
  reason:
    'Seguimiento del tratamiento y revisión de indicaciones para el siguiente periodo de atención.',
  createdAt: '2026-10-19T12:00:00-06:00',
  updatedAt: '2026-10-19T12:30:00-06:00',
};
