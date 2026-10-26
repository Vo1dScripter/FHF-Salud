import { appointmentStatusLabels } from '@/features/appointments';

import AppointmentActions from './AppointmentActions';
import {
  type AppointmentView,
  formatAppointmentDate,
  formatAppointmentRange,
} from './types';

export default function AppointmentDetail({
  appointment,
}: {
  appointment?: AppointmentView;
}) {
  return (
    <section className='appointments-state appointment-detail'>
      <h2>Detalle de la cita</h2>
      {appointment ? (
        <span
          className={`appointment-badge appointment-badge--${appointment.status}`}
        >
          {appointmentStatusLabels[appointment.status]}
        </span>
      ) : (
        <p>
          No se ha consultado ningún registro. El acceso y el servicio de citas
          están pendientes de integración.
        </p>
      )}
      <dl>
        <div>
          <dt>Paciente</dt>
          <dd>{appointment?.patient.displayName ?? 'Pendiente de conexión'}</dd>
        </div>
        <div>
          <dt>Médico</dt>
          <dd>
            {appointment?.physician.displayName ?? 'Pendiente de conexión'}
          </dd>
        </div>
        <div>
          <dt>Inicio y fin</dt>
          <dd>
            {appointment
              ? formatAppointmentRange(
                  appointment.scheduledAt,
                  appointment.durationMinutes,
                )
              : 'Pendiente de conexión'}
          </dd>
        </div>
        <div>
          <dt>Motivo</dt>
          <dd>{appointment?.reason ?? 'Pendiente de conexión'}</dd>
        </div>
        <div>
          <dt>Auditoría</dt>
          <dd>
            {appointment
              ? `Creación: ${formatAppointmentDate(appointment.createdAt)} · Actualización: ${formatAppointmentDate(appointment.updatedAt)} · UTC−06:00`
              : 'Pendiente de conexión'}
          </dd>
        </div>
      </dl>
      <AppointmentActions />
    </section>
  );
}
