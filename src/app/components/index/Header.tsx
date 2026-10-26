import { QuickNav } from '@/components/navigation';
import ThemeToggle from '@/components/theme/ThemeToggle';

import { appointmentRoutes } from '@/features/appointments';

export default function Header({
  appointments = false,
}: {
  appointments?: boolean;
}) {
  const prefix = appointments ? '/' : '';
  const navItems = [
    { href: `${prefix}#inicio`, label: 'Inicio' },
    { href: `${prefix}#alcance`, label: 'Alcance' },
    { href: `${prefix}#siguiente-etapa`, label: 'Siguiente etapa' },
    {
      active: appointments,
      href: appointmentRoutes.list,
      label: 'Citas médicas',
    },
  ];
  return (
    <header
      className={
        appointments ? 'fhf-header fhf-header--appointments' : 'fhf-header'
      }
    >
      <div className='fhf-shell'>
        <QuickNav
          brand='FHF Salud'
          cta={{ href: `${prefix}#siguiente-etapa`, label: 'Ver avance' }}
          endContent={<ThemeToggle />}
          items={navItems}
          variant='hamburger'
        />
      </div>
    </header>
  );
}
