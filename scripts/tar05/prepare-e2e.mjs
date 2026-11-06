/** Crea SQL y credenciales ficticias locales; NO conecta ni escribe en Supabase. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const output = path.resolve(process.argv[2] || '.demo-local/tar05-e2e');
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
if (fs.existsSync(path.join(output, 'credentials.json'))) {
  throw new Error(
    'Ya existen credenciales en ese directorio; conservarlas o elegir otro destino',
  );
}
const runId = `tar05-${Date.now()}`;
const fixture = {
  runId,
  projectRef: 'oafwyfntjddrtjoqkktf',
  patientId: crypto.randomUUID(),
  physicianId: crypto.randomUUID(),
  otherPhysicianId: crypto.randomUUID(),
  patientName: `Paciente ficticio ${runId}`,
  physicianName: `Medico ficticio A ${runId}`,
  otherPhysicianName: `Medico ficticio B ${runId}`,
};
const users = Object.fromEntries(
  ['staff', 'physician', 'noRole'].map((role) => [
    role,
    {
      email: `${runId}-${role.toLowerCase()}@example.invalid`,
      password: crypto.randomBytes(24).toString('base64url'),
    },
  ]),
);
fs.writeFileSync(
  path.join(output, 'credentials.json'),
  JSON.stringify({ ...fixture, users }, null, 2),
  { mode: 0o600 },
);
fs.writeFileSync(
  path.join(output, 'fixture.json'),
  JSON.stringify(fixture, null, 2),
);
fs.writeFileSync(
  path.join(output, 'seed.sql'),
  `-- Datos exclusivamente ficticios; ejecutar solo en ${fixture.projectRef}.\nbegin;\ninsert into public.patients(id,display_name) values ('${fixture.patientId}','${fixture.patientName}');\ninsert into public.physicians(id,display_name) values ('${fixture.physicianId}','${fixture.physicianName}'),('${fixture.otherPhysicianId}','${fixture.otherPhysicianName}');\n-- Crear usuarios mediante Auth Admin (Create user con confirmacion, sin enviar email).\n-- Despues asignar exclusivamente sus roles app_metadata; nunca user_metadata.\nupdate auth.users set raw_app_meta_data = raw_app_meta_data || '{"appointment_role":"receptionist"}'::jsonb where email='${users.staff.email}';\nupdate auth.users set raw_app_meta_data = raw_app_meta_data || '{"appointment_role":"physician","physician_id":"${fixture.physicianId}"}'::jsonb where email='${users.physician.email}';\ndo $$ begin if (select count(*) from auth.users where email in ('${users.staff.email}','${users.physician.email}','${users.noRole.email}')) <> 3 then raise exception 'Faltan usuarios ficticios; transaccion revertida'; end if; end $$;\ncommit;\nselect 'PASS: referencias y roles E2E preparados' as resultado;\n`,
);
process.stdout.write(
  `Fixtures preparados en ${output}; credenciales privadas no impresas. No se ejecutaron cambios remotos.\n`,
);
