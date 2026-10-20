import { render, screen } from '@testing-library/react';

import HomePage from '@/app/page';

describe('Homepage', () => {
  it('renders the FHF Salud entry point', () => {
    render(<HomePage />);

    const heading = screen.getByRole('heading', {
      name: /una atención más clara empieza con una cita bien organizada/i,
    });

    expect(heading).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /la gestión de citas se construirá sobre esta preparación/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver avance/i })).toHaveAttribute(
      'href',
      '#siguiente-etapa',
    );
  });
});
