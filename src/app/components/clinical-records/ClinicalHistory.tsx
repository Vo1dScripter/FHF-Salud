'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';

import {
  appointmentRoutes,
  appointmentStatusLabels,
} from '@/features/appointments';
import {
  type AllergyStatus,
  type ClinicalErrorCode,
  type ClinicalHistory,
  type ClinicalRevision,
  clinicalRoutes,
} from '@/features/clinical-records';
import { patientRoutes } from '@/features/patients';

const allergyLabels: Record<AllergyStatus, string> = {
  none_reported: 'Niega alergias',
  not_recorded: 'Sin información registrada',
  reported: 'Alergias reportadas',
};

const sexLabels = {
  female: 'Femenino',
  male: 'Masculino',
  other: 'Otro',
  unspecified: 'Sin especificar',
} as const;

type FormState = {
  allergies: string;
  allergiesStatus: AllergyStatus;
  background: string;
  changeReason: string;
  diagnosis: string;
  treatment: string;
};

type Feedback =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'success'; message: string }
  | {
      code: ClinicalErrorCode;
      fieldErrors?: Record<string, string>;
      kind: 'error';
      message: string;
    };

type ApiBody = {
  error?: {
    code?: string;
    fieldErrors?: Record<string, string>;
    message?: string;
  };
  history?: ClinicalHistory;
  revision?: ClinicalRevision;
};

function formFromHistory(history: ClinicalHistory): FormState {
  const latest = history.revisions[0];
  return {
    allergies: latest?.allergies ?? '',
    allergiesStatus: latest?.allergiesStatus ?? 'not_recorded',
    background: latest?.background ?? '',
    changeReason: '',
    diagnosis: latest?.diagnosis ?? '',
    treatment: latest?.treatment ?? '',
  };
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  }).format(date);
}

function formatBirthDate(value: string | null) {
  if (!value) return 'Sin información registrada';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function displayText(value: string | null) {
  return value && value.trim().length > 0
    ? value
    : 'Sin información registrada';
}

function allergyText(revision: ClinicalRevision) {
  return revision.allergiesStatus === 'reported'
    ? displayText(revision.allergies)
    : allergyLabels[revision.allergiesStatus];
}

function RevisionFields({ revision }: { revision: ClinicalRevision }) {
  return (
    <div className='appointment-detail'>
      <dl>
        <div>
          <dt>Antecedentes</dt>
          <dd>{displayText(revision.background)}</dd>
        </div>
        <div>
          <dt>Alergias</dt>
          <dd>{allergyText(revision)}</dd>
        </div>
        <div>
          <dt>Diagnóstico</dt>
          <dd>{displayText(revision.diagnosis)}</dd>
        </div>
        <div>
          <dt>Tratamiento</dt>
          <dd>{displayText(revision.treatment)}</dd>
        </div>
        {revision.changeReason && (
          <div>
            <dt>Motivo del cambio</dt>
            <dd>{revision.changeReason}</dd>
          </div>
        )}
        <div>
          <dt>Médico responsable</dt>
          <dd>
            <code className='appointment-id'>
              {revision.authorPhysicianId}
            </code>
          </dd>
        </div>
        <div>
          <dt>Fecha del servidor</dt>
          <dd>{formatDateTime(revision.createdAt)}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function ClinicalHistory({
  initialHistory,
}: {
  initialHistory: ClinicalHistory;
}) {
  const [history, setHistory] = useState(initialHistory);
  const [form, setForm] = useState<FormState>(() =>
    formFromHistory(initialHistory),
  );
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' });
  const [reloading, setReloading] = useState(false);
  const latest = history.revisions[0] ?? null;
  const expectedRevision = history.record?.currentRevision ?? 0;
  const isUpdate = expectedRevision > 0;
  const saving = feedback.kind === 'saving';

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function reloadHistory() {
    setReloading(true);
    try {
      const response = await fetch(clinicalRoutes.api(history.patient.id), {
        cache: 'no-store',
      });
      const body = (await response.json()) as ApiBody;
      if (!response.ok) {
        setFeedback({
          code: (body.error?.code ?? 'unavailable') as ClinicalErrorCode,
          fieldErrors: body.error?.fieldErrors,
          kind: 'error',
          message:
            body.error?.message ??
            'No se pudo recargar el expediente. Inténtalo de nuevo.',
        });
        return;
      }
      if (!body.history) {
        setFeedback({
          code: 'unavailable',
          kind: 'error',
          message: 'La recarga no devolvió el expediente. Inténtalo de nuevo.',
        });
        return;
      }
      setHistory(body.history);
      setForm(formFromHistory(body.history));
      setFeedback({ kind: 'idle' });
    } catch {
      setFeedback({
        code: 'unavailable',
        kind: 'error',
        message: 'No se pudo recargar el expediente. Inténtalo de nuevo.',
      });
    } finally {
      setReloading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !history.canRegister) return;
    setFeedback({ kind: 'saving' });
    try {
      const response = await fetch(clinicalRoutes.api(history.patient.id), {
        body: JSON.stringify({
          allergies:
            form.allergiesStatus === 'reported' ? form.allergies : null,
          allergiesStatus: form.allergiesStatus,
          background: form.background,
          changeReason: form.changeReason,
          diagnosis: form.diagnosis,
          expectedRevision,
          treatment: form.treatment,
        }),
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const body = (await response.json()) as ApiBody;
      if (!response.ok) {
        setFeedback({
          code: (body.error?.code ?? 'unavailable') as ClinicalErrorCode,
          fieldErrors: body.error?.fieldErrors,
          kind: 'error',
          message:
            body.error?.message ??
            'No se pudo guardar la información clínica. Inténtalo de nuevo.',
        });
        return;
      }
      if (!body.history) {
        setFeedback({
          code: 'unavailable',
          kind: 'error',
          message:
            'La respuesta no devolvió el expediente actualizado. Recarga la página.',
        });
        return;
      }
      setHistory(body.history);
      setForm(formFromHistory(body.history));
      setFeedback({
        kind: 'success',
        message:
          body.revision?.revisionNumber === 1
            ? 'La primera nota clínica se registró correctamente.'
            : 'La nueva revisión clínica se guardó correctamente.',
      });
    } catch {
      setFeedback({
        code: 'unavailable',
        kind: 'error',
        message: 'No se pudo guardar la información clínica. Inténtalo de nuevo.',
      });
    }
  }

  return (
    <>
      <section
        aria-labelledby='clinical-patient-title'
        className='appointment-form-panel'
      >
        <h2 id='clinical-patient-title'>{history.patient.displayName}</h2>
        <p className='appointment-form-note'>
          Expediente clínico consultado con la sesión médica verificada en el
          servidor. La información mostrada procede de la persistencia; no se
          usan datos de ejemplo.
        </p>
        <div className='appointment-detail'>
          <dl>
            <div>
              <dt>Estado del paciente</dt>
              <dd>{history.patient.active ? 'Activo' : 'Inactivo'}</dd>
            </div>
            <div>
              <dt>Fecha de nacimiento</dt>
              <dd>{formatBirthDate(history.patient.birthDate)}</dd>
            </div>
            <div>
              <dt>Sexo</dt>
              <dd>
                {history.patient.sex
                  ? sexLabels[history.patient.sex]
                  : 'Sin información registrada'}
              </dd>
            </div>
            <div>
              <dt>Expediente</dt>
              <dd>
                {history.record
                  ? `Revisión vigente ${history.record.currentRevision} · Última modificación ${formatDateTime(history.record.updatedAt)}`
                  : 'Sin expediente abierto para tu cuenta'}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section
        aria-labelledby='clinical-current-title'
        className='appointment-form-panel'
      >
        <h2 id='clinical-current-title'>Información clínica vigente</h2>
        {latest ? (
          <>
            <p className='appointment-form-note'>
              Revisión {latest.revisionNumber} de {history.revisions.length}.
              Las revisiones anteriores se conservan sin sobrescritura.
            </p>
            <RevisionFields revision={latest} />
          </>
        ) : (
          <div className='appointments-state'>
            <h3>Sin información clínica registrada</h3>
            <p>
              {history.record
                ? 'El expediente está abierto, pero aún no tiene notas clínicas. Registra la primera revisión cuando corresponda.'
                : 'No hay una revisión clínica visible para tu cuenta. Un expediente vacío no se sustituye con datos ficticios.'}
            </p>
          </div>
        )}
      </section>

      <section
        aria-labelledby='clinical-appointments-title'
        className='appointment-form-panel'
      >
        <h2 id='clinical-appointments-title'>Citas relacionadas</h2>
        <p className='appointment-form-note'>
          Solo se muestran las citas de este paciente con tu cuenta médica. La
          agenda conserva sus propias reglas de acceso.
        </p>
        {history.appointments.length === 0 ? (
          <p>No hay citas visibles para este paciente y tu cuenta.</p>
        ) : (
          <div className='appointments-table-wrap'>
            <table className='appointments-table'>
              <caption className='sr-only'>
                Citas relacionadas con el paciente
              </caption>
              <thead>
                <tr>
                  <th scope='col'>Fecha</th>
                  <th scope='col'>Estado</th>
                  <th scope='col'>Motivo</th>
                  <th scope='col'>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {history.appointments.map((appointment) => (
                  <tr key={appointment.id}>
                    <td>
                      <div className='appointment-date'>
                        {formatDateTime(appointment.scheduledAt)}
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
                      <p className='appointment-reason'>{appointment.reason}</p>
                    </td>
                    <td>
                      <Link href={appointmentRoutes.detail(appointment.id)}>
                        Ver cita
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        aria-labelledby='clinical-history-title'
        className='appointment-form-panel'
      >
        <h2 id='clinical-history-title'>Historial de revisiones</h2>
        {history.revisions.length === 0 ? (
          <p>Sin revisiones registradas.</p>
        ) : (
          <ol>
            {history.revisions.map((revision) => (
              <li key={revision.id}>
                <details>
                  <summary>
                    Revisión {revision.revisionNumber} ·{' '}
                    {formatDateTime(revision.createdAt)}
                  </summary>
                  <RevisionFields revision={revision} />
                </details>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section
        aria-labelledby='clinical-form-title'
        className='appointment-form-panel'
      >
        <h2 id='clinical-form-title'>
          {isUpdate ? 'Registrar nueva revisión' : 'Registrar primera nota'}
        </h2>
        <p className='appointment-form-note'>
          La fecha, el autor y el médico responsable se asignan en el servidor.
          Cada guardado conserva la revisión anterior; no se elimina historial
          para simular una modificación.
        </p>
        {history.canRegister ? (
          <form
            aria-busy={saving}
            className='appointment-form'
            onSubmit={handleSubmit}
          >
            <div className='appointment-field appointment-field--wide'>
              <label htmlFor='clinical-background'>Antecedentes</label>
              <textarea
                id='clinical-background'
                maxLength={4000}
                onChange={(event) =>
                  updateForm('background', event.target.value)
                }
                rows={4}
                value={form.background}
              />
              {feedback.kind === 'error' &&
                feedback.fieldErrors?.background && (
                  <p role='alert'>{feedback.fieldErrors.background}</p>
                )}
            </div>
            <div className='appointment-field'>
              <label htmlFor='clinical-allergies-status'>Alergias</label>
              <select
                id='clinical-allergies-status'
                onChange={(event) => {
                  const next = event.target.value as AllergyStatus;
                  setForm((current) => ({
                    ...current,
                    allergies:
                      next === 'reported' ? current.allergies : '',
                    allergiesStatus: next,
                  }));
                }}
                value={form.allergiesStatus}
              >
                <option value='not_recorded'>
                  Sin información registrada
                </option>
                <option value='none_reported'>Niega alergias</option>
                <option value='reported'>Alergias reportadas</option>
              </select>
            </div>
            {form.allergiesStatus === 'reported' && (
              <div className='appointment-field appointment-field--wide'>
                <label htmlFor='clinical-allergies'>
                  Alergias reportadas
                </label>
                <textarea
                  id='clinical-allergies'
                  maxLength={4000}
                  onChange={(event) =>
                    updateForm('allergies', event.target.value)
                  }
                  required
                  rows={3}
                  value={form.allergies}
                />
                {feedback.kind === 'error' &&
                  feedback.fieldErrors?.allergies && (
                    <p role='alert'>{feedback.fieldErrors.allergies}</p>
                  )}
              </div>
            )}
            <div className='appointment-field appointment-field--wide'>
              <label htmlFor='clinical-diagnosis'>Diagnóstico</label>
              <textarea
                id='clinical-diagnosis'
                maxLength={4000}
                onChange={(event) =>
                  updateForm('diagnosis', event.target.value)
                }
                rows={3}
                value={form.diagnosis}
              />
            </div>
            <div className='appointment-field appointment-field--wide'>
              <label htmlFor='clinical-treatment'>Tratamiento</label>
              <textarea
                id='clinical-treatment'
                maxLength={4000}
                onChange={(event) =>
                  updateForm('treatment', event.target.value)
                }
                rows={3}
                value={form.treatment}
              />
            </div>
            {isUpdate && (
              <div className='appointment-field appointment-field--wide'>
                <label htmlFor='clinical-change-reason'>
                  Motivo de la nueva revisión
                </label>
                <textarea
                  id='clinical-change-reason'
                  maxLength={500}
                  onChange={(event) =>
                    updateForm('changeReason', event.target.value)
                  }
                  required
                  rows={2}
                  value={form.changeReason}
                />
                {feedback.kind === 'error' &&
                  feedback.fieldErrors?.changeReason && (
                    <p role='alert'>{feedback.fieldErrors.changeReason}</p>
                  )}
              </div>
            )}
            <div className='appointment-form-actions'>
              <button
                className='appointment-new'
                disabled={saving}
                type='submit'
              >
                {saving
                  ? 'Guardando…'
                  : isUpdate
                    ? 'Guardar nueva revisión'
                    : 'Registrar primera nota'}
              </button>
            </div>
          </form>
        ) : (
          <div className='appointments-state'>
            <h3>Sin autorización para registrar</h3>
            <p>
              No hay una cita vigente con este paciente que permita abrir el
              expediente. Puedes consultar lo que ya esté autorizado, pero no
              crear una revisión nueva.
            </p>
            <Link className='appointment-new' href={appointmentRoutes.list}>
              Ir a Citas médicas
            </Link>
          </div>
        )}
        {feedback.kind === 'success' && (
          <p role='status'>{feedback.message}</p>
        )}
        {feedback.kind === 'error' && (
          <div className='appointments-state' role='alert'>
            <h3>No se pudo completar la operación</h3>
            <p>{feedback.message}</p>
            {feedback.code === 'stale' && (
              <button
                className='appointment-new'
                disabled={reloading}
                onClick={reloadHistory}
                type='button'
              >
                {reloading ? 'Recargando…' : 'Recargar expediente'}
              </button>
            )}
          </div>
        )}
      </section>

      <div className='appointment-form-actions'>
        <Link className='appointment-new' href={patientRoutes.list}>
          Volver a pacientes
        </Link>
        <Link className='appointment-new' href={appointmentRoutes.list}>
          Ir a Citas médicas
        </Link>
      </div>
    </>
  );
}
