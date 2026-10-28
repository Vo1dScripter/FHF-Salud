import { fireEvent, render, screen } from '@testing-library/react';

import AppointmentDetail from '@/app/components/appointments/AppointmentDetail';
import AppointmentForm from '@/app/components/appointments/AppointmentForm';
import AppointmentList from '@/app/components/appointments/AppointmentList';
import AppointmentState from '@/app/components/appointments/AppointmentState';

describe('Appointment preparation boundary', () => {
  it('reports an unavailable integration without pretending that the agenda is empty', () => {
    render(<AppointmentList />);
    expect(
      screen.getByRole('heading', { name: 'Servicio en preparación' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva cita' })).toBeDisabled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Sin citas para estos filtros'),
    ).not.toBeInTheDocument();
  });
  it('does not accept medical input or enable writes before integration', () => {
    render(
      <>
        <AppointmentForm state='preparation' />
        <AppointmentDetail />
      </>,
    );
    expect(screen.getByLabelText('Paciente')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Motivo de la consulta')).toBeDisabled();
    for (const name of [
      'Guardar cita',
      'Confirmar',
      'Reprogramar',
      'Cancelar cita',
    ]) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
    expect(
      screen.getByText(/No se ha consultado ningún registro/),
    ).toBeInTheDocument();
  });
  it('only offers recovery when a real retry callback is provided', () => {
    const retry = jest.fn();
    const { rerender } = render(<AppointmentState kind='error' />);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDisabled();
    rerender(<AppointmentState kind='error' onRetry={retry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
