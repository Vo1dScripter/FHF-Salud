'use client';

import Link from 'next/link';
import { useState } from 'react';

import {
  appointmentRoutes,
  appointmentStatusLabels,
  type AppointmentView,
} from '@/features/appointments';

import AppointmentActionDialog, {
  type AppointmentActionMode,
} from './AppointmentActionDialog';
import AppointmentIcon from './AppointmentIcon';
import AppointmentState from './AppointmentState';
import { type AppointmentListState, formatAppointmentDate } from './types';

export default function AppointmentList({
  canCreate = true,
  canManage = false,
  detailHref = appointmentRoutes.detail,
  onAppointmentUpdated,
  onClearFilters,
  onRetry,
  state = { kind: 'preparation' },
}: {
  /** Pista de presentación; el servidor vuelve a autorizar el alta. */
  canCreate?: boolean;
  /** Pista de presentación; el servidor vuelve a autorizar cada mutación. */
  canManage?: boolean;
  detailHref?: (id: string) => string;
  onAppointmentUpdated?: (appointment: AppointmentView) => void;
  onClearFilters?: () => void;
  onRetry?: () => void;
  state?: AppointmentListState;
}) {
  const [dialog, setDialog] = useState<{
    appointment: AppointmentView;
    mode: AppointmentActionMode;
  } | null>(null);
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
                {state.appointments.map((appointment) => {
                  const cancelled = appointment.status === 'cancelled';
                  return (
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
                        {appointment.cancelReason && (
                          <p className='appointment-reason'>
                            Cancelación: {appointment.cancelReason}
                          </p>
                        )}
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
                        <div className='appointment-row-actions'>
                          <Link
                            aria-label={`Detalles de la cita de ${appointment.patient.displayName}`}
                            href={detailHref(appointment.id)}
                          >
                            Detalles
                          </Link>
                          {canManage && (
                            <>
                              <button
                                aria-label={`Confirmar la cita de ${appointment.patient.displayName}`}
                                disabled={appointment.status !== 'pending'}
                                onClick={() =>
                                  setDialog({ appointment, mode: 'confirm' })
                                }
                                type='button'
                              >
                                Confirmar
                              </button>
                              <button
                                aria-label={`Editar la cita de ${appointment.patient.displayName}`}
                                disabled={cancelled}
                                onClick={() =>
                                  setDialog({ appointment, mode: 'edit' })
                                }
                                type='button'
                              >
                                Editar
                              </button>
                              <button
                                aria-label={`Cancelar la cita de ${appointment.patient.displayName}`}
                                disabled={cancelled}
                                onClick={() =>
                                  setDialog({ appointment, mode: 'cancel' })
                                }
                                type='button'
                              >
                                Cancelar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {dialog && (
        <AppointmentActionDialog
          appointment={dialog.appointment}
          mode={dialog.mode}
          onClose={() => setDialog(null)}
          onUpdated={(updated) => {
            setDialog(null);
            onAppointmentUpdated?.(updated);
          }}
        />
      )}
    </section>
  );
}
