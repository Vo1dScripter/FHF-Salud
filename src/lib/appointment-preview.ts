/** Únicamente habilita fixtures sintéticas de desarrollo; nunca acceso a datos reales. */
export function isAppointmentPreviewEnabled() {
  return (
    process.env.NODE_ENV === 'development' &&
    process.env.FHF_APPOINTMENT_PREVIEW === 'true'
  );
}
