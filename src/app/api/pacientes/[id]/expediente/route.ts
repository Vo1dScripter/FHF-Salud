import { clinicalErrorResponse, clinicalJsonResponse } from '@/lib/clinical-records/http';
import { getClinicalRequestContext } from '@/lib/clinical-records/server';

import { ClinicalError } from '@/features/clinical-records/errors';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function readBody(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new ClinicalError(
      'validation',
      'El cuerpo de la solicitud no es un JSON válido.',
    );
  }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { actor, service } = await getClinicalRequestContext();
    const history = await service.getHistory(actor, id);
    return clinicalJsonResponse({ history });
  } catch (error) {
    return clinicalErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readBody(request);
    const { actor, service } = await getClinicalRequestContext();
    const result = await service.saveRevision(actor, id, body);
    return clinicalJsonResponse(
      result,
      result.revision.revisionNumber === 1 ? 201 : 200,
    );
  } catch (error) {
    return clinicalErrorResponse(error);
  }
}
