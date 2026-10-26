import Link from 'next/link';

import {
  appointmentRoutes,
  appointmentStatusLabels,
} from '@/features/appointments';

import AppointmentIcon from './AppointmentIcon';
import AppointmentState from './AppointmentState';
import { type AppointmentListState, formatAppointmentDate } from './types';

export default function AppointmentList({
  canCreate = true,
  detailHref = appointmentRoutes.detail,
  onClearFilters,
  onRetry,
  state = { kind: 'preparation' },
}: {
  /** Pista de presentación; el servidor vuelve a autorizar el alta. */
  canCreate?: boolean;
  detailHref?: (id: string) => string;
  onClearFilters?: () => void;
  onRetry?: () => void;
  state?: AppointmentListState;
}) {
  const isPreparation = state.kind === 'preparation';
  return (
    <section aria-label='Listado de citas'>
      <div className='appointments-list-heading'>
        <h2>{isPreparation ? 'Próximas citas' : 'Agenda médica'}</h2>
        {isPreparation ? (
          <button
            aria-describedby='appointment-preparation-note'
            className='appointment-new'
            disabled
            type='button'
          >
            <AppointmentIcon name='plus' />
            Nueva cita
          </button>
        ) : canCreate ? (
          <Link className='appointment-new' href={appointmentRoutes.new}>
            <AppointmentIcon name='plus' />
            Nueva cita
          </Link>
        ) : null}
      </div>
      {state.kind === 'populated' ? (
        state.appointments.length === 0 ? (
          <AppointmentState
            actionLabel='Limpiar filtros'
            kind='empty'
            onAction={onClearFilters}
          />
        ) : (
          <div className='appointments-table-wrap'>
            <table className='appointments-table'>
              <caption className='sr-only'>Citas médicas autorizadas</caption>
              <thead>
                <tr>
                  <th scope='col'>Paciente / Profesional</th>
                  <th scope='col'>Fecha, hora y duración</th>
                  <th scope='col'>Estado</th>
                  <th scope='col'>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {state.appointments.map((appointment) => (
                  <tr key={appointment.id}>
                    <td>
                      <div className='appointment-patient'>
                        {appointment.patient.displayName}
                      </div>
                      <div className='appointment-physician'>
                        {appointment.physician.displayName}
                      </div>
                      <p className='appointment-reason'>
                        Motivo: {appointment.reason}
                      </p>
                    </td>
                    <td>
                      <div className='appointment-date'>
                        {formatAppointmentDate(appointment.scheduledAt)}
                      </div>
                      <div className='appointment-zone'>
                        {appointment.durationMinutes} min · GMT-6 (CDMX)
                      </div>
                    </td>
                    <td>
                      <span
                        className={`appointment-badge appointment-badge--${appointment.status}`}
                      >
                        {appointmentStatusLabels[appointment.status]}
                      </span>
                    </td>
                    <td>
                      <Link
                        aria-label={`Detalles de la cita de ${appointment.patient.displayName}`}
                        href={detailHref(appointment.id)}
                      >
                        Detalles
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div id={isPreparation ? 'appointment-preparation-note' : undefined}>
          <AppointmentState
            actionHref={
              state.kind === 'unauthenticated'
                ? appointmentRoutes.access
                : undefined
            }
            description={state.kind === 'error' ? state.message : undefined}
            kind={state.kind}
            onAction={state.kind === 'empty' ? onClearFilters : undefined}
            onRetry={state.kind === 'error' ? onRetry : undefined}
          />
        </div>
      )}
    </section>
  );
}
