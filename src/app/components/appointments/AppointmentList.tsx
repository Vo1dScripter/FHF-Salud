import Link from 'next/link';

import {
  appointmentRoutes,
  appointmentStatusLabels,
} from '@/features/appointments';

import AppointmentIcon from './AppointmentIcon';
import AppointmentState from './AppointmentState';
import { type AppointmentListState, formatAppointmentDate } from './types';

export default function AppointmentList({
  state = { kind: 'preparation' },
  detailHref = appointmentRoutes.detail,
}: {
  state?: AppointmentListState;
  detailHref?: (id: string) => string;
}) {
  if (state.kind === 'populated') {
    if (!state.appointments.length) return <AppointmentState kind='empty' />;
    return (
      <div className='appointments-table-wrap'>
        <table className='appointments-table'>
          <caption className='sr-only'>Citas médicas autorizadas</caption>
          <thead>
            <tr>
              <th scope='col'>Paciente / Profesional</th>
              <th scope='col'>Fecha y Hora</th>
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
                  <div className='appointment-zone'>GMT-6 (CDMX)</div>
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
    );
  }
  if (state.kind !== 'preparation')
    return <AppointmentState kind={state.kind} />;
  return (
    <section aria-label='Listado de citas'>
      <div className='appointments-list-heading'>
        <h2>Próximas citas</h2>
        <button
          aria-describedby='appointment-preparation-note'
          className='appointment-new'
          disabled
          type='button'
        >
          <AppointmentIcon name='plus' />
          Nueva cita
        </button>
      </div>
      <div id='appointment-preparation-note'>
        <AppointmentState kind='preparation' />
      </div>
    </section>
  );
}
