'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { readAppointmentClientError } from '@/lib/appointments/client';

import {
  type AppointmentDirectory,
  type AppointmentStatus,
  appointmentStatusLabels,
  type AppointmentView,
  dayRangeInTimeZone,
} from '@/features/appointments';

import AppointmentIcon from './AppointmentIcon';
import AppointmentList from './AppointmentList';
import type { AppointmentListState } from './types';

type Filters = {
  date: string;
  physicianId: string;
  status: '' | AppointmentStatus;
};

type AppliedFilters = Filters & {
  from?: string;
  to?: string;
};

type AgendaResult =
  | {
      appointments: AppointmentView[];
      directory: AppointmentDirectory;
      kind: 'ready';
    }
  | { kind: 'error'; message?: string }
  | { kind: 'forbidden' }
  | { kind: 'unauthenticated' };

const emptyFilters: Filters = {
  date: '',
  physicianId: '',
  status: '',
};

const emptyAppliedFilters: AppliedFilters = { ...emptyFilters };

/**
 * El rango se calcula al aplicar el filtro, no dentro del efecto: así la carga
 * inicial solo sincroniza con la API y no provoca renders en cascada.
 */
function toAppliedFilters(filters: Filters): AppliedFilters | null {
  if (!filters.date) return { ...filters };
  try {
    return { ...filters, ...dayRangeInTimeZone(filters.date) };
  } catch {
    return null;
  }
}

/** Consulta sin estado: el efecto decide cuándo reflejar el resultado. */
async function fetchAgenda(filters: AppliedFilters): Promise<AgendaResult> {
  const params = new URLSearchParams();
  if (filters.physicianId) params.set('physicianId', filters.physicianId);
  if (filters.status) params.set('status', filters.status);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);

  try {
    const [referencesResponse, appointmentsResponse] = await Promise.all([
      fetch('/api/citas/referencias', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      }),
      fetch(`/api/citas?${params.toString()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      }),
    ]);

    if (
      referencesResponse.status === 401 ||
      appointmentsResponse.status === 401
    ) {
      return { kind: 'unauthenticated' };
    }
    if (
      referencesResponse.status === 403 ||
      appointmentsResponse.status === 403
    ) {
      return { kind: 'forbidden' };
    }
    if (!referencesResponse.ok || !appointmentsResponse.ok) {
      const error = await readAppointmentClientError(
        referencesResponse.ok ? appointmentsResponse : referencesResponse,
      );
      return { kind: 'error', message: error.message };
    }

    const [directory, body] = (await Promise.all([
      referencesResponse.json(),
      appointmentsResponse.json(),
    ])) as [AppointmentDirectory, { appointments?: AppointmentView[] }];
    return {
      appointments: body.appointments ?? [],
      directory,
      kind: 'ready',
    };
  } catch {
    return { kind: 'error' };
  }
}

function matchesFilters(
  filters: AppliedFilters,
  appointment: AppointmentView,
): boolean {
  if (filters.status && appointment.status !== filters.status) return false;
  if (filters.physicianId && appointment.physicianId !== filters.physicianId) {
    return false;
  }
  const startsAt = new Date(appointment.scheduledAt).getTime();
  if (filters.from && startsAt < new Date(filters.from).getTime()) return false;
  if (filters.to && startsAt >= new Date(filters.to).getTime()) return false;
  return true;
}

export default function AppointmentAgenda() {
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<AppliedFilters>(emptyAppliedFilters);
  const [directory, setDirectory] = useState<AppointmentDirectory | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [state, setState] = useState<AppointmentListState>({
    kind: 'loading',
  });
  const requestId = useRef(0);

  const applyResult = useCallback((result: AgendaResult) => {
    if (result.kind !== 'ready') {
      setState(
        result.kind === 'error'
          ? { kind: 'error', message: result.message }
          : { kind: result.kind },
      );
      return;
    }
    setDirectory(result.directory);
    setState(
      result.appointments.length
        ? { appointments: result.appointments, kind: 'populated' }
        : { kind: 'empty' },
    );
  }, []);

  useEffect(() => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    void fetchAgenda(appliedFilters).then((result) => {
      if (requestId.current === currentRequest) applyResult(result);
    });
  }, [appliedFilters, applyResult]);

  const handleAppointmentUpdated = useCallback(
    (updated: AppointmentView) => {
      const stillMatches = matchesFilters(appliedFilters, updated);
      setState((current) => {
        if (current.kind !== 'populated') return current;
        const appointments = stillMatches
          ? current.appointments.map((appointment) =>
              appointment.id === updated.id ? updated : appointment,
            )
          : current.appointments.filter(
              (appointment) => appointment.id !== updated.id,
            );
        return appointments.length
          ? { appointments, kind: 'populated' }
          : { kind: 'empty' };
      });
      setNotice(
        stillMatches
          ? 'Cambio guardado y reflejado en la agenda.'
          : 'Cambio guardado. La cita ya no coincide con los filtros actuales.',
      );
    },
    [appliedFilters],
  );

  function applyFilters(next: Filters) {
    const applied = toAppliedFilters(next);
    if (!applied) {
      setState({ kind: 'error' });
      return;
    }
    setNotice(null);
    setState({ kind: 'loading' });
    setDraftFilters(next);
    setAppliedFilters(applied);
  }

  function clearFilters() {
    applyFilters(emptyFilters);
  }

  function retry() {
    setNotice(null);
    setState({ kind: 'loading' });
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    void fetchAgenda(appliedFilters).then((result) => {
      if (requestId.current === currentRequest) applyResult(result);
    });
  }

  return (
    <>
      <form
        aria-label='Filtros de agenda'
        className='appointment-form'
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters(draftFilters);
        }}
      >
        <div className='appointment-field'>
          <label htmlFor='agenda-date'>Fecha</label>
          <input
            id='agenda-date'
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                date: event.target.value,
              }))
            }
            type='date'
            value={draftFilters.date}
          />
        </div>
        <div className='appointment-field'>
          <label htmlFor='agenda-physician'>Médico</label>
          <select
            id='agenda-physician'
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                physicianId: event.target.value,
              }))
            }
            value={draftFilters.physicianId}
          >
            <option value=''>Todos los médicos</option>
            {directory?.physicians.map((physician) => (
              <option key={physician.id} value={physician.id}>
                {physician.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className='appointment-field'>
          <label htmlFor='agenda-status'>Estado</label>
          <select
            id='agenda-status'
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                status: event.target.value as Filters['status'],
              }))
            }
            value={draftFilters.status}
          >
            <option value=''>Todos los estados</option>
            {(Object.keys(appointmentStatusLabels) as AppointmentStatus[]).map(
              (status) => (
                <option key={status} value={status}>
                  {appointmentStatusLabels[status]}
                </option>
              ),
            )}
          </select>
        </div>
        <div className='appointment-form-actions appointment-field--wide'>
          <button onClick={clearFilters} type='button'>
            Limpiar
          </button>
          <button type='submit'>Aplicar filtros</button>
        </div>
      </form>
      {notice && (
        <p className='appointment-form-note' role='status'>
          <AppointmentIcon name='info' />
          <span>{notice}</span>
        </p>
      )}
      <AppointmentList
        canCreate={directory?.canCreate ?? false}
        canManage={directory?.canManage ?? false}
        onAppointmentUpdated={handleAppointmentUpdated}
        onClearFilters={clearFilters}
        onRetry={retry}
        state={state}
      />
    </>
  );
}
