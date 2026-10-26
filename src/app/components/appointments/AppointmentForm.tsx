'use client';

import Link from 'next/link';

import { appointmentRoutes } from '@/features/appointments';

import AppointmentIcon from './AppointmentIcon';
import type { AppointmentFormState } from './types';

export default function AppointmentForm({
  state = 'preparation',
}: {
  state?: AppointmentFormState;
}) {
  const isPreviewState = state !== 'preparation';
  return (
    <>
      {isPreviewState && (
        <p className='appointment-preview-notice' role='status'>
          Variante futura ·{' '}
          {state === 'validation'
            ? 'Revisa los campos'
            : state === 'submitting'
              ? 'Enviando solicitud'
              : 'Cita registrada'}{' '}
          · solo propuesta
        </p>
      )}
      <section className='appointment-form-panel'>
        <h2>Nueva cita médica</h2>
        <form
          aria-busy={state === 'submitting'}
          className='appointment-form'
          onSubmit={(event) => event.preventDefault()}
        >
          <div className='appointment-field appointment-field--wide'>
            <label htmlFor='appointment-patient'>Paciente</label>
            <input
              id='appointment-patient'
              placeholder='Buscar por nombre o ID'
              readOnly
              type='text'
            />
          </div>
          <div className='appointment-field'>
            <label htmlFor='appointment-physician'>Médico / Profesional</label>
            <select disabled id='appointment-physician'>
              <option>Seleccionar profesional...</option>
            </select>
          </div>
          <div className='appointment-field'>
            <label htmlFor='appointment-start'>Inicio (Fecha y Hora)</label>
            <input disabled id='appointment-start' type='datetime-local' />
            <p className='appointment-field-hint'>
              Zona prevista: America/Mexico_City (UTC−06:00).
            </p>
          </div>
          <div className='appointment-field'>
            <label htmlFor='appointment-duration'>Duración estimada</label>
            <select disabled id='appointment-duration'>
              {[15, 30, 45, 60].map((minutes) => (
                <option key={minutes}>{minutes} minutos</option>
              ))}
            </select>
          </div>
          <div className='appointment-field appointment-field--wide'>
            <label htmlFor='appointment-reason'>Motivo de la consulta</label>
            <textarea
              aria-describedby={
                state === 'validation'
                  ? 'appointment-reason-error'
                  : 'appointment-form-note'
              }
              aria-invalid={state === 'validation' || undefined}
              disabled
              id='appointment-reason'
              placeholder='Describa el motivo...'
              rows={3}
            />
            {state === 'validation' && (
              <p id='appointment-reason-error'>
                El motivo de consulta es obligatorio.
              </p>
            )}
            {state === 'submitting' && (
              <p role='status'>Esperando confirmación del servidor…</p>
            )}
            {state === 'success' && (
              <p role='status'>
                La confirmación solo se muestra después de una respuesta real
                del servicio.
              </p>
            )}
          </div>
          <div className='appointment-form-actions appointment-field--wide'>
            <Link href={appointmentRoutes.list}>Cancelar</Link>
            <button disabled type='submit'>
              Guardar cita
            </button>
          </div>
        </form>
        <p className='appointment-form-note' id='appointment-form-note'>
          <AppointmentIcon name='warning' />
          <span>
            Servicio pendiente: no se enviará información. Las variantes de
            validación, envío y éxito son solo vistas de propuesta.
          </span>
        </p>
      </section>
    </>
  );
}
