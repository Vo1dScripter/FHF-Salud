'use client';

import Link from 'next/link';

import AppointmentIcon from './AppointmentIcon';
import type { AppointmentListState } from './types';

type StateKind = Exclude<AppointmentListState['kind'], 'populated'>;

const messages = {
  empty: {
    title: 'Sin citas para estos filtros',
    copy: 'La consulta terminó correctamente, pero no hay coincidencias. Prueba otro médico, fecha o estado.',
  },
  error: {
    title: 'No se pudo consultar la agenda',
    copy: 'El servicio no está disponible o no se pudo completar la conexión. Tus datos no se han modificado.',
  },
  unauthenticated: {
    title: 'Inicia sesión para consultar la agenda',
    copy: 'No se muestran datos médicos sin una sesión verificada. El acceso se comprueba en el servidor.',
  },
  forbidden: {
    title: 'Acceso restringido',
    copy: 'Tu cuenta no tiene permisos sobre esta agenda. La autorización se verifica en servidor para cada operación.',
  },
};

const defaultActionLabels: Record<
  Exclude<StateKind, 'preparation' | 'loading' | 'forbidden'>,
  string
> = {
  empty: 'Limpiar filtros',
  error: 'Reintentar',
  unauthenticated: 'Iniciar sesión',
};

export default function AppointmentState({
  actionHref,
  actionLabel,
  description,
  kind,
  onAction,
  onRetry,
}: {
  actionHref?: string;
  actionLabel?: string;
  /** Mensaje seguro devuelto por la API; sustituye el texto genérico. */
  description?: string;
  kind: StateKind;
  onAction?: () => void;
  onRetry?: () => void;
}) {
  if (kind === 'preparation') {
    return (
      <div className='appointments-preparation'>
        <div className='appointments-construction'>
          <AppointmentIcon name='construction' />
        </div>
        <h3>Servicio en preparación</h3>
        <p>
          Esta variante es solo una vista de propuesta. La agenda productiva
          usa sesión, validación de servidor y persistencia real.
        </p>
        <div className='appointments-rf-note'>
          <AppointmentIcon name='info' />
          <span>RF-01, RF-02 y RF-05 con implementación pendiente de activación</span>
        </div>
      </div>
    );
  }
  if (kind === 'loading') {
    return (
      <div className='appointments-state' aria-busy='true'>
        <h2>Cargando citas</h2>
        <p role='status'>Consultando la agenda autorizada…</p>
        {[0, 1, 2].map((row) => (
          <div aria-hidden='true' className='appointments-skeleton' key={row} />
        ))}
      </div>
    );
  }

  const message = messages[kind];
  const copy = kind === 'error' && description ? description : message.copy;
  const retryAction = kind === 'error' ? onRetry : undefined;
  const callback = retryAction ?? onAction;
  const label =
    actionLabel ??
    defaultActionLabels[kind as keyof typeof defaultActionLabels];
  return (
    <div className='appointments-state'>
      <h2>{message.title}</h2>
      <p role={kind === 'error' ? 'alert' : undefined}>{copy}</p>
      {kind === 'error' && (
        <p>
          {callback || actionHref
            ? 'Puedes volver a intentar cargar esta vista.'
            : 'Reintentar estará disponible cuando el servicio esté configurado.'}
        </p>
      )}
      {kind === 'forbidden' ? (
        <p>No se expone información adicional de la agenda.</p>
      ) : actionHref ? (
        <div className='appointment-actions'>
          <Link className='appointment-new' href={actionHref}>
            {label}
          </Link>
        </div>
      ) : (
        <div className='appointment-actions'>
          <button
            disabled={!callback}
            onClick={callback}
            type='button'
          >
            {label}
          </button>
        </div>
      )}
    </div>
  );
}
