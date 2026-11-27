import type { Metadata } from 'next';

import { getClinicalRequestContext } from '@/lib/clinical-records/server';

import ClinicalHistory from '@/app/components/clinical-records/ClinicalHistory';
import ClinicalState from '@/app/components/clinical-records/ClinicalState';
import { appointmentRoutes } from '@/features/appointments';
import {
  ClinicalError,
  type ClinicalHistory as ClinicalHistoryContract,
} from '@/features/clinical-records';
import { patientRoutes } from '@/features/patients';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Expediente clínico',
  robots: { follow: false, index: false },
};

type ClinicalPageResult =
  | { history: ClinicalHistoryContract; kind: 'ready' }
  | { error: unknown; kind: 'failed' };

async function loadClinicalHistory(id: string): Promise<ClinicalPageResult> {
  try {
    const { actor, service } = await getClinicalRequestContext();
    return {
      history: await service.getHistory(actor, id),
      kind: 'ready',
    };
  } catch (error) {
    return { error, kind: 'failed' };
  }
}

export default async function ClinicalHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadClinicalHistory(id);

  if (result.kind === 'failed') {
    if (result.error instanceof ClinicalError) {
      if (result.error.code === 'unauthenticated') {
        return (
          <ClinicalState
            actionHref={appointmentRoutes.access}
            actionLabel='Iniciar sesión'
            kind='unauthenticated'
          />
        );
      }
      if (result.error.code === 'forbidden') {
        return (
          <ClinicalState
            actionHref={appointmentRoutes.list}
            actionLabel='Ir a Citas médicas'
            kind='forbidden'
          />
        );
      }
      if (
        result.error.code === 'not_found' ||
        result.error.code === 'validation'
      ) {
        return (
          <ClinicalState
            actionHref={patientRoutes.list}
            actionLabel='Volver a pacientes'
            kind='not_found'
          />
        );
      }
      return (
        <ClinicalState description={result.error.message} kind='error' />
      );
    }
    return <ClinicalState kind='error' />;
  }

  return <ClinicalHistory initialHistory={result.history} />;
}
