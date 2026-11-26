import { NextResponse } from 'next/server';

import {
  ClinicalError,
  clinicalHttpStatus,
} from '@/features/clinical-records/errors';

export type ClinicalApiErrorBody = {
  error: {
    code: string;
    fieldErrors?: Record<string, string>;
    message: string;
  };
};

export function clinicalErrorResponse(error: unknown): NextResponse {
  const safe =
    error instanceof ClinicalError ? error : new ClinicalError('unavailable');
  return NextResponse.json(
    {
      error: {
        code: safe.code,
        fieldErrors: safe.fieldErrors,
        message: safe.message,
      },
    } satisfies ClinicalApiErrorBody,
    {
      headers: { 'Cache-Control': 'private, no-store' },
      status: clinicalHttpStatus(safe.code),
    },
  );
}

export function clinicalJsonResponse(
  body: unknown,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'private, no-store' },
    status,
  });
}
