/** Genera limpieza administrativa restringida a referencias y usuarios ficticios.
 * NO ejecuta SQL. Revisar y ejecutar en el proyecto indicado en fixture.json.
 */
import fs from 'node:fs';
import path from 'node:path';
const directory = path.resolve(process.argv[2] || '.demo-local/tar05-e2e');
const fixture = JSON.parse(
  fs.readFileSync(path.join(directory, 'credentials.json'), 'utf8'),
);
if (!/^tar05-\d+$/.test(fixture.runId))
  throw new Error('Fixture no reconocido');
for (const key of ['patientId', 'physicianId', 'otherPhysicianId']) {
  if (!/^[a-f0-9-]{36}$/.test(fixture[key])) throw new Error('ID invalido');
}
for (const user of Object.values(fixture.users)) {
  if (
    !new RegExp(`^${fixture.runId}-[a-z]+@example\\.invalid$`).test(user.email)
  )
    throw new Error('Solo se admite borrar cuentas ficticias de esta corrida');
}
const list = `'${fixture.physicianId}','${fixture.otherPhysicianId}'`;
const emails = Object.values(fixture.users)
  .map((user) => `'${user.email}'`)
  .join(',');
const sql = `-- SOLO ${fixture.projectRef}, corrida ${fixture.runId}. Revisar antes de ejecutar.\nbegin;\ndo $$ begin\n if exists(select 1 from public.appointments where (patient_id='${fixture.patientId}' or physician_id in (${list})) and reason not like 'TAR05 E2E ${fixture.runId}%') then raise exception 'Hay registros ajenos al fixture; no borrar'; end if;\n if exists(select 1 from public.physician_schedule_blocks where physician_id in (${list}) and reason not like 'TAR05 E2E ${fixture.runId}%') then raise exception 'Hay bloqueos ajenos al fixture; no borrar'; end if;\nend $$;\ndelete from public.appointment_events where appointment_id in (select id from public.appointments where patient_id='${fixture.patientId}' and physician_id in (${list}) and reason like 'TAR05 E2E ${fixture.runId}%');\ndelete from public.appointments where patient_id='${fixture.patientId}' and physician_id in (${list}) and reason like 'TAR05 E2E ${fixture.runId}%';\ndelete from public.physician_schedule_blocks where physician_id in (${list}) and reason like 'TAR05 E2E ${fixture.runId}%';\ndelete from public.patients where id='${fixture.patientId}' and display_name='${fixture.patientName}';\ndelete from public.physicians where id in (${list}) and display_name in ('${fixture.physicianName}','${fixture.otherPhysicianName}');\ndelete from auth.users where email in (${emails});\ncommit;\nselect jsonb_build_object('patients',(select count(*) from public.patients where id='${fixture.patientId}'),'physicians',(select count(*) from public.physicians where id in (${list})),'appointments',(select count(*) from public.appointments where patient_id='${fixture.patientId}' or physician_id in (${list})),'users',(select count(*) from auth.users where email in (${emails}))) as fixture_cleanup;\n`;
const output = path.join(directory, 'cleanup.sql');
fs.writeFileSync(output, sql);
process.stdout.write(`SQL de limpieza preparado: ${output}; NO ejecutado.\n`);
