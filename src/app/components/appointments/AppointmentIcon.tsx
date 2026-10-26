/** Trazos Lucide de la referencia aprobada (licencia ISC), sin dependencia/CDN. */
export default function AppointmentIcon({
  name,
}: {
  name: 'construction' | 'info' | 'plus' | 'warning';
}) {
  return (
    <svg
      aria-hidden='true'
      className='appointment-icon'
      fill='none'
      stroke='currentColor'
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='2'
      viewBox='0 0 24 24'
    >
      {name === 'construction' && (
        <>
          <rect height='8' rx='1' width='20' x='2' y='6' />
          <path d='M17 14v7M7 14v7M17 3v3M7 3v3m3 8L2.3 6.3M14 6l7.7 7.7M8 6l8 8' />
        </>
      )}
      {name === 'info' && (
        <>
          <circle cx='12' cy='12' r='10' />
          <path d='M12 16v-4m0-4h.01' />
        </>
      )}
      {name === 'plus' && <path d='M5 12h14m-7-7v14' />}
      {name === 'warning' && (
        <path d='m21.73 18l-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4m0 4h.01' />
      )}
    </svg>
  );
}
