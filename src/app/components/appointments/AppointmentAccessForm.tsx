'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';

import { appointmentRoutes } from '@/features/appointments';

import AppointmentIcon from './AppointmentIcon';

export default function AppointmentAccessForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        setError(
          'No se pudo iniciar sesión. Comprueba tus credenciales o solicita acceso al administrador.',
        );
        return;
      }
      router.push(appointmentRoutes.list);
      router.refresh();
    } catch {
      setError(
        'La conexión con Supabase no está configurada en este entorno. Solicita la configuración al responsable del proyecto.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className='appointment-form-panel'>
      <h2>Acceso a la agenda</h2>
      <p className='appointment-form-note' role='status'>
        <AppointmentIcon name='info' />
        <span>
          Usa una cuenta creada por el administrador. El rol de agenda se
          configura en el servidor de Supabase Auth.
        </span>
      </p>
      <form
        aria-busy={submitting}
        className='appointment-form'
        onSubmit={handleSubmit}
      >
        <div className='appointment-field appointment-field--wide'>
          <label htmlFor='appointment-email'>Correo electrónico</label>
          <input
            autoComplete='email'
            id='appointment-email'
            onChange={(event) => setEmail(event.target.value)}
            required
            type='email'
            value={email}
          />
        </div>
        <div className='appointment-field appointment-field--wide'>
          <label htmlFor='appointment-password'>Contraseña</label>
          <input
            autoComplete='current-password'
            id='appointment-password'
            onChange={(event) => setPassword(event.target.value)}
            required
            type='password'
            value={password}
          />
        </div>
        {error && (
          <p className='appointment-form-note appointment-field--wide' role='alert'>
            <AppointmentIcon name='warning' />
            <span>{error}</span>
          </p>
        )}
        <div className='appointment-form-actions appointment-field--wide'>
          <Link href={appointmentRoutes.list}>Volver</Link>
          <button disabled={submitting} type='submit'>
            {submitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </div>
      </form>
    </section>
  );
}
