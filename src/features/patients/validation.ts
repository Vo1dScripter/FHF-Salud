import { z } from 'zod';

import { PatientError } from './errors';

export const patientIdSchema = z.uuid();
/** Alta mínima basada en patients; no acepta rol, médico ni campos inventados. */
export const createPatientSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(200),
});
export const patientQuerySchema = z.strictObject({
  search: z
    .string()
    .trim()
    .max(100)
    .regex(/^[\p{L}\p{N} .'-]*$/u)
    .default(''),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export function parsePatientQuery(value: unknown) {
  const result = patientQuerySchema.safeParse(value);
  if (!result.success) throw new PatientError('validation');
  return result.data;
}
