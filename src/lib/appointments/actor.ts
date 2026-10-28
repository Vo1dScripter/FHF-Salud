import type { User } from '@supabase/supabase-js';

import type { AppointmentActor } from '@/features/appointments';
import { AppointmentError } from '@/features/appointments';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * El rol se toma de app_metadata, que solo puede modificar el servidor de
 * Supabase Auth. No se acepta un rol enviado por el navegador.
 */
export function actorFromUser(user: User): AppointmentActor {
  const role = user.app_metadata?.appointment_role;
  if (role === 'admin' || role === 'receptionist') {
    return { role, userId: user.id };
  }
  if (role === 'physician') {
    const physicianId = user.app_metadata?.physician_id;
    if (typeof physicianId === 'string' && uuidPattern.test(physicianId)) {
      // UUID normalizado para que el filtro del servicio y las políticas RLS
      // comparan el mismo valor aunque Auth lo haya guardado en mayúsculas.
      return {
        physicianId: physicianId.toLowerCase(),
        role: 'physician',
        userId: user.id,
      };
    }
  }
  throw new AppointmentError(
    'forbidden',
    'La cuenta no tiene un rol de agenda configurado.',
  );
}
