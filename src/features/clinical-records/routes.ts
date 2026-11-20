/** Endpoint interno del expediente; la página usa patientRoutes.record. */
export const clinicalRoutes = {
  api: (patientId: string) =>
    `/api/pacientes/${encodeURIComponent(patientId)}/expediente`,
} as const;
