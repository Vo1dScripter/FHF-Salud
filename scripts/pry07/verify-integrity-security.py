#!/usr/bin/env python3
"""PRY07 · Emilio Martínez · Integridad y seguridad sobre PostgreSQL 17 local.

Arranca un contenedor efímero sin red, aplica las migraciones del repositorio y
ejecuta las suites SQL de supabase/tests/pry07. Añade pruebas de persistencia y
de concurrencia con conexiones independientes. Solo usa datos ficticios.

No conecta a Supabase remoto, no usa credenciales reales y elimina únicamente
el contenedor que crea esta corrida.

Uso:
    CONTAINER_ENGINE=docker python scripts/pry07/verify-integrity-security.py
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import json
import os
import platform
import re
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
ENGINE = os.environ.get("CONTAINER_ENGINE", "podman")
IMAGE = "docker.io/library/postgres:17-alpine"
RUN_ID = uuid.uuid4().hex[:10]
NAME = f"fhf-pry07-emilio-{RUN_ID}"
TEMPLATE = f"pry07_template_{RUN_ID}"
EVIDENCE = ROOT / "evidencias" / "PRY07" / "02-emilio"
SQL_DIR = ROOT / "supabase" / "tests" / "pry07"
MIGRATIONS = ROOT / "supabase" / "migrations"
SKIP_MIGRATIONS = {"202610250001_reminder_infrastructure.sql"}

SUITES = (
    ("integridad", "01-integridad.sql", "Integridad referencial"),
    ("citas", "02-citas-reglas.sql", "Reglas de citas"),
    ("seguridad", "03-seguridad-rls.sql", "Seguridad y RLS"),
)

ADMIN_ID = "7e000000-0000-4000-8000-0000000000f1"
RECEPTIONIST_ID = "7e000000-0000-4000-8000-0000000000f2"
PATIENT_ID = "7e000000-0000-4000-8000-000000000001"
PHYSICIAN_ID = "7e000000-0000-4000-8000-0000000000a1"

BLOCKED_CASES = (
    (
        "EXP-01",
        "Expedientes clínicos",
        "Lectura de expediente por un usuario no vinculado",
        "BLOQUEADO POR INTEGRACIÓN: el PR #11 con el esquema clínico sigue "
        "abierto y no está incluido en feature/pry07-base-e2e.",
    ),
    (
        "EXP-02",
        "Expedientes clínicos",
        "Autoría y protección de revisiones clínicas",
        "BLOQUEADO POR INTEGRACIÓN: no existen tablas de expediente ni de "
        "revisiones clínicas en esta rama.",
    ),
    (
        "EXP-03",
        "Expedientes clínicos",
        "Escritura directa sobre expediente y revisiones",
        "BLOQUEADO POR INTEGRACIÓN: depende del esquema clínico del PR #11.",
    ),
)

RESULTS: list[dict] = []
LOG: list[str] = []


def log(message: str = "") -> None:
    print(message, flush=True)
    LOG.append(message)


def command(args: list[str], source: str | None = None, timeout: int = 180):
    return subprocess.run(
        args,
        input=source,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        timeout=timeout,
    )


def psql(database: str, source: str, check: bool = True, timeout: int = 180):
    result = command(
        [
            ENGINE, "exec", "-i", NAME, "psql",
            "-U", "postgres", "-d", database,
            "-X", "-q", "-A", "-t", "-F", "|",
            "-v", "ON_ERROR_STOP=1",
            "-v", "VERBOSITY=verbose",
        ],
        source,
        timeout,
    )
    if check and result.returncode != 0:
        raise RuntimeError(
            f"psql falló en {database}: {result.stderr[-1500:]}"
        )
    return result


def scalar(database: str, sql: str) -> str:
    return psql(database, sql).stdout.strip()


def createdb(database: str) -> None:
    result = command(
        [ENGINE, "exec", NAME, "createdb", "-U", "postgres", "-T", TEMPLATE, database]
    )
    if result.returncode != 0:
        raise RuntimeError(f"createdb falló: {result.stderr[-800:]}")


def add_case(
    case_id: str,
    module: str,
    description: str,
    status: str,
    detail: str = "",
) -> None:
    RESULTS.append(
        {
            "id": case_id,
            "module": module,
            "description": description,
            "status": status,
            "detail": detail,
        }
    )


CASE_RE = re.compile(r"^PRY07\|([^|]+)\|(PASS|FAIL)\|([^|]*)\|?(.*)$")


def parse_cases(stdout: str, module: str) -> list[dict]:
    cases = []
    for line in stdout.splitlines():
        match = CASE_RE.match(line.strip())
        if match:
            cases.append(
                {
                    "id": match.group(1),
                    "module": module,
                    "status": match.group(2),
                    "description": match.group(3),
                    "detail": match.group(4),
                }
            )
    return cases


def start_container() -> None:
    log(f"# Contenedor efímero: {NAME}")
    result = command(
        [
            ENGINE, "run", "-d", "--rm",
            "--name", NAME,
            "--network", "none",
            "-e", "POSTGRES_HOST_AUTH_METHOD=trust",
            IMAGE,
        ]
    )
    if result.returncode != 0:
        raise RuntimeError(f"No se pudo iniciar PostgreSQL: {result.stderr[-800:]}")
    for attempt in range(80):
        ready = command(
            [ENGINE, "exec", NAME, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]
        )
        if ready.returncode == 0:
            log("# PostgreSQL local disponible")
            return
        time.sleep(0.25)
    raise RuntimeError("PostgreSQL no inició en el plazo previsto")


def apply_migrations() -> list[dict]:
    bootstrap = (ROOT / "scripts/tar05/auth-bootstrap.sql").read_text(encoding="utf-8")
    psql("postgres", bootstrap)
    psql(
        "postgres",
        f'create database "{TEMPLATE}"',
    )
    psql(
        TEMPLATE,
        """
        create schema if not exists auth;
        create schema if not exists extensions;
        grant usage on schema public, auth to anon, authenticated;
        create or replace function auth.jwt()
        returns jsonb
        language sql
        stable
        as $$
          select coalesce(
            nullif(current_setting('request.jwt.claims', true), ''),
            '{}'
          )::jsonb
        $$;
        create or replace function auth.uid()
        returns uuid
        language sql
        stable
        as $$
          select (auth.jwt() ->> 'sub')::uuid
        $$;
        """,
    )
    applied = []
    for path in sorted(MIGRATIONS.glob("*.sql")):
        if path.name in SKIP_MIGRATIONS:
            log(f"SKIP migración {path.name} (requiere pg_cron/pg_net/Vault)")
            continue
        started = time.perf_counter()
        psql(TEMPLATE, path.read_text(encoding="utf-8"))
        elapsed = time.perf_counter() - started
        applied.append({"name": path.name, "seconds": round(elapsed, 3)})
        log(f"PASS migración {path.name} ({elapsed:.3f}s)")
    return applied


def run_sql_suite(key: str, filename: str, module: str) -> None:
    database = f"pry07_{key}_{RUN_ID}"
    createdb(database)
    source = (SQL_DIR / filename).read_text(encoding="utf-8")
    log(f"# Suite {filename} sobre {database}")
    result = psql(database, source, check=False, timeout=300)
    cases = parse_cases(result.stdout, module)
    RESULTS.extend(cases)
    if result.returncode != 0:
        log(f"FAIL suite {filename}")
        log(result.stderr[-2000:])
        add_case(
            f"SUITE-{key}",
            module,
            f"La suite {filename} se detuvo antes de completar todos los casos",
            "FAIL",
            result.stderr[-1500:],
        )
    else:
        passed = sum(1 for case in cases if case["status"] == "PASS")
        failed = sum(1 for case in cases if case["status"] == "FAIL")
        log(f"# Suite {filename}: {passed} PASS, {failed} FAIL")


def receptionist_claims() -> str:
    return (
        "select set_config('request.jwt.claims', "
        "jsonb_build_object('sub', '" + RECEPTIONIST_ID + "', "
        "'app_metadata', jsonb_build_object('appointment_role', 'receptionist'))::text, "
        "false);"
    )


def admin_claims() -> str:
    return (
        "select set_config('request.jwt.claims', "
        "jsonb_build_object('sub', '" + ADMIN_ID + "', "
        "'app_metadata', jsonb_build_object('appointment_role', 'admin'))::text, "
        "false);"
    )


def persistence_cases() -> None:
    module = "Persistencia entre conexiones"
    database = f"pry07_persistencia_{RUN_ID}"
    createdb(database)
    psql(
        database,
        f"""
        insert into public.patients (id, display_name)
        values ('{PATIENT_ID}', 'Paciente Ficticio Persistencia');
        insert into public.physicians (id, display_name)
        values ('{PHYSICIAN_ID}', 'Dra. Ficticia Persistencia');
        """,
    )

    appointment_id = "7e000000-0000-4000-8000-000000000301"
    created = psql(
        database,
        receptionist_claims()
        + f"""
        set role authenticated;
        insert into public.appointments (
          id, patient_id, physician_id, starts_at, duration_minutes, reason
        ) values (
          '{appointment_id}',
          '{PATIENT_ID}',
          '{PHYSICIAN_ID}',
          '2035-08-01T09:00:00Z', 30, 'Persistencia ficticia'
        );
        """,
        check=False,
    )
    add_case(
        "PER-01",
        module,
        "La creación confirmada por recepción se lee desde otra conexión",
        "PASS" if created.returncode == 0 else "FAIL",
        created.stderr[-600:] if created.returncode else "COMMIT recibido",
    )

    state = scalar(
        database,
        f"""
        select status
          || '|' || (ends_at = '2035-08-01T09:30:00Z'::timestamptz)::text
          || '|' || (select count(*) from public.appointment_events
                     where appointment_id = '{appointment_id}'
                       and event_type = 'created')::text
        from public.appointments where id = '{appointment_id}';
        """,
    )
    add_case(
        "PER-02",
        module,
        "La cita persistida conserva estado, fin derivado y evento created",
        "PASS" if state == "pending|true|1" else "FAIL",
        f"observado={state}",
    )

    duplicate = psql(
        database,
        receptionist_claims()
        + f"""
        set role authenticated;
        insert into public.appointments (
          patient_id, physician_id, starts_at, duration_minutes, reason
        ) values (
          '{PATIENT_ID}', '{PHYSICIAN_ID}',
          '2035-08-01T09:00:00Z', 30, 'Duplicado persistente'
        );
        """,
        check=False,
    )
    rejected = duplicate.returncode != 0 and (
        "23P01" in duplicate.stderr or "appointments_no_overlap" in duplicate.stderr
    )
    add_case(
        "PER-03",
        module,
        "La reserva duplicada se rechaza entre conexiones",
        "PASS" if rejected else "FAIL",
        duplicate.stderr[-600:] if duplicate.returncode else "sin error",
    )

    count_after = scalar(
        database,
        f"""
        select count(*) from public.appointments
        where physician_id = '{PHYSICIAN_ID}'
          and starts_at = '2035-08-01T09:00:00Z'::timestamptz;
        """,
    )
    add_case(
        "PER-04",
        module,
        "El rechazo no deja una fila duplicada",
        "PASS" if count_after == "1" else "FAIL",
        f"filas={count_after}",
    )

    cancelled = psql(
        database,
        receptionist_claims()
        + f"""
        set role authenticated;
        select public.cancel_appointment(
          '{appointment_id}',
          (select updated_at from public.appointments where id = '{appointment_id}'),
          'Motivo persistente'
        );
        """,
        check=False,
    )
    add_case(
        "PER-05",
        module,
        "La cancelación por RPC se confirma y persiste",
        "PASS" if cancelled.returncode == 0 else "FAIL",
        cancelled.stderr[-600:] if cancelled.returncode else "COMMIT recibido",
    )

    cancel_state = scalar(
        database,
        f"""
        select status
          || '|' || coalesce(cancellation_reason, '')
          || '|' || (cancelled_by = '{RECEPTIONIST_ID}'::uuid)::text
          || '|' || (select count(*) from public.appointment_events
                     where appointment_id = '{appointment_id}'
                       and event_type = 'cancelled')::text
        from public.appointments where id = '{appointment_id}';
        """,
    )
    add_case(
        "PER-06",
        module,
        "La cancelación persiste con motivo, autor y un solo evento",
        "PASS"
        if cancel_state == "cancelled|Motivo persistente|true|1"
        else "FAIL",
        f"observado={cancel_state}",
    )

    rebooked = psql(
        database,
        receptionist_claims()
        + f"""
        set role authenticated;
        insert into public.appointments (
          id, patient_id, physician_id, starts_at, duration_minutes, reason
        ) values (
          '7e000000-0000-4000-8000-000000000302',
          '{PATIENT_ID}', '{PHYSICIAN_ID}',
          '2035-08-01T09:00:00Z', 30, 'Reocupación persistente'
        );
        """,
        check=False,
    )
    slot_state = scalar(
        database,
        f"""
        select count(*)::text || '|' ||
          (select count(*) from public.appointments
           where starts_at = '2035-08-01T09:00:00Z'::timestamptz
             and status <> 'cancelled')::text
        from public.appointments
        where starts_at = '2035-08-01T09:00:00Z'::timestamptz;
        """,
    )
    add_case(
        "PER-07",
        module,
        "El horario liberado acepta una reserva persistente y mantiene el historial",
        "PASS" if rebooked.returncode == 0 and slot_state == "2|1" else "FAIL",
        f"filas_activas={slot_state}",
    )


def concurrent_psql(database: str, sources: list[str]):
    with ThreadPoolExecutor(max_workers=len(sources)) as pool:
        futures = [pool.submit(psql, database, source, False, 120) for source in sources]
        return [future.result() for future in futures]


def concurrency_cases() -> None:
    module = "Concurrencia real"
    database = f"pry07_concurrencia_{RUN_ID}"
    createdb(database)
    psql(
        database,
        f"""
        insert into public.patients (id, display_name)
        values ('{PATIENT_ID}', 'Paciente Ficticio Concurrencia');
        insert into public.physicians (id, display_name)
        values ('{PHYSICIAN_ID}', 'Dra. Ficticia Concurrencia');
        insert into public.appointments (
          id, patient_id, physician_id, starts_at, duration_minutes, reason
        ) values
          ('7e000000-0000-4000-8000-000000000401',
           '{PATIENT_ID}', '{PHYSICIAN_ID}',
           '2035-09-01T09:00:00Z', 30, 'Confirmación concurrente'),
          ('7e000000-0000-4000-8000-000000000402',
           '{PATIENT_ID}', '{PHYSICIAN_ID}',
           '2035-09-01T10:00:00Z', 30, 'Cancelación concurrente'),
          ('7e000000-0000-4000-8000-000000000403',
           '{PATIENT_ID}', '{PHYSICIAN_ID}',
           '2035-09-04T09:00:00Z', 30, 'Reprogramación concurrente A'),
          ('7e000000-0000-4000-8000-000000000404',
           '{PATIENT_ID}', '{PHYSICIAN_ID}',
           '2035-09-04T10:00:00Z', 30, 'Reprogramación concurrente B');
        """,
    )

    def source(claims: str, statement: str, delay: float = 0.5, hold: float = 0.4) -> str:
        return (
            claims
            + f"""
            begin;
            select pg_sleep({delay});
            set local role authenticated;
            {statement}
            select pg_sleep({hold});
            commit;
            """
        )

    # CON-01 · Dos reservas simultáneas para el mismo médico y horario.
    insert = f"""
        insert into public.appointments (
          patient_id, physician_id, starts_at, duration_minutes, reason
        ) values (
          '{PATIENT_ID}', '{PHYSICIAN_ID}',
          '2035-09-06T09:00:00Z', 30, 'Reserva concurrente'
        );
    """
    results = concurrent_psql(
        database,
        [source(receptionist_claims(), insert), source(receptionist_claims(), insert)],
    )
    success = sum(1 for item in results if item.returncode == 0)
    rejected = sum(
        1
        for item in results
        if item.returncode != 0
        and ("23P01" in item.stderr or "appointments_no_overlap" in item.stderr)
    )
    rows = scalar(
        database,
        """
        select count(*) from public.appointments
        where starts_at = '2035-09-06T09:00:00Z'::timestamptz;
        """,
    )
    add_case(
        "CON-01",
        module,
        "Dos reservas simultáneas del mismo horario: una gana y una es rechazada",
        "PASS" if success == 1 and rejected == 1 and rows == "1" else "FAIL",
        f"exitos={success} rechazos_23P01={rejected} filas={rows}",
    )

    # CON-02 · Dos confirmaciones simultáneas con la misma versión.
    expected_confirm = scalar(
        database,
        """
        select updated_at from public.appointments
        where id = '7e000000-0000-4000-8000-000000000401';
        """,
    )
    confirm = f"""
        select public.confirm_appointment(
          '7e000000-0000-4000-8000-000000000401',
          '{expected_confirm}'::timestamptz
        );
    """
    results = concurrent_psql(
        database, [source(admin_claims(), confirm), source(admin_claims(), confirm)]
    )
    success = sum(1 for item in results if item.returncode == 0)
    conflicts = sum(1 for item in results if "PT409" in item.stderr)
    events = scalar(
        database,
        """
        select count(*) from public.appointment_events
        where appointment_id = '7e000000-0000-4000-8000-000000000401'
          and event_type = 'confirmed';
        """,
    )
    status = scalar(
        database,
        """
        select status from public.appointments
        where id = '7e000000-0000-4000-8000-000000000401';
        """,
    )
    add_case(
        "CON-02",
        module,
        "Dos confirmaciones simultáneas son idempotentes y auditan una sola vez",
        "PASS"
        if success == 2 and conflicts == 0 and events == "1" and status == "confirmed"
        else "FAIL",
        f"exitos={success} conflictos_PT409={conflicts} eventos={events} estado={status}",
    )

    # CON-03 · Carrera entre bloqueo de agenda y reserva del mismo horario.
    block = f"""
        insert into public.physician_schedule_blocks (
          physician_id, starts_at, ends_at, reason
        ) values (
          '{PHYSICIAN_ID}',
          '2035-09-07T10:00:00Z', '2035-09-07T11:00:00Z',
          'Bloqueo concurrente'
        );
    """
    reserve = f"""
        insert into public.appointments (
          patient_id, physician_id, starts_at, duration_minutes, reason
        ) values (
          '{PATIENT_ID}', '{PHYSICIAN_ID}',
          '2035-09-07T10:00:00Z', 30, 'Reserva contra bloqueo'
        );
    """
    results = concurrent_psql(
        database,
        [source(receptionist_claims(), block), source(receptionist_claims(), reserve)],
    )
    success = sum(1 for item in results if item.returncode == 0)
    rejected = sum(
        1
        for item in results
        if item.returncode != 0
        and ("23P01" in item.stderr or "23P01" in item.stdout)
    )
    objects = scalar(
        database,
        """
        select (
          (select count(*) from public.appointments
            where starts_at = '2035-09-07T10:00:00Z'::timestamptz
              and status <> 'cancelled')
          + (select count(*) from public.physician_schedule_blocks
             where starts_at = '2035-09-07T10:00:00Z'::timestamptz)
        )::text;
        """,
    )
    add_case(
        "CON-03",
        module,
        "Bloqueo y reserva simultáneos no pueden coexistir en el mismo horario",
        "PASS" if success == 1 and rejected == 1 and objects == "1" else "FAIL",
        f"exitos={success} rechazos={rejected} objetos={objects}",
    )

    # CON-04 · Dos cancelaciones simultáneas con la misma versión.
    expected_cancel = scalar(
        database,
        """
        select updated_at from public.appointments
        where id = '7e000000-0000-4000-8000-000000000402';
        """,
    )
    cancel_a = f"""
        select public.cancel_appointment(
          '7e000000-0000-4000-8000-000000000402',
          '{expected_cancel}'::timestamptz,
          'Motivo concurrente A'
        );
    """
    cancel_b = f"""
        select public.cancel_appointment(
          '7e000000-0000-4000-8000-000000000402',
          '{expected_cancel}'::timestamptz,
          'Motivo concurrente B'
        );
    """
    results = concurrent_psql(
        database,
        [source(admin_claims(), cancel_a), source(admin_claims(), cancel_b)],
    )
    success = sum(1 for item in results if item.returncode == 0)
    events = scalar(
        database,
        """
        select count(*) from public.appointment_events
        where appointment_id = '7e000000-0000-4000-8000-000000000402'
          and event_type = 'cancelled';
        """,
    )
    state = scalar(
        database,
        """
        select status || '|' || coalesce(cancellation_reason, '')
        from public.appointments
        where id = '7e000000-0000-4000-8000-000000000402';
        """,
    )
    valid_reason = state in (
        "cancelled|Motivo concurrente A",
        "cancelled|Motivo concurrente B",
    )
    add_case(
        "CON-04",
        module,
        "Dos cancelaciones simultáneas no duplican auditoría ni el motivo",
        "PASS" if success == 2 and events == "1" and valid_reason else "FAIL",
        f"exitos={success} eventos={events} estado={state}",
    )

    # CON-05 · Dos reprogramaciones simultáneas al mismo horario libre.
    expected_a = scalar(
        database,
        """
        select updated_at from public.appointments
        where id = '7e000000-0000-4000-8000-000000000403';
        """,
    )
    expected_b = scalar(
        database,
        """
        select updated_at from public.appointments
        where id = '7e000000-0000-4000-8000-000000000404';
        """,
    )
    move_a = f"""
        select public.reschedule_appointment(
          '7e000000-0000-4000-8000-000000000403',
          '{expected_a}'::timestamptz,
          '2035-09-05T09:00:00Z'::timestamptz,
          30::smallint
        );
    """
    move_b = f"""
        select public.reschedule_appointment(
          '7e000000-0000-4000-8000-000000000404',
          '{expected_b}'::timestamptz,
          '2035-09-05T09:00:00Z'::timestamptz,
          30::smallint
        );
    """
    results = concurrent_psql(
        database,
        [source(admin_claims(), move_a), source(admin_claims(), move_b)],
    )
    success = sum(1 for item in results if item.returncode == 0)
    rejected = sum(
        1
        for item in results
        if item.returncode != 0
        and ("23P01" in item.stderr or "appointments_no_overlap" in item.stderr)
    )
    rows = scalar(
        database,
        """
        select count(*) from public.appointments
        where starts_at = '2035-09-05T09:00:00Z'::timestamptz
          and status <> 'cancelled';
        """,
    )
    add_case(
        "CON-05",
        module,
        "Dos reprogramaciones simultáneas al mismo horario: solo una ocupa el espacio",
        "PASS" if success == 1 and rejected == 1 and rows == "1" else "FAIL",
        f"exitos={success} rechazos={rejected} filas={rows}",
    )

    # CON-06 · Reservas simultáneas no superpuestas: ambas deben aceptarse.
    insert_a = f"""
        insert into public.appointments (
          patient_id, physician_id, starts_at, duration_minutes, reason
        ) values (
          '{PATIENT_ID}', '{PHYSICIAN_ID}',
          '2035-09-08T09:00:00Z', 30, 'Paralela no superpuesta A'
        );
    """
    insert_b = f"""
        insert into public.appointments (
          patient_id, physician_id, starts_at, duration_minutes, reason
        ) values (
          '{PATIENT_ID}', '{PHYSICIAN_ID}',
          '2035-09-08T10:00:00Z', 30, 'Paralela no superpuesta B'
        );
    """
    results = concurrent_psql(
        database,
        [source(receptionist_claims(), insert_a), source(receptionist_claims(), insert_b)],
    )
    success = sum(1 for item in results if item.returncode == 0)
    rows = scalar(
        database,
        """
        select count(*) from public.appointments
        where starts_at in (
          '2035-09-08T09:00:00Z'::timestamptz,
          '2035-09-08T10:00:00Z'::timestamptz
        );
        """,
    )
    add_case(
        "CON-06",
        module,
        "Dos reservas simultáneas no superpuestas se aceptan sin bloquear de más",
        "PASS" if success == 2 and rows == "2" else "FAIL",
        f"exitos={success} filas={rows}",
    )


ADJUSTMENTS = {
    "CON-02": (
        "Migración 202611250001: la confirmación idempotente se resuelve antes "
        "de comparar la versión; no se escribe la fila."
    ),
    "SEC-52": (
        "Se ajustó la expectativa de la prueba a los dos bloqueos propios del "
        "médico; el esquema y las políticas no cambiaron."
    ),
}


def write_evidence(environment: dict, migrations: list[dict]) -> dict:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    summary = {
        "total": len(RESULTS),
        "pass": sum(1 for case in RESULTS if case["status"] == "PASS"),
        "fail": sum(1 for case in RESULTS if case["status"] == "FAIL"),
        "blocked": sum(1 for case in RESULTS if case["status"] == "BLOCKED"),
        "not_run": sum(1 for case in RESULTS if case["status"] == "NOT RUN"),
    }
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "commands": [
            f"{ENGINE} run -d --rm --name {NAME} --network none "
            "-e POSTGRES_HOST_AUTH_METHOD=trust " + IMAGE,
            "psql -X -q -A -t -v ON_ERROR_STOP=1 (migraciones y suites)",
            f"python scripts/pry07/verify-integrity-security.py",
        ],
        "environment": environment,
        "migrations": migrations,
        "skipped_migrations": sorted(SKIP_MIGRATIONS),
        "summary": summary,
        "cases": sorted(RESULTS, key=lambda case: (case["module"], case["id"])),
        "notes": [
            "Los JWT se simulan con request.jwt.claims y SET ROLE.",
            "No se usó GoTrue, PostgREST, Supabase remoto ni datos reales.",
            "El contenedor y sus datos son desechables.",
        ],
    }
    (EVIDENCE / "resultados.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (EVIDENCE / "verify-integrity-security.log").write_text(
        "\n".join(LOG) + "\n", encoding="utf-8"
    )
    lines = [
        "# PRY07 · Resultados de integridad y seguridad (Emilio)",
        "",
        f"Generado: {report['generated_at']}",
        "",
        "| Métrica | Cantidad |",
        "| --- | --- |",
        f"| Casos registrados | {summary['total']} |",
        f"| PASS | {summary['pass']} |",
        f"| FAIL | {summary['fail']} |",
        f"| BLOCKED | {summary['blocked']} |",
        f"| NOT RUN | {summary['not_run']} |",
        "",
        "| ID | Módulo | Acción y resultado esperado | Resultado observado | Estado | Evidencia | Ajuste |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for case in report["cases"]:
        detail = (case["detail"] or "").replace("|", "/").replace("\n", " ")
        adjustment = ADJUSTMENTS.get(case["id"], "")
        lines.append(
            f"| {case['id']} | {case['module']} | {case['description']} | "
            f"{detail} | {case['status']} | resultados.json#{case['id']} | "
            f"{adjustment} |"
        )
    (EVIDENCE / "resultados.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return summary


def main() -> int:
    started = datetime.now(timezone.utc)
    log("# PRY07 · Emilio Martínez · verificación de integridad y seguridad")
    log(f"# Inicio: {started.isoformat()}")
    cleanup_done = False
    try:
        start_container()
        migrations = apply_migrations()
        for key, filename, module in SUITES:
            run_sql_suite(key, filename, module)
        persistence_cases()
        concurrency_cases()
        for case_id, module, description, detail in BLOCKED_CASES:
            add_case(case_id, module, description, "BLOCKED", detail)

        docker_version = scalar(
            "postgres",
            "select current_setting('server_version') || '|' || version();",
        )
        image_id = command(
            [ENGINE, "image", "inspect", IMAGE, "--format", "{{.Id}}"]
        ).stdout.strip()
        environment = {
            "python": platform.python_version(),
            "platform": platform.platform(),
            "engine": ENGINE,
            "engine_version": command([ENGINE, "--version"]).stdout.strip(),
            "image": IMAGE,
            "image_id": image_id,
            "container": NAME,
            "postgres": docker_version,
            "auth": "JWT simulado con request.jwt.claims y SET ROLE",
        }
        summary = write_evidence(environment, migrations)
        log("")
        log(
            "RESUMEN "
            f"total={summary['total']} pass={summary['pass']} "
            f"fail={summary['fail']} blocked={summary['blocked']} "
            f"not_run={summary['not_run']}"
        )
        log(f"Evidencia: {EVIDENCE}")
        return 0 if summary["fail"] == 0 else 1
    finally:
        if not cleanup_done:
            cleanup = command([ENGINE, "rm", "-f", NAME], timeout=60)
            log(f"# Limpieza del contenedor {NAME}: {cleanup.returncode}")
            cleanup_done = True
        finished = datetime.now(timezone.utc)
        log(f"# Fin: {finished.isoformat()}")


if __name__ == "__main__":
    sys.exit(main())
