'use client';

import { useEffect, useState } from 'react';

import { readAppointmentClientError } from '@/lib/appointments/client';

import {
  APPOINTMENT_DURATIONS,
  appointmentApiRoutes,
  type AppointmentDurationMinutes,
  type AppointmentView,
  localDateTimeInputValue,
  localDateTimeToIso,
} from '@/features/appointments';

import AppointmentIcon from './AppointmentIcon';

export type AppointmentActionMode = 'cancel' | 'confirm' | 'edit';

const titles: Record<AppointmentActionMode, string> = {
  cancel: 'Cancelar cita',
  confirm: 'Confirmar cita',
  edit: 'Editar horario de la cita',
};

/**
 * Diálogo único para las tres mutaciones. No informa éxito hasta recibir una
 * respuesta 2xx con la cita actualizada; un rechazo de la API conserva el
 * horario y muestra el error real.
 */
export default function AppointmentActionDialog({
  appointment,
  mode,
  onClose,
  onUpdated,
}: {
  appointment: AppointmentView;
  mode: AppointmentActionMode;
  onClose: () => void;
  onUpdated: (appointment: AppointmentView) => void;
}) {
  const [scheduledAt, setScheduledAt] = useState(() =>
    localDateTimeInputValue(new Date(appointment.scheduledAt)),
  );
  const [durationMinutes, setDurationMinutes] = useState(
    String(appointment.durationMinutes),
  );
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldError(null);

    if (mode === 'cancel' && !reason.trim()) {
      setFieldError('Indica el motivo de la cancelación.');
      return;
    }

    let body: Record<string, unknown> = {
      action: mode === 'edit' ? 'reschedule' : mode,
      expectedUpdatedAt: appointment.updatedAt,
    };

    if (mode === 'edit') {
      if (!scheduledAt) {
        setFieldError('Indica la nueva fecha y hora.');
        return;
      }
      try {
        body = {
          ...body,
          durationMinutes: Number(
            durationMinutes,
          ) as AppointmentDurationMinutes,
          scheduledAt: localDateTimeToIso(scheduledAt),
        };
      } catch {
        setFieldError('La fecha y hora no son válidas.');
        return;
      }
    }
    if (mode === 'cancel') {
      body = { ...body, reason: reason.trim() };
    }

    setBusy(true);
    try {
      const response = await fetch(appointmentApiRoutes.detail(appointment.id), {
        body: JSON.stringify(body),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'PATCH',
      });

      if (!response.ok) {
        const clientError = await readAppointmentClientError(response);
        setFieldError(
          clientError.fieldErrors?.scheduledAt ??
            clientError.fieldErrors?.reason ??
            null,
        );
        setError(clientError.message);
        return;
      }

      let data: { appointment?: AppointmentView };
      try {
        data = (await response.json()) as { appointment?: AppointmentView };
      } catch {
        setError(
          'El servidor aceptó el cambio, pero no se pudo leer la confirmación. Recarga la agenda para comprobar el estado.',
        );
        return;
      }
      if (!data.appointment) {
        setError(
          'El servidor aceptó el cambio, pero no devolvió la cita actualizada. Recarga la agenda para comprobarla.',
        );
        return;
      }
      onUpdated(data.appointment);
      onClose();
    } catch {
      setError(
        'No se pudo conectar con el servicio de citas. No se mostró ningún guardado; comprueba tu conexión e inténtalo de nuevo.',
      );
    } finally {
      setBusy(false);
    }
  }

  const statusCopy =
    mode === 'edit' && appointment.status === 'confirmed'
      ? 'Esta cita está confirmada. Al cambiar el horario volverá a Pendiente para confirmar el nuevo horario.'
      : null;

  return (
    <div
      className='appointment-dialog-backdrop'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        aria-describedby='appointment-dialog-description'
        aria-labelledby='appointment-dialog-title'
        aria-modal='true'
        className='appointment-form-panel appointment-dialog'
        onMouseDown={(event) => event.stopPropagation()}
        role='dialog'
      >
        <h2 id='appointment-dialog-title'>{titles[mode]}</h2>
        <p id='appointment-dialog-description'>
          {appointment.patient.displayName} ·{' '}
          {appointment.physician.displayName}
        </p>

        {mode === 'cancel' && (
          <p className='appointment-dialog-warning'>
            <AppointmentIcon name='warning' />
            <span>
              La cita no se eliminará. Se conservará en el historial con su
              motivo y el horario quedará disponible para otra cita.
            </span>
          </p>
        )}
        {mode === 'confirm' && (
          <p className='appointment-dialog-warning'>
            <AppointmentIcon name='info' />
            <span>
              La cita pasará a Confirmada y se reflejará en el listado y la
              agenda.
            </span>
          </p>
        )}
        {statusCopy && (
          <p className='appointment-dialog-warning'>
            <AppointmentIcon name='info' />
            <span>{statusCopy}</span>
          </p>
        )}

        <form
          aria-busy={busy}
          className='appointment-form'
          noValidate
          onSubmit={handleSubmit}
        >
          {mode === 'edit' && (
            <>
              <div className='appointment-field'>
                <label htmlFor='appointment-edit-start'>
                  Fecha y hora de inicio
                </label>
                <input
                  autoFocus
                  id='appointment-edit-start'
                  onChange={(event) => {
                    setScheduledAt(event.target.value);
                    setFieldError(null);
                    setError(null);
                  }}
                  required
                  type='datetime-local'
                  value={scheduledAt}
                />
              </div>
              <div className='appointment-field'>
                <label htmlFor='appointment-edit-duration'>Duración</label>
                <select
                  id='appointment-edit-duration'
                  onChange={(event) => {
                    setDurationMinutes(event.target.value);
                    setError(null);
                  }}
                  value={durationMinutes}
                >
                  {APPOINTMENT_DURATIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} minutos
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {mode === 'cancel' && (
            <div className='appointment-field appointment-field--wide'>
              <label htmlFor='appointment-cancel-reason'>
                Motivo de cancelación
              </label>
              <textarea
                autoFocus
                id='appointment-cancel-reason'
                onChange={(event) => {
                  setReason(event.target.value);
                  setFieldError(null);
                  setError(null);
                }}
                placeholder='Explica brevemente por qué se cancela la cita'
                required
                rows={3}
                value={reason}
              />
            </div>
          )}

          {fieldError && (
            <p className='appointment-field--wide' role='alert'>
              {fieldError}
            </p>
          )}
          {error && (
            <p
              className='appointment-form-note appointment-field--wide'
              role='alert'
            >
              <AppointmentIcon name='warning' />
              <span>{error}</span>
            </p>
          )}

          <div className='appointment-form-actions appointment-field--wide'>
            <button disabled={busy} onClick={onClose} type='button'>
              Volver
            </button>
            <button disabled={busy} type='submit'>
              {busy
                ? 'Guardando…'
                : mode === 'edit'
                  ? 'Guardar cambios'
                  : mode === 'cancel'
                    ? 'Sí, cancelar cita'
                    : 'Sí, confirmar cita'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
