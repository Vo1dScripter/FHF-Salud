'use client';

import { useEffect, useState } from 'react';

import { appointmentStatusLabels } from '@/features/appointments';

import AppointmentActions from './AppointmentActions';
import {
  type AppointmentView,
  formatAppointmentDate,
  formatAppointmentRange,
} from './types';

export default function AppointmentDetail({
  appointment,
  canManage = false,
}: {
  appointment?: AppointmentView;
  canManage?: boolean;
}) {
  const [current, setCurrent] = useState<AppointmentView | undefined>(
    appointment,
  );

  useEffect(() => {
    setCurrent(appointment);
  }, [appointment]);

  return (
    <section className='appointments-state appointment-detail'>
      <h2>Detalle de la cita</h2>
      {current ? (
        <span
          className={`appointment-badge appointment-badge--${current.status}`}
        >
          {appointmentStatusLabels[current.status]}
        </span>
      ) : (
        <p>
          No se ha consultado ningún registro. Esta vista de propuesta no tiene
          una cita seleccionada.
        </p>
      )}
      <dl>
        <div>
          <dt>Identificador</dt>
          <dd>
            {current ? (
              <code className='appointment-id'>{current.id}</code>
            ) : (
              'Sin datos'
            )}
          </dd>
        </div>
        <div>
          <dt>Paciente</dt>
          <dd>{current?.patient.displayName ?? 'Sin datos'}</dd>
        </div>
        <div>
          <dt>Médico</dt>
          <dd>{current?.physician.displayName ?? 'Sin datos'}</dd>
        </div>
        <div>
          <dt>Inicio y fin</dt>
          <dd>
            {current
              ? formatAppointmentRange(
                  current.scheduledAt,
                  current.durationMinutes,
                )
              : 'Sin datos'}
          </dd>
        </div>
        <div>
          <dt>Motivo</dt>
          <dd>{current?.reason ?? 'Sin datos'}</dd>
        </div>
        {current?.status === 'cancelled' && (
          <div>
            <dt>Cancelación</dt>
            <dd>
              {current.cancelReason ?? 'Sin motivo registrado'}
              {current.cancelledAt
                ? ` · ${formatAppointmentDate(current.cancelledAt)}`
                : ''}
            </dd>
          </div>
        )}
        {current?.confirmedAt && current.status !== 'cancelled' && (
          <div>
            <dt>Confirmación</dt>
            <dd>{formatAppointmentDate(current.confirmedAt)}</dd>
          </div>
        )}
        <div>
          <dt>Auditoría</dt>
          <dd>
            {current
              ? `Creación: ${formatAppointmentDate(current.createdAt)} · Actualización: ${formatAppointmentDate(current.updatedAt)} · UTC−06:00`
              : 'Sin datos'}
          </dd>
        </div>
      </dl>
      <AppointmentActions
        appointment={current}
        canManage={canManage}
        onUpdated={setCurrent}
      />
    </section>
  );
}
