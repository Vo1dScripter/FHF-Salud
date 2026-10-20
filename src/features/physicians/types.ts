/** Identificador estable de un médico dentro de FHF Salud. */
export type PhysicianId = string;

/**
 * Referencia mínima que otros módulos pueden usar sin acoplarse al perfil médico.
 * El módulo de médicos será responsable de ampliar su propio modelo.
 */
export type PhysicianReference = {
  displayName: string;
  id: PhysicianId;
};
