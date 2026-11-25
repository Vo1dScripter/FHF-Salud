import { NextResponse } from 'next/server';

import { getPatientRequestContext } from '@/lib/patients/server';

import { PatientError, patientHttpStatus } from '@/features/patients/errors';
import { requirePatientPhysician } from '@/features/patients/service';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

function errorResponse(error: unknown) {
  const safe =
    error instanceof PatientError ? error : new PatientError('unavailable');
  return NextResponse.json(
    { error: { code: safe.code, message: safe.message } },
    { status: patientHttpStatus(safe.code), headers },
  );
}

export async function GET(request: Request) {
  try {
    const { actor, service } = await getPatientRequestContext();
    const query = Object.fromEntries(
      new URL(request.url).searchParams.entries(),
    );
    return NextResponse.json(await service.list(actor, query), { headers });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, service } = await getPatientRequestContext();
    requirePatientPhysician(actor);
    let body: unknown;
    try {
      if (
        request.headers.get('content-type')?.split(';')[0].trim() !==
        'application/json'
      ) {
        throw new Error('JSON requerido');
      }
      body = await request.json();
    } catch {
      throw new PatientError('validation', 'Envía un cuerpo JSON válido.');
    }
    return NextResponse.json(await service.register(actor, body), {
      status: 201,
      headers,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
