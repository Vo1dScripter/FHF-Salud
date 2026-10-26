/** Acciones preparadas; no se habilitan antes de integrar servicio y autorización. */
export default function AppointmentActions() {
  return (
    <div className='appointment-actions-region'>
      <div
        className='appointment-actions'
        aria-describedby='appointment-actions-note'
      >
        <button disabled type='button'>
          Confirmar
        </button>
        <button disabled type='button'>
          Reprogramar
        </button>
        <button disabled type='button'>
          Cancelar cita
        </button>
      </div>
      <label htmlFor='appointment-cancel-reason'>Motivo de cancelación</label>
      <textarea disabled id='appointment-cancel-reason' rows={3} />
      <p id='appointment-actions-note'>
        Acciones en preparación, sujetas a sesión, permisos y respuesta del
        servidor.
      </p>
    </div>
  );
}
