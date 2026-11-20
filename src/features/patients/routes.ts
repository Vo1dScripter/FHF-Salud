/** URLs del módulo de pacientes; el expediente se sirve bajo la misma ruta. */
export const patientRoutes = {
  list: '/pacientes',
  record: (id: string) => `/pacientes/${encodeURIComponent(id)}`,
} as const;
