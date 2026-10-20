import { QuickNav } from '@/components/navigation';

const navItems = [
  { href: '#inicio', label: 'Inicio' },
  { href: '#alcance', label: 'Alcance' },
  { href: '#siguiente-etapa', label: 'Siguiente etapa' },
];

export default function Header() {
  return (
    <header className='fhf-header'>
      <div className='fhf-shell'>
        <QuickNav
          brand='FHF Salud'
          cta={{ href: '#siguiente-etapa', label: 'Ver avance' }}
          items={navItems}
          variant='hamburger'
        />
      </div>
    </header>
  );
}
