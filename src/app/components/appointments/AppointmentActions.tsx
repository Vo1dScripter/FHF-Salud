'use client';

import { useState } from 'react';

import type { AppointmentView } from '@/features/appointments';

import AppointmentActionDialog, {
  type AppointmentActionMode,
} from './AppointmentActionDialog';

/** Acciones del detalle. Sin cita o sin permiso se mantienen deshabilitadas. */
export default function AppointmentActions({
  appointment,
  canManage = false,
  onUpdated,
}: {
  appointment?: AppointmentView;
  canManage?: boolean;
  onUpdated?: (appointment: AppointmentView) => void;
}) {
  const [mode, setMode] = useState<AppointmentActionMode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cancelled = appointment?.status === 'cancelled';
  const canChange = Boolean(appointment && canManage && !cancelled);
  const canConfirm = Boolean(
    appointment && canManage && appointment.status === 'pending',
  );

  const note = !appointment
    ? 'Selecciona una cita para habilitar sus acciones.'
    : !canManage
      ? 'Tu cuenta puede consultar la agenda, pero no modificarla.'
      : cancelled
        ? 'La cita está cancelada. Su registro se conserva y el horario quedó libre; no admite más cambios.'
        : appointment.status === 'confirmed'
          ? 'La cita ya está confirmada. Reprogramarla la devolverá a Pendiente para validar el nuevo horario.'
          : 'Las acciones se validan en el servidor y se reflejan en la agenda.';

  return (
    <div className='appointment-actions-region'>
      <div
        aria-describedby='appointment-actions-note'
        className='appointment-actions'
      >
        <button
          disabled={!canConfirm}
          onClick={() => setMode('confirm')}
          type='button'
        >
          Confirmar
        </button>
        <button
          disabled={!canChange}
          onClick={() => setMode('edit')}
          type='button'
        >
          Reprogramar
        </button>
        <button
          disabled={!canChange}
          onClick={() => setMode('cancel')}
          type='button'
        >
          Cancelar cita
        </button>
      </div>
      {notice && (
        <p className='appointment-form-note' role='status'>
          {notice}
        </p>
      )}
      <p id='appointment-actions-note'>{note}</p>

      {mode && appointment && (
        <AppointmentActionDialog
          appointment={appointment}
          mode={mode}
          onClose={() => setMode(null)}
          onUpdated={(updated) => {
            setNotice(
              mode === 'cancel'
                ? 'Cita cancelada. El registro se conserva en el historial.'
                : mode === 'confirm'
                  ? 'Cita confirmada y visible en la agenda.'
                  : updated.status === 'pending' &&
                      appointment.status === 'confirmed'
                    ? 'Horario actualizado. La cita volvió a Pendiente para confirmar el nuevo horario.'
                    : 'Horario actualizado correctamente.',
            );
            onUpdated?.(updated);
          }}
        />
      )}
    </div>
  );
}
