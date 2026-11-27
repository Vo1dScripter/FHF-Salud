import { actorFromUser } from '@/lib/appointments/actor';
import { createClient } from '@/lib/supabase/server';

import { AppointmentError } from '@/features/appointments/errors';
import { PatientError } from '@/features/patients/errors';
import { PatientService } from '@/features/patients/service';
import { SupabasePatientRepository } from '@/features/patients/supabase-repository';

export async function getPatientRequestContext() {
  let client: Awaited<ReturnType<typeof createClient>>;
  try {
    client = await createClient();
  } catch {
    throw new PatientError('configuration');
  }
  try {
    const { data, error } = await client.auth.getUser();
    if (error) {
      const unavailable =
        error.name === 'AuthRetryableFetchError' ||
        error.status === 0 ||
        (error.status !== undefined && error.status >= 500);
      throw new PatientError(unavailable ? 'unavailable' : 'unauthenticated');
    }
    if (!data.user) throw new PatientError('unauthenticated');
    const actor = actorFromUser(data.user);
    return {
      actor,
      service: new PatientService(new SupabasePatientRepository(client)),
    };
  } catch (error) {
    if (error instanceof PatientError) throw error;
    if (error instanceof AppointmentError) throw new PatientError('forbidden');
    throw new PatientError('unavailable');
  }
}
