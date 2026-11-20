'use client';

import Link from 'next/link';

type ClinicalStateKind =
  | 'error'
  | 'forbidden'
  | 'not_found'
  | 'unauthenticated';

const messages: Record<ClinicalStateKind, { copy: string; title: string }> = {
  error: {
    copy: 'El servicio no está disponible o no se pudo completar la conexión. No se muestran datos clínicos de ejemplo.',
    title: 'No se pudo consultar el expediente',
  },
  forbidden: {
    copy: 'Tu cuenta no tiene permisos sobre este expediente. La autorización se verifica en el servidor para cada operación.',
    title: 'Acceso restringido',
  },
  not_found: {
    copy: 'El paciente o su expediente no está disponible para tu cuenta. No se revela si existe otro registro.',
    title: 'Expediente no disponible',
  },
  unauthenticated: {
    copy: 'No se muestra información clínica sin una sesión verificada. El acceso se comprueba en el servidor.',
    title: 'Sesión requerida',
  },
};

export default function ClinicalState({
  actionHref,
  actionLabel,
  description,
  kind,
}: {
  actionHref?: string;
  actionLabel?: string;
  description?: string;
  kind: ClinicalStateKind;
}) {
  const message = messages[kind];
  return (
    <div className='appointments-state'>
      <h2>{message.title}</h2>
      <p role={kind === 'error' ? 'alert' : undefined}>
        {kind === 'error' && description ? description : message.copy}
      </p>
      {actionHref && (
        <div className='appointment-actions'>
          <Link className='appointment-new' href={actionHref}>
            {actionLabel ?? 'Volver a pacientes'}
          </Link>
        </div>
      )}
    </div>
  );
}
