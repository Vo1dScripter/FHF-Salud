import { z } from 'zod';

import { ALLERGY_STATUSES } from './contracts';
import { ClinicalError } from './errors';

const MAX_TEXT = 4000;
const MAX_REASON = 500;
const MAX_REVISION = 2_147_483_646;

const optionalText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null(), z.undefined()])
    .transform((value) =>
      typeof value === 'string' && value.length > 0 ? value : null,
    );

/**
 * Objeto estricto: rechaza role, physicianId, authorUserId, createdAt o
 * cualquier otro campo que intente suplantar al servidor.
 */
export const clinicalRevisionInputSchema = z
  .strictObject({
    allergies: optionalText(MAX_TEXT),
    allergiesStatus: z.enum(ALLERGY_STATUSES),
    background: optionalText(MAX_TEXT),
    changeReason: optionalText(MAX_REASON),
    diagnosis: optionalText(MAX_TEXT),
    expectedRevision: z.coerce
      .number()
      .int()
      .min(0)
      .max(MAX_REVISION),
    treatment: optionalText(MAX_TEXT),
  })
  .superRefine((value, context) => {
    if (value.allergiesStatus === 'reported' && !value.allergies) {
      context.addIssue({
        code: 'custom',
        message: 'Describe las alergias reportadas.',
        path: ['allergies'],
      });
    }
    if (value.allergiesStatus !== 'reported' && value.allergies) {
      context.addIssue({
        code: 'custom',
        message:
          'El texto de alergias solo aplica cuando se reportan alergias.',
        path: ['allergies'],
      });
    }
    const hasClinicalContent = Boolean(
      value.background ||
        value.allergies ||
        value.diagnosis ||
        value.treatment,
    );
    if (!hasClinicalContent && value.allergiesStatus === 'not_recorded') {
      context.addIssue({
        code: 'custom',
        message: 'Registra al menos un dato clínico.',
        path: ['background'],
      });
    }
    if (value.expectedRevision > 0 && !value.changeReason) {
      context.addIssue({
        code: 'custom',
        message: 'Indica el motivo de la nueva revisión.',
        path: ['changeReason'],
      });
    }
  });

export type ParsedClinicalRevisionInput = z.infer<
  typeof clinicalRevisionInputSchema
>;

export function parseClinicalRevisionInput(
  value: unknown,
): ParsedClinicalRevisionInput {
  const result = clinicalRevisionInputSchema.safeParse(value);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key =
        issue.path.length > 0 ? issue.path.map(String).join('.') : 'form';
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    throw new ClinicalError(
      'validation',
      'Revisa la información clínica capturada.',
      fieldErrors,
    );
  }
  return result.data;
}

export function parseClinicalPatientId(value: unknown): string {
  const result = z.uuid().safeParse(value);
  if (!result.success) {
    throw new ClinicalError(
      'validation',
      'El paciente indicado no es válido.',
      { patientId: 'Usa un identificador de paciente válido.' },
    );
  }
  return result.data.toLowerCase();
}
