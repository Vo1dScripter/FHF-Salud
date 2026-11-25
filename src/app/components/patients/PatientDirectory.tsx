'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useRef, useState } from 'react';

import {
  patientIdSchema,
  type PatientPage,
  patientRoutes,
} from '@/features/patients';

// Cada consulta limpia los datos previos; abortar impide mostrar respuestas obsoletas.
type State =
  | { kind: 'loading' }
  | { kind: 'ready'; data: PatientPage }
  | { kind: 'error'; code: string; message: string };

function isPatientPage(value: unknown): value is PatientPage {
  if (typeof value !== 'object' || value === null) return false;
  const page = value as { hasMore?: unknown; patients?: unknown };
  return (
    typeof page.hasMore === 'boolean' &&
    Array.isArray(page.patients) &&
    page.patients.every(
      (patient) =>
        typeof patient === 'object' &&
        patient !== null &&
        typeof (patient as { active?: unknown }).active === 'boolean' &&
        typeof (patient as { createdAt?: unknown }).createdAt === 'string' &&
        typeof (patient as { displayName?: unknown }).displayName ===
          'string' &&
        typeof (patient as { id?: unknown }).id === 'string',
    )
  );
}
export default function PatientDirectory() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [registrationError, setRegistrationError] = useState('');
  const [saving, setSaving] = useState(false);
  const registrationPending = useRef(false);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (registrationPending.current || !name.trim()) return;
    registrationPending.current = true;
    setSaving(true);
    setRegistrationError('');
    try {
      const response = await fetch('/api/pacientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name.trim() }),
      });
      const body = await response.json();
      if (
        !response.ok ||
        response.status !== 201 ||
        !patientIdSchema.safeParse(body.patientId).success
      ) {
        throw new Error(
          body.error?.message ?? 'No se pudo confirmar el alta del paciente.',
        );
      }
      router.push(patientRoutes.record(body.patientId));
    } catch (error) {
      setRegistrationError(
        error instanceof Error
          ? error.message
          : 'No se pudo confirmar el alta del paciente.',
      );
    } finally {
      registrationPending.current = false;
      setSaving(false);
    }
  }

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState({ search: '', page: 1 });
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ kind: 'loading' });
  function changeQuery(next: typeof query) {
    setState({ kind: 'loading' });
    setQuery(next);
  }
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setState({ kind: 'loading' });
      try {
        const params = new URLSearchParams({
          search: query.search,
          page: String(query.page),
        });
        const response = await fetch(`/api/pacientes?${params}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const body = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setState({
            kind: 'error',
            code: body.error?.code ?? 'unavailable',
            message: body.error?.message ?? 'No se pudo consultar pacientes.',
          });
        } else if (!isPatientPage(body)) {
          setState({
            kind: 'error',
            code: 'unavailable',
            message:
              'La respuesta de pacientes no es válida. Inténtalo de nuevo.',
          });
        } else {
          setState({ kind: 'ready', data: body });
        }
      } catch {
        if (!controller.signal.aborted)
          setState({
            kind: 'error',
            code: 'unavailable',
            message: 'No se pudo consultar pacientes. Inténtalo de nuevo.',
          });
      }
    }
    void load();
    return () => controller.abort();
  }, [query, attempt]);
  return (
    <section
      aria-label='Directorio de pacientes'
      className='appointment-form-panel'
    >
      <h2>Buscar pacientes</h2>
      <p className='appointment-form-note'>
        Busca por nombre entre los pacientes disponibles para tu cuenta. Abre el
        expediente para consultar antecedentes, alergias, diagnósticos y
        tratamientos autorizados.
      </p>
      <form
        className='appointment-form'
        onSubmit={(event) => {
          event.preventDefault();
          changeQuery({ search: search.trim(), page: 1 });
        }}
      >
        <div className='appointment-field appointment-field--wide'>
          <label htmlFor='patient-search'>Nombre del paciente</label>
          <input
            id='patient-search'
            value={search}
            maxLength={100}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className='appointment-form-actions'>
          <button className='appointment-new' type='submit'>
            Buscar
          </button>
          <button
            className='appointment-new'
            type='button'
            onClick={() => {
              setSearch('');
              changeQuery({ search: '', page: 1 });
            }}
          >
            Limpiar búsqueda
          </button>
        </div>
      </form>
      {state.kind === 'loading' && (
        <p role='status' aria-live='polite'>
          Cargando pacientes…
        </p>
      )}
      {state.kind === 'error' && (
        <div role='alert' className='appointments-state'>
          <h2>
            {state.code === 'forbidden'
              ? 'Acceso denegado'
              : state.code === 'unauthenticated'
                ? 'Sesión requerida'
                : 'Consulta no disponible'}
          </h2>
          <p>{state.message}</p>
          {state.code === 'unauthenticated' ? (
            <Link className='appointment-new' href='/citas/acceso'>
              Iniciar sesión
            </Link>
          ) : null}
          {state.code !== 'forbidden' && (
            <button
              className='appointment-new'
              type='button'
              onClick={() => {
                setState({ kind: 'loading' });
                setAttempt((value) => value + 1);
              }}
            >
              Reintentar
            </button>
          )}
        </div>
      )}
      {state.kind === 'ready' && (
        <>
          <form
            className='appointment-form'
            onSubmit={register}
            aria-busy={saving}
          >
            <div className='appointment-field appointment-field--wide'>
              <label htmlFor='patient-register-name'>
                Nombre completo para el alta
              </label>
              <input
                id='patient-register-name'
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={200}
                disabled={saving}
              />
            </div>
            <button
              className='appointment-new'
              type='submit'
              disabled={saving || !name.trim()}
            >
              {saving ? 'Registrando…' : 'Registrar paciente y expediente'}
            </button>
            {registrationError && <p role='alert'>{registrationError}</p>}
          </form>
          <p role='status'>
            Página {query.page} · {state.data.patients.length} pacientes
          </p>
          {state.data.patients.length === 0 ? (
            <div className='appointments-state'>
              <h2>Sin pacientes visibles</h2>
              <p>
                No hay coincidencias autorizadas para esta búsqueda. Un
                resultado vacío no confirma la inexistencia de un paciente.
              </p>
            </div>
          ) : (
            <div className='appointments-table-wrap'>
              <table className='appointments-table'>
                <caption className='sr-only'>Pacientes autorizados</caption>
                <thead>
                  <tr>
                    <th scope='col'>Paciente</th>
                    <th scope='col'>Estado</th>
                    <th scope='col'>Expediente</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.patients.map((patient) => (
                    <tr key={patient.id}>
                      <td>
                        <div className='appointment-patient'>
                          {patient.displayName}
                        </div>
                        <p className='appointment-reason'>ID: {patient.id}</p>
                      </td>
                      <td>{patient.active ? 'Activo' : 'Inactivo'}</td>
                      <td>
                        <Link
                          aria-label={`Ver expediente de ${patient.displayName}`}
                          href={patientRoutes.record(patient.id)}
                        >
                          Ver expediente
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav
            aria-label='Paginación de pacientes'
            className='appointment-form-actions'
          >
            <button
              className='appointment-new'
              disabled={query.page === 1}
              onClick={() => changeQuery({ ...query, page: query.page - 1 })}
            >
              Anterior
            </button>
            <button
              className='appointment-new'
              disabled={!state.data.hasMore}
              onClick={() => changeQuery({ ...query, page: query.page + 1 })}
            >
              Siguiente
            </button>
          </nav>
        </>
      )}
      <Link className='appointment-new' href='/citas'>
        Ir a Citas médicas
      </Link>
    </section>
  );
}
