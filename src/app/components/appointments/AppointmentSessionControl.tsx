'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

import { appointmentRoutes } from '@/features/appointments';

export default function AppointmentSessionControl() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const supabase = createClient();
      void supabase.auth
        .getUser()
        .then(({ data }) => {
          if (!cancelled) setHasSession(Boolean(data.user));
        })
        .catch(() => {
          // Sin configuración no se muestra un control de sesión falso.
        });
    } catch {
      // Sin configuración no se muestra un control de sesión falso.
    }
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hasSession) return null;

  async function signOut() {
    setSigningOut(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError(
          'No se pudo cerrar la sesión. Vuelve a intentarlo o cierra el navegador.',
        );
        return;
      }
      router.push(appointmentRoutes.access);
      router.refresh();
    } catch {
      setError(
        'La conexión con Supabase no está configurada. No se pudo cerrar la sesión.',
      );
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className='appointment-session'>
      <div className='appointment-actions'>
        <button disabled={signingOut} onClick={signOut} type='button'>
          {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
      </div>
      {error && (
        <p className='appointment-form-note' role='alert'>
          {error}
        </p>
      )}
    </div>
  );
}
