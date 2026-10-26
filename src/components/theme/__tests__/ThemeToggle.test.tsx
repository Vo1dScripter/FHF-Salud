import { fireEvent, render, screen } from '@testing-library/react';

import ThemeToggle from '@/components/theme/ThemeToggle';

describe('Theme preference', () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = 'light';
    localStorage.clear();
  });
  it('updates the document, accessible switch and saved preference in both directions', () => {
    render(<ThemeToggle />);
    const toggle = screen.getByRole('switch', { name: 'Modo oscuro' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('fhf-theme')).toBe('dark');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem('fhf-theme')).toBe('light');
  });
  it('still changes theme when storage is unavailable', () => {
    const blocked = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('switch', { name: 'Modo oscuro' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    blocked.mockRestore();
  });
});
