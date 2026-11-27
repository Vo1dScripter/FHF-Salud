import { actorFromUser } from '@/lib/appointments/actor';
import { createClient } from '@/lib/supabase/server';

import { AppointmentError } from '@/features/appointments/errors';
import { ClinicalError } from '@/features/clinical-records/errors';
import { ClinicalRecordService } from '@/features/clinical-records/service';
import { SupabaseClinicalRecordRepository } from '@/features/clinical-records/supabase-repository';

/**
 * Crea el servicio con la sesión SSR. La autorización real se aplica en el
 * servicio, las RPC y RLS; esta función nunca usa service_role.
 */
export async function getClinicalRequestContext() {
  let client: Awaited<ReturnType<typeof createClient>>;
  try {
    client = await createClient();
  } catch {
    throw new ClinicalError('configuration');
  }

  try {
    const { data, error } = await client.auth.getUser();
    if (error) {
      const unavailable =
        error.name === 'AuthRetryableFetchError' ||
        error.status === 0 ||
        (error.status !== undefined && error.status >= 500);
      throw new ClinicalError(unavailable ? 'unavailable' : 'unauthenticated');
    }
    if (!data.user) throw new ClinicalError('unauthenticated');
    const actor = actorFromUser(data.user);
    return {
      actor,
      service: new ClinicalRecordService(
        new SupabaseClinicalRecordRepository(client),
      ),
    };
  } catch (error) {
    if (error instanceof ClinicalError) throw error;
    if (error instanceof AppointmentError) throw new ClinicalError('forbidden');
    throw new ClinicalError('unavailable');
  }
}
