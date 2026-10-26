'use client';

import AppointmentIcon from './AppointmentIcon';
import type { AppointmentListState } from './types';

type StateKind = Exclude<AppointmentListState['kind'], 'populated'>;
const messages = {
  empty: {
    title: 'Sin citas para estos filtros',
    copy: 'Esta variante representa una consulta exitosa sin coincidencias. La falta de conexión nunca se presenta como agenda vacía.',
  },
  error: {
    title: 'No se pudo consultar la agenda',
    copy: 'El servicio no está disponible. Tus datos no se han modificado.',
  },
  unauthenticated: {
    title: 'Inicia sesión para consultar tus citas',
    copy: 'No se muestran datos médicos sin una sesión verificada. El acceso se habilitará al integrar autenticación.',
  },
  forbidden: {
    title: 'Acceso restringido',
    copy: 'Tu cuenta debe contar con permisos sobre esta agenda. La autorización se verificará en servidor para cada operación.',
  },
};

export default function AppointmentState({
  kind,
  onRetry,
}: {
  kind: StateKind;
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
          El contrato de servicios para la consulta de citas está definido pero
          no se ha integrado la lógica de persistencia. Los controles de
          escritura están deshabilitados.
        </p>
        <div className='appointments-rf-note'>
          <AppointmentIcon name='info' />
          <span>RF-01 a RF-06 pendientes de implementación</span>
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
  return (
    <div className='appointments-state'>
      <h2>{message.title}</h2>
      <p role={kind === 'error' ? 'alert' : undefined}>{message.copy}</p>
      {kind === 'error' && (
        <p>
          {onRetry
            ? 'Puedes volver a intentar cargar esta vista.'
            : 'Reintentar estará disponible al conectar el servicio real.'}
        </p>
      )}
      {kind === 'forbidden' && (
        <p>No se expone información de la cita solicitada.</p>
      )}
      {kind !== 'forbidden' && (
        <div className='appointment-actions'>
          <button
            disabled={kind !== 'error' || !onRetry}
            onClick={kind === 'error' ? onRetry : undefined}
            type='button'
          >
            {kind === 'error'
              ? 'Reintentar'
              : kind === 'empty'
                ? 'Limpiar filtros'
                : 'Iniciar sesión'}
          </button>
        </div>
      )}
    </div>
  );
}
