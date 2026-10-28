/**
 * URLs compartidas de las pantallas de preparación del módulo.
 * No contienen operaciones de persistencia.
 */
export const appointmentRoutes = {
  access: '/citas/acceso',
  detail: (id: string) => `/citas/${encodeURIComponent(id)}`,
  list: '/citas',
  new: '/citas/nueva',
} as const;

/** Endpoints internos consumidos por los componentes de agenda. */
export const appointmentApiRoutes = {
  list: '/api/citas',
  detail: (id: string) => `/api/citas/${encodeURIComponent(id)}`,
} as const;

/** Etiquetas de presentación; los valores persistidos se mantienen en inglés. */
export const appointmentStatusLabels = {
  cancelled: 'Cancelada',
  confirmed: 'Confirmada',
  pending: 'Pendiente',
} as const;
