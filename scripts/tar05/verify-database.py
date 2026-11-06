#!/usr/bin/env python3
"""PostgreSQL real aislado, sin red; no usa ni modifica Supabase remoto.
Requiere podman e imagen postgres:17-alpine. Conserva stdout como evidencia.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import os
import subprocess
import time
import uuid

root = Path(__file__).resolve().parents[2]
engine = os.environ.get('CONTAINER_ENGINE', 'podman')
name = 'fhf-tar05-' + uuid.uuid4().hex[:10]
def command(args, **kwargs):
    return subprocess.run(args, text=True, capture_output=True, **kwargs)
def sql(source, check=True):
    result = command([engine,'exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1'], input=source)
    if check and result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result
try:
    result=command([engine,'run','-d','--name',name,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','docker.io/library/postgres:17-alpine'])
    result.check_returncode()
    for _ in range(40):
        if command([engine,'exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']).returncode == 0: break
        time.sleep(.25)
    else:
        raise RuntimeError('PostgreSQL no inicio en el plazo previsto')
    print(sql((root/'scripts/tar05/auth-bootstrap.sql').read_text()).stdout)
    # pg_cron/net/vault son infraestructura Supabase ajena a citas; no se simulan.
    for path in sorted((root/'supabase/migrations').glob('*.sql')):
        if path.name.startswith('202610250001'): continue
        sql('begin;\n'+path.read_text()+'\ncommit;')
        print('PASS migracion',path.name)
    for path in sorted((root/'supabase/tests').glob('*.sql')):
        result=sql(path.read_text())
        print('PASS prueba',path.name, result.stdout[-200:],result.stderr[-200:])
    sql("""insert into patients(id,display_name) values ('11111111-1111-4111-8111-111111111111','Paciente concurrencia');
    insert into physicians(id,display_name) values ('22222222-2222-4222-8222-222222222222','Medico concurrencia');""")
    insert="""insert into appointments(patient_id,physician_id,starts_at,duration_minutes,reason)
    values ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','2035-05-01 12:00Z',30,'Concurrencia sintetica');"""
    def reserve(_): return sql('begin;\n'+insert+'\nselect pg_sleep(0.2); commit;',False)
    with ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(reserve,range(2)))
    assert sum(r.returncode==0 for r in results)==1, 'Deben ganar exactamente una reserva'
    assert any('appointments_no_overlap' in r.stderr for r in results), 'Se espera EXCLUDE'
    print('PASS concurrencia dos reservas: una confirma y otra rechazada por EXCLUDE')
    # Carrera entre ausencia y reserva, ambos caminos comparten bloqueo de medico.
    block="""insert into physician_schedule_blocks(physician_id,starts_at,ends_at,reason)
    values ('22222222-2222-4222-8222-222222222222','2035-05-02 12:00Z','2035-05-02 13:00Z','Ausencia sintetica');"""
    def race(statement): return sql('begin;\n'+statement+'\nselect pg_sleep(0.2); commit;',False)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(race,[block,insert.replace('2035-05-01','2035-05-02')]))
    assert sum(r.returncode==0 for r in results)==1, 'Ausencia y cita no pueden coexistir'
    print('PASS concurrencia ausencia/reserva: exactamente una aceptada')
    print(sql("select version(); select tablename,rowsecurity from pg_tables where schemaname='public'; select conrelid::regclass,conname,pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace order by conrelid,conname;").stdout)
    print('PASS FINAL: PostgreSQL local. Supabase remoto NO verificado.')
finally:
    command([engine,'rm','-f',name])
