import { render, screen } from '@testing-library/react';

import HomePage from '@/app/page';

describe('Homepage', () => {
  it('renders the Components', () => {
    render(<HomePage />);

    const heading = screen.getByRole('heading', {
      name: /mi sitio con next\.js/i,
    });

    expect(heading).toBeInTheDocument();
    expect(screen.getByText(/galería de animaciones/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: /cada bloque muestra un preset en pantalla completa/i,
      }),
    ).toBeInTheDocument();
  });
});
