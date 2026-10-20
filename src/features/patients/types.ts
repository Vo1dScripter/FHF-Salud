/** Identificador estable de un paciente dentro de FHF Salud. */
export type PatientId = string;

/**
 * Referencia mínima que otros módulos pueden usar sin acoplarse al expediente.
 * El módulo de pacientes será responsable de ampliar su propio modelo.
 */
export type PatientReference = {
  displayName: string;
  id: PatientId;
};
