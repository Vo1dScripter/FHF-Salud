import { NextResponse } from 'next/server';

import { getPatientRequestContext } from '@/lib/patients/server';

import { PatientError, patientHttpStatus } from '@/features/patients/errors';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const { actor, service } = await getPatientRequestContext();
    const query = Object.fromEntries(
      new URL(request.url).searchParams.entries(),
    );
    return NextResponse.json(await service.list(actor, query), { headers });
  } catch (error) {
    const safe =
      error instanceof PatientError ? error : new PatientError('unavailable');
    return NextResponse.json(
      { error: { code: safe.code, message: safe.message } },
      { status: patientHttpStatus(safe.code), headers },
    );
  }
}
