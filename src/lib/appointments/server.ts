import type { User } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';

import { AppointmentError } from '@/features/appointments/errors';
import { DefaultAppointmentAgendaService } from '@/features/appointments/service';
import { SupabaseAppointmentRepository } from '@/features/appointments/supabase-repository';

import { actorFromUser } from './actor';

export type AppointmentRequestContext = {
  actor: ReturnType<typeof actorFromUser>;
  service: DefaultAppointmentAgendaService;
};

function authErrorIsUnavailable(error: {
  name?: string;
  status?: number;
}): boolean {
  return (
    error.name === 'AuthRetryableFetchError' ||
    error.status === 0 ||
    (typeof error.status === 'number' && error.status >= 500)
  );
}

/**
 * Crea el servicio con la sesión de la petición. La clave pública y las cookies
 * identifican al usuario, pero la autorización real se aplica en RLS y en el
 * servicio; esta función no usa service_role.
 */
export async function getAppointmentRequestContext(): Promise<AppointmentRequestContext> {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    throw new AppointmentError('configuration');
  }

  let user: User | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (authErrorIsUnavailable(error)) {
        throw new AppointmentError('unavailable');
      }
      throw new AppointmentError('unauthenticated');
    }
    user = data.user;
  } catch (error) {
    if (error instanceof AppointmentError) throw error;
    throw new AppointmentError('unavailable');
  }

  if (!user) throw new AppointmentError('unauthenticated');
  const actor = actorFromUser(user);
  const repository = new SupabaseAppointmentRepository(supabase);
  const service = new DefaultAppointmentAgendaService(
    repository,
    repository,
    repository,
  );
  return { actor, service };
}
