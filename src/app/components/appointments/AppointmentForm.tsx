'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { readAppointmentClientError } from '@/lib/appointments/client';

import {
  type Appointment,
  APPOINTMENT_DURATIONS,
  APPOINTMENT_TIME_ZONE,
  type AppointmentDirectory,
  type AppointmentDurationMinutes,
  appointmentRoutes,
  localDateTimeToIso,
} from '@/features/appointments';

import AppointmentIcon from './AppointmentIcon';
import AppointmentState from './AppointmentState';
import type { AppointmentFormState } from './types';

type FormField =
  | 'durationMinutes'
  | 'patientId'
  | 'physicianId'
  | 'reason'
  | 'scheduledAt';

type FormValues = {
  durationMinutes: string;
  patientId: string;
  physicianId: string;
  reason: string;
  scheduledAt: string;
};

const initialValues: FormValues = {
  durationMinutes: '30',
  patientId: '',
  physicianId: '',
  reason: '',
  scheduledAt: '',
};

export default function AppointmentForm({
  state,
}: {
  /** Solo se usa en /citas/vista-previa para QA visual. */
  state?: AppointmentFormState;
}) {
  if (state) return <AppointmentFormPreview state={state} />;
  return <AppointmentCreateForm />;
}

function AppointmentFormPreview({ state }: { state: AppointmentFormState }) {
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
              {APPOINTMENT_DURATIONS.map((minutes) => (
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
            Variante de propuesta sin envío. La agenda productiva valida y
            persiste en el servidor.
          </span>
        </p>
      </section>
    </>
  );
}

function AppointmentCreateForm() {
  const [directory, setDirectory] = useState<AppointmentDirectory | null>(null);
  const [accessState, setAccessState] = useState<
    'loading' | 'ready' | 'unauthenticated' | 'forbidden' | 'error'
  >('loading');
  const [accessError, setAccessError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState<FormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FormField, string>>
  >({});
  const [submitState, setSubmitState] = useState<'idle' | 'submitting'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<Appointment | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAccessState('loading');
    setAccessError(null);
    fetch('/api/citas/referencias', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 401) {
          setAccessState('unauthenticated');
          return;
        }
        if (response.status === 403) {
          setAccessState('forbidden');
          return;
        }
        if (!response.ok) {
          const error = await readAppointmentClientError(response);
          if (cancelled) return;
          setAccessError(error.message);
          setAccessState('error');
          return;
        }
        const data = (await response.json()) as AppointmentDirectory;
        if (cancelled) return;
        setDirectory(data);
        setAccessState('ready');
      })
      .catch(() => {
        if (!cancelled) setAccessState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function updateField<Field extends keyof FormValues>(
    field: Field,
    value: FormValues[Field],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  }

  function validate(): boolean {
    const errors: Partial<Record<FormField, string>> = {};
    if (!form.patientId) errors.patientId = 'Selecciona un paciente.';
    if (!form.physicianId) errors.physicianId = 'Selecciona un médico.';
    if (!form.scheduledAt) {
      errors.scheduledAt = 'Indica la fecha y hora de inicio.';
    } else {
      try {
        localDateTimeToIso(form.scheduledAt);
      } catch {
        errors.scheduledAt = 'La fecha y hora no son válidas.';
      }
    }
    if (!form.reason.trim()) {
      errors.reason = 'El motivo de consulta es obligatorio.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setCreated(null);
    if (!validate()) return;

    setSubmitState('submitting');
    try {
      const response = await fetch('/api/citas', {
        body: JSON.stringify({
          durationMinutes: Number(
            form.durationMinutes,
          ) as AppointmentDurationMinutes,
          patientId: form.patientId,
          physicianId: form.physicianId,
          reason: form.reason.trim(),
          scheduledAt: localDateTimeToIso(form.scheduledAt),
        }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      if (!response.ok) {
        const error = await readAppointmentClientError(response);
        if (response.status === 401) {
          setAccessState('unauthenticated');
          return;
        }
        if (response.status === 403) {
          setAccessState('forbidden');
          return;
        }
        if (error.fieldErrors) {
          setFieldErrors((current) => ({
            ...current,
            ...(error.fieldErrors as Partial<Record<FormField, string>>),
          }));
        }
        if (error.code === 'conflict') {
          setFieldErrors((current) => ({
            ...current,
            scheduledAt: error.message,
          }));
        }
        setSubmitError(error.message);
        return;
      }

      let data: { appointment: Appointment };
      try {
        data = (await response.json()) as { appointment: Appointment };
      } catch {
        setSubmitError(
          'La cita pudo haberse registrado, pero no se pudo leer la confirmación. Consulta la agenda antes de reintentar.',
        );
        return;
      }
      setCreated(data.appointment);
      setForm(initialValues);
      setFieldErrors({});
    } catch {
      setSubmitError(
        'No se pudo conectar con el servicio de citas. Revisa tu conexión e inténtalo de nuevo.',
      );
    } finally {
      setSubmitState('idle');
    }
  }

  if (accessState === 'loading') {
    return <AppointmentState kind='loading' />;
  }
  if (accessState === 'unauthenticated') {
    return (
      <AppointmentState
        actionHref={appointmentRoutes.access}
        kind='unauthenticated'
      />
    );
  }
  if (accessState === 'forbidden') {
    return <AppointmentState kind='forbidden' />;
  }
  if (accessState === 'error') {
    return (
      <AppointmentState
        description={accessError ?? undefined}
        kind='error'
        onRetry={() => setReloadKey((current) => current + 1)}
      />
    );
  }
  if (directory && !directory.canCreate) {
    return <AppointmentState kind='forbidden' />;
  }

  const hasReferences =
    Boolean(directory?.patients.length) && Boolean(directory?.physicians.length);

  return (
    <section className='appointment-form-panel'>
      <h2>Nueva cita médica</h2>
      {created && (
        <p className='appointment-form-note' role='status'>
          <AppointmentIcon name='info' />
          <span>
            Cita registrada correctamente.{' '}
            <Link href={appointmentRoutes.detail(created.id)}>
              Ver detalle
            </Link>
          </span>
        </p>
      )}
      {!hasReferences && (
        <p className='appointment-form-note' role='status'>
          <AppointmentIcon name='warning' />
          <span>
            No hay pacientes o médicos activos disponibles. Un administrador
            debe aprovisionarlos antes de registrar citas.
          </span>
        </p>
      )}
      <form
        aria-busy={submitState === 'submitting'}
        className='appointment-form'
        noValidate
        onSubmit={handleSubmit}
      >
        <div className='appointment-field appointment-field--wide'>
          <label htmlFor='appointment-patient'>Paciente</label>
          <select
            aria-describedby={
              fieldErrors.patientId ? 'appointment-patient-error' : undefined
            }
            aria-invalid={Boolean(fieldErrors.patientId) || undefined}
            id='appointment-patient'
            onChange={(event) => updateField('patientId', event.target.value)}
            required
            value={form.patientId}
          >
            <option value=''>Seleccionar paciente...</option>
            {directory?.patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.displayName}
              </option>
            ))}
          </select>
          {fieldErrors.patientId && (
            <p id='appointment-patient-error' role='alert'>
              {fieldErrors.patientId}
            </p>
          )}
        </div>
        <div className='appointment-field'>
          <label htmlFor='appointment-physician'>Médico / Profesional</label>
          <select
            aria-describedby={
              fieldErrors.physicianId
                ? 'appointment-physician-error'
                : undefined
            }
            aria-invalid={Boolean(fieldErrors.physicianId) || undefined}
            id='appointment-physician'
            onChange={(event) => updateField('physicianId', event.target.value)}
            required
            value={form.physicianId}
          >
            <option value=''>Seleccionar profesional...</option>
            {directory?.physicians.map((physician) => (
              <option key={physician.id} value={physician.id}>
                {physician.displayName}
              </option>
            ))}
          </select>
          {fieldErrors.physicianId && (
            <p id='appointment-physician-error' role='alert'>
              {fieldErrors.physicianId}
            </p>
          )}
        </div>
        <div className='appointment-field'>
          <label htmlFor='appointment-start'>Inicio (Fecha y Hora)</label>
          <input
            aria-describedby={
              fieldErrors.scheduledAt
                ? 'appointment-start-error'
                : 'appointment-start-hint'
            }
            aria-invalid={Boolean(fieldErrors.scheduledAt) || undefined}
            id='appointment-start'
            onChange={(event) =>
              updateField('scheduledAt', event.target.value)
            }
            required
            type='datetime-local'
            value={form.scheduledAt}
          />
          <p id='appointment-start-hint'>
            Zona de la agenda: {APPOINTMENT_TIME_ZONE}. El servidor valida que
            la fecha no esté en el pasado.
          </p>
          {fieldErrors.scheduledAt && (
            <p id='appointment-start-error' role='alert'>
              {fieldErrors.scheduledAt}
            </p>
          )}
        </div>
        <div className='appointment-field'>
          <label htmlFor='appointment-duration'>Duración estimada</label>
          <select
            id='appointment-duration'
            onChange={(event) =>
              updateField('durationMinutes', event.target.value)
            }
            value={form.durationMinutes}
          >
            {APPOINTMENT_DURATIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutos
              </option>
            ))}
          </select>
        </div>
        <div className='appointment-field appointment-field--wide'>
          <label htmlFor='appointment-reason'>Motivo de la consulta</label>
          <textarea
            aria-describedby={
              fieldErrors.reason
                ? 'appointment-reason-error'
                : 'appointment-form-note'
            }
            aria-invalid={Boolean(fieldErrors.reason) || undefined}
            id='appointment-reason'
            onChange={(event) => updateField('reason', event.target.value)}
            placeholder='Describa el motivo...'
            required
            rows={3}
            value={form.reason}
          />
          {fieldErrors.reason && (
            <p id='appointment-reason-error' role='alert'>
              {fieldErrors.reason}
            </p>
          )}
        </div>
        {submitError && (
          <p
            className='appointment-form-note appointment-field--wide'
            role='alert'
          >
            <AppointmentIcon name='warning' />
            <span>{submitError}</span>
          </p>
        )}
        <div className='appointment-form-actions appointment-field--wide'>
          <Link href={appointmentRoutes.list}>Cancelar</Link>
          <button disabled={submitState === 'submitting'} type='submit'>
            {submitState === 'submitting' ? 'Guardando cita…' : 'Guardar cita'}
          </button>
        </div>
      </form>
      <p className='appointment-form-note' id='appointment-form-note'>
        <AppointmentIcon name='info' />
        <span>
          La validación, la existencia de referencias y la disponibilidad se
          comprueban en el servidor. La base de datos impide solapamientos
          concurrentes del mismo médico.
        </span>
      </p>
    </section>
  );
}
