import { fireEvent, render, screen, within } from '@testing-library/react';

import QuickNav from '@/components/navigation/QuickNav';

import Header from '@/app/components/index/Header';
import HomePage from '@/app/page';

describe('navegación global entre módulos', () => {
  it('la portada expone accesos accesibles a citas y pacientes', () => {
    render(<HomePage />);

    const nav = screen.getByRole('navigation', {
      name: 'Navegación principal',
    });
    expect(within(nav).getByRole('link', { name: 'FHF Salud' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(
      within(nav).getByRole('link', { name: 'Citas médicas' }),
    ).toHaveAttribute('href', '/citas');
    expect(
      within(nav).getByRole('link', { name: 'Pacientes' }),
    ).toHaveAttribute('href', '/pacientes');
    expect(
      within(nav).getByRole('link', { name: 'Ver avance' }),
    ).toHaveAttribute('href', '#siguiente-etapa');
  });

  it.each([
    ['citas', true, false, '/citas', 'Citas médicas'],
    ['pacientes', false, true, '/pacientes', 'Pacientes'],
  ])(
    'marca el módulo activo en el encabezado de %s',
    (_name, appointments, patients, href, label) => {
      render(<Header appointments={appointments} patients={patients} />);

      const active = screen.getByRole('link', { name: label });
      expect(active).toHaveAttribute('aria-current', 'page');
      expect(active).toHaveAttribute('href', href);
    },
  );

  it('abre el menú móvil, lo cierra con Escape y devuelve el foco', () => {
    render(
      <QuickNav
        brand='FHF Salud'
        items={[
          { href: '/citas', label: 'Citas médicas' },
          { href: '/pacientes', label: 'Pacientes' },
        ]}
        variant='hamburger'
      />,
    );

    const toggle = screen.getByRole('button', { name: 'Abrir menú' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(screen.getByRole('link', { name: 'Pacientes' }), {
      key: 'Escape',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });
});
