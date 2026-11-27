import type { AppointmentActor } from '@/features/appointments/contracts';

import type { ClinicalActor } from './contracts';

export type ClinicalAccessDecision =
  | { actor: ClinicalActor; allowed: true }
  | { allowed: false; code: 'forbidden' | 'unauthenticated' };

/**
 * RF-12, capa de servicio: matriz única para el historial clínico. Un médico
 * debe además estar activo y visible en `physicians`; esa comprobación se hace
 * contra la persistencia antes de leer o escribir.
 */
export function evaluateClinicalAccess(
  actor: AppointmentActor | null,
): ClinicalAccessDecision {
  if (!actor) return { allowed: false, code: 'unauthenticated' };
  if (actor.role !== 'physician') return { allowed: false, code: 'forbidden' };
  return { actor, allowed: true };
}

/**
 * Solo decide qué navegación mostrar. Ocultar un enlace no autoriza nada:
 * cada página, API, RPC y política RLS vuelve a comprobar el acceso.
 */
export function canOpenClinicalHistory(
  actor: AppointmentActor | null,
): boolean {
  return evaluateClinicalAccess(actor).allowed;
}
