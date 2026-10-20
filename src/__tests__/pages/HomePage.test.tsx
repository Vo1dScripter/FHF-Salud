import { render, screen } from '@testing-library/react';

import HomePage from '@/app/page';

describe('Homepage', () => {
  it('renders the FHF Salud entry point', () => {
    render(<HomePage />);

    const heading = screen.getByRole('heading', {
      name: /atención organizada desde la primera cita/i,
    });

    expect(heading).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /lista para su siguiente etapa de construcción/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /citas médicas/i }),
    ).toHaveAttribute('href', '#citas');
  });
});
