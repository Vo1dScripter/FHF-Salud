#!/usr/bin/env python3
"""Run browser tests against a disposable loopback-only Auth and PostgreSQL stack."""

import base64
from contextlib import ExitStack
import fcntl
import hashlib
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
ENGINE = os.getenv("CONTAINER_ENGINE", "podman")
IMAGES = {
    "db": "docker.io/library/postgres:17-alpine",
    "auth": "docker.io/supabase/gotrue:v2.177.0",
    "rest": "docker.io/postgrest/postgrest:v13.0.4",
}
INFRASTRUCTURE = "202610250001_reminder_infrastructure.sql"
CLINICAL_WIDTHS = ("1440", "390")


def container(*args, source=None):
    result = subprocess.run(
        [ENGINE, *args], input=source, text=True, encoding="utf-8",
        capture_output=True, timeout=300,
    )
    if result.returncode:
        raise RuntimeError(f"El motor falló en {args[0]} (código {result.returncode}).")
    return result.stdout.strip()


def cleanup(*args):
    for _ in range(3):
        result = subprocess.run(
            [ENGINE, *args], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            timeout=30,
        )
        if result.returncode == 0:
            return
        time.sleep(1)
    raise RuntimeError(f"No se pudo limpiar el recurso efímero {args[-1]}.")


def launch(stack, network, names, service, environment, port=None):
    name = names[service]
    args = ["run", "-d", "--name", name, "--network", network, "--network-alias", service]
    for key in environment:
        args.extend(["-e", key])
    if port:
        args.extend(["-p", f"127.0.0.1::{port}"])
    # Pass ephemeral credentials by environment without printing commands or logs.
    result = subprocess.run(
        [ENGINE, *args, IMAGES[service]], env={**os.environ, **environment},
        capture_output=True, timeout=300,
    )
    if result.returncode:
        raise RuntimeError(f"No arrancó {service} (código {result.returncode}).")
    stack.callback(cleanup, "rm", "-f", "-v", name)
    if port:
        mapping = container("port", name, f"{port}/tcp")
        return int(mapping.rsplit(":", 1)[-1])


def wait_for(label, check, process=None, timeout=60):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process is not None and process.poll() is not None:
            raise RuntimeError(f"{label} se cerró antes de estar disponible.")
        if check():
            return
        time.sleep(0.25)
    raise RuntimeError(f"{label} no respondió en {timeout} segundos.")


def ready(url):
    try:
        with urlopen(url, timeout=2) as reply:
            return reply.status == 200
    except (URLError, OSError):
        return False


def jwt(claims, secret):
    def encode(value):
        return base64.urlsafe_b64encode(value).rstrip(b"=").decode()

    header = encode(b'{"alg":"HS256","typ":"JWT"}')
    payload = encode(json.dumps(claims, separators=(",", ":")).encode())
    body = f"{header}.{payload}"
    return f"{body}.{encode(hmac.digest(secret.encode(), body.encode(), hashlib.sha256))}"


def sign(role, secret):
    return jwt({"role": role, "exp": int(time.time()) + 3600}, secret)


def expired_session(account, physician_id, secret, now):
    """Sesión ficticia vencida: JWT caducado y refresh token inválido."""
    metadata = {
        "appointment_role": "physician",
        "physician_id": str(physician_id),
    }
    token = jwt(
        {
            "aud": "authenticated",
            "app_metadata": metadata,
            "email": account["email"],
            "exp": now - 3600,
            "iat": now - 7200,
            "role": "authenticated",
            "session_id": str(uuid4()),
            "sub": account["id"],
            "user_metadata": {},
        },
        secret,
    )
    return {
        "access_token": token,
        "expires_at": now - 3600,
        "expires_in": 3600,
        "refresh_token": "invalid-" + secrets.token_hex(16),
        "token_type": "bearer",
        "user": {
            "app_metadata": metadata,
            "aud": "authenticated",
            "created_at": account.get("createdAt", ""),
            "email": account["email"],
            "id": account["id"],
            "role": "authenticated",
            "user_metadata": {},
        },
    }


def session_cookie(host, session):
    """Codifica la sesión con el mismo formato base64url de @supabase/ssr."""
    encoded = base64.urlsafe_b64encode(
        json.dumps(session, separators=(",", ":")).encode()
    ).rstrip(b"=").decode()
    return f"sb-{host.split('.')[0]}-auth-token", f"base64-{encoded}"


def e2e_scripts():
    selected = os.getenv("PRY07_E2E_SCRIPT")
    if selected:
        return [Path(selected).resolve()]
    return [
        ROOT / "scripts/pry07/appointments.mjs",
        ROOT / "scripts/pry07/clinical-history.mjs",
    ]


def gateway(stack, ports, anonymous, public_key):
    class Proxy(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def forward(self):
            path = self.path.split("/", 3)
            if len(path) != 4 or path[1] not in ports or path[2] != "v1":
                self.send_error(404)
                return
            headers = {
                name: value for name, value in self.headers.items()
                if name.lower() not in {
                    "connection", "host", "content-length", "accept-encoding", "origin",
                }
            }
            if self.headers.get("Authorization") == f"Bearer {public_key}":
                headers["Authorization"] = f"Bearer {anonymous}"
            length = int(self.headers.get("Content-Length", "0"))
            request = Request(
                f"http://127.0.0.1:{ports[path[1]]}/{path[3]}",
                data=self.rfile.read(length) if length else None,
                headers=headers, method=self.command,
            )
            try:
                reply = urlopen(request, timeout=10)
            except HTTPError as error:
                reply = error
            except (URLError, OSError):
                self.send_error(502)
                return
            with reply:
                body = reply.read()
                self.send_response(reply.status)
                for name, value in reply.headers.items():
                    if name.lower() not in {"connection", "content-length", "transfer-encoding"}:
                        self.send_header(name, value)
                self.cors()
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

        def cors(self):
            origin = self.headers.get("Origin", "")
            if origin == app_origin:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
                self.send_header(
                    "Access-Control-Allow-Headers",
                    self.headers.get("Access-Control-Request-Headers", "*"),
                )
                self.send_header("Access-Control-Expose-Headers", "Content-Range")
                self.send_header("Vary", "Origin")

        def do_OPTIONS(self):
            self.send_response(204)
            self.cors()
            self.end_headers()

        do_GET = do_POST = do_PATCH = do_DELETE = forward

    app_origin = ""
    server = ThreadingHTTPServer(("127.0.0.1", 0), Proxy)
    stack.callback(server.server_close)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    stack.callback(server.shutdown)

    def allow_origin(value):
        nonlocal app_origin
        app_origin = value

    return f"http://127.0.0.1:{server.server_port}", allow_origin


def seed_account(auth_port, admin, sql, role, physician_id, label=None):
    account = {"email": f"{label or role}@example.com", "password": secrets.token_hex(24)}
    metadata = {"appointment_role": role} if role != "unassigned" else {}
    if role == "physician":
        metadata["physician_id"] = str(physician_id)
    request = Request(
        f"http://127.0.0.1:{auth_port}/admin/users",
        data=json.dumps({**account, "email_confirm": True, "app_metadata": metadata}).encode(),
        headers={"Authorization": f"Bearer {admin}", "Content-Type": "application/json"},
    )
    try:
        with urlopen(request, timeout=10) as reply:
            created = json.loads(reply.read())
    except (URLError, OSError):
        raise RuntimeError(f"Auth rechazó la cuenta de prueba {role}.") from None
    account["id"] = created["id"]
    account["createdAt"] = created.get("created_at", "")
    # Standalone GoTrue does not populate the PostgREST role automatically.
    sql(f"update auth.users set role = 'authenticated' where email = '{account['email']}';")
    return account


def verify_clinical(sql, fixtures):
    """Comprueba en PostgreSQL el resultado real del escenario clínico."""

    def value(statement):
        return sql(statement).strip()

    def expect(actual, expected, label):
        if actual != expected:
            raise RuntimeError(f"Verificación clínica falló: {label}.")
        return actual

    physician_id = fixtures["physicianId"]
    physician_user_id = fixtures["accounts"]["physician"]["id"]
    physician_b_id = fixtures["physicianBId"]
    for width in CLINICAL_WIDTHS:
        clinical = fixtures["clinical"][width]
        patient_id = clinical["patientId"]
        record = value(
            f"select id, current_revision from public.clinical_records "
            f"where patient_id = '{patient_id}';"
        )
        if not record:
            raise RuntimeError(f"Verificación clínica falló: falta el expediente {width}.")
        record_id, current_revision = record.split("|")
        expect(int(current_revision), 4, f"revisión vigente {width}")
        revisions = value(
            f"select count(*), count(distinct revision_number), "
            f"min(revision_number), max(revision_number), "
            f"count(distinct author_physician_id), "
            f"min(author_physician_id::text), min(author_user_id::text) "
            f"from public.clinical_record_revisions where record_id = '{record_id}';"
        ).split("|")
        expect(int(revisions[0]), 4, f"total de revisiones {width}")
        expect(int(revisions[1]), 4, f"números de revisión únicos {width}")
        expect(int(revisions[2]), 1, f"primera revisión {width}")
        expect(int(revisions[3]), 4, f"última revisión {width}")
        expect(int(revisions[4]), 1, f"autor único {width}")
        expect(revisions[5], physician_id, f"médico autor {width}")
        expect(revisions[6], physician_user_id, f"usuario autor {width}")
        expect(
            int(value(
                f"select count(*) from public.patient_physicians "
                f"where patient_id = '{patient_id}' and physician_id = '{physician_id}';"
            )),
            1,
            f"vínculo del médico autorizado {width}",
        )
        expect(
            int(value(
                f"select count(*) from public.patient_physicians "
                f"where patient_id = '{patient_id}' and physician_id = '{physician_b_id}';"
            )),
            0,
            f"vínculo del médico sin acceso {width}",
        )
        expect(
            int(value(
                f"select count(*) from public.clinical_records "
                f"where patient_id = '{patient_id}';"
            )),
            1,
            f"expediente único {width}",
        )
        expect(
            int(value(
                f"select count(*) from public.clinical_record_revisions "
                f"where record_id = '{record_id}' and (coalesce(background,'') "
                f"|| coalesce(allergies,'') || coalesce(diagnosis,'') "
                f"|| coalesce(treatment,'') || coalesce(change_reason,'')) "
                f"like '%DENEGADO%';"
            )),
            0,
            f"escrituras denegadas ausentes {width}",
        )
        texts = clinical["texts"]
        expect(
            int(value(
                f"select count(*) from public.clinical_record_revisions "
                f"where record_id = '{record_id}' "
                f"and diagnosis = '{texts['stale']['diagnosis']}';"
            )),
            0,
            f"intento obsoleto no persistido ({width})",
        )
        for number, stage in ((1, "first"), (2, "second"), (3, "concurrent"), (4, "final")):
            expect(
                value(
                    f"select coalesce(diagnosis,'') from public.clinical_record_revisions "
                    f"where record_id = '{record_id}' and revision_number = {number};"
                ),
                texts[stage]["diagnosis"],
                f"diagnóstico de la revisión {number} ({width})",
            )
        for number, status in ((1, "reported"), (2, "none_reported"), (3, "not_recorded"), (4, "reported")):
            expect(
                value(
                    f"select allergies_status from public.clinical_record_revisions "
                    f"where record_id = '{record_id}' and revision_number = {number};"
                ),
                status,
                f"estado de alergias de la revisión {number} ({width})",
            )
        expect(
            value(
                f"select coalesce(change_reason,'') from public.clinical_record_revisions "
                f"where record_id = '{record_id}' and revision_number = 1;"
            ),
            "",
            f"motivo vacío de la primera revisión ({width})",
        )
        expect(
            value(
                f"select coalesce(change_reason,'') from public.clinical_record_revisions "
                f"where record_id = '{record_id}' and revision_number = 3;"
            ),
            texts["concurrent"]["changeReason"],
            f"motivo de la revisión concurrente ({width})",
        )
        expect(
            value(
                f"select coalesce(allergies,'') from public.clinical_record_revisions "
                f"where record_id = '{record_id}' and revision_number = 4;"
            ),
            texts["final"]["allergies"],
            f"alergias de la revisión final ({width})",
        )
        expect(
            int(value(
                f"select count(*) from public.clinical_record_revisions "
                f"where record_id = '{record_id}' and revision_number > 1 "
                f"and change_reason is null;"
            )),
            0,
            f"motivos obligatorios ({width})",
        )
        expect(
            int(value(
                f"select count(*) from public.clinical_record_revisions "
                f"where record_id = '{record_id}' "
                f"and created_at > now() - interval '1 hour';"
            )),
            4,
            f"fechas del servidor ({width})",
        )
    missing = fixtures["nonexistentPatientId"]
    expect(
        int(value(
            f"select count(*) from public.clinical_records where patient_id = '{missing}';"
        )),
        0,
        "expediente inexistente no creado",
    )
    expect(
        int(value(
            f"select count(*) from public.patient_physicians where patient_id = '{missing}';"
        )),
        0,
        "vínculo inexistente no creado",
    )
    print(
        "SQL: PASS; expedientes, cuatro revisiones inmutables por paciente, "
        "autoría, fechas, vínculos y ausencia de escrituras denegadas verificados.",
        flush=True,
    )


def stop(process):
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


def run():
    output = Path(os.environ["PRY07_E2E_OUTPUT"]).resolve()
    output.mkdir(parents=True, exist_ok=False)
    with ExitStack() as outer:
        lock_dir = subprocess.check_output(
            ["git", "rev-parse", "--absolute-git-dir"], cwd=ROOT, text=True
        ).strip()
        lock = outer.enter_context((Path(lock_dir) / "pry07-e2e.lock").open("a"))
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with ExitStack() as stack:
            network = f"fhf-pry07-{uuid4().hex[:12]}"
            names = {name: f"{network}-{name}" for name in IMAGES}
            scratch = Path(stack.enter_context(tempfile.TemporaryDirectory(prefix="fhf-pry07-")))
            db_password = secrets.token_hex(20)
            rest_password = secrets.token_hex(20)
            jwt_secret = secrets.token_hex(32)
            public_key = "sb_publishable_" + secrets.token_hex(24)
            container("network", "create", network)
            stack.callback(cleanup, "network", "rm", network)
            launch(stack, network, names, "db", {"POSTGRES_PASSWORD": db_password})

            def db_ready():
                try:
                    return subprocess.run(
                        [ENGINE, "exec", names["db"], "pg_isready", "-h", "127.0.0.1", "-U", "postgres"],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10,
                    ).returncode == 0
                except subprocess.TimeoutExpired:
                    return False

            def sql(statement):
                return container(
                    "exec", "-i", names["db"], "psql", "-U", "postgres",
                    "-v", "ON_ERROR_STOP=1", "-At", source=statement,
                )

            wait_for("PostgreSQL", db_ready)
            sql((ROOT / "scripts/tar05/auth-bootstrap.sql").read_text())
            sql(f"create role authenticator noinherit login password '{rest_password}';"
                " grant anon, authenticated to authenticator;")
            migrations = sorted((ROOT / "supabase/migrations").glob("*.sql"))
            for migration in migrations:
                if migration.name != INFRASTRUCTURE:
                    sql("begin;\n" + migration.read_text() + "\ncommit;")
            print(f"POSTGRESQL: {len(migrations) - 1} migraciones aplicadas; omitida {INFRASTRUCTURE}", flush=True)

            auth = launch(stack, network, names, "auth", {
                "GOTRUE_API_HOST": "0.0.0.0", "GOTRUE_API_PORT": "9999",
                "API_EXTERNAL_URL": "http://127.0.0.1",
                "GOTRUE_DB_DRIVER": "postgres", "GOTRUE_DB_DATABASE_URL":
                    f"postgres://postgres:{db_password}@db:5432/postgres?sslmode=disable&search_path=auth",
                "GOTRUE_SITE_URL": "http://127.0.0.1", "GOTRUE_EXTERNAL_EMAIL_ENABLED": "true",
                "GOTRUE_JWT_SECRET": jwt_secret, "GOTRUE_JWT_ADMIN_ROLES": "service_role",
            }, 9999)
            rest = launch(stack, network, names, "rest", {
                "PGRST_DB_URI": f"postgres://authenticator:{rest_password}@db:5432/postgres",
                "PGRST_DB_SCHEMAS": "public", "PGRST_DB_ANON_ROLE": "anon",
                "PGRST_JWT_SECRET": jwt_secret,
            }, 3000)
            wait_for("Auth", lambda: ready(f"http://127.0.0.1:{auth}/health"))
            wait_for("PostgREST", lambda: ready(f"http://127.0.0.1:{rest}/"))
            patient_id, physician_id, physician_b_id = uuid4(), uuid4(), uuid4()
            clinical_ids = {width: uuid4() for width in CLINICAL_WIDTHS}
            nonexistent_patient_id = uuid4()
            clinical_names = {
                "1440": "Paciente Ficticio Historial 1440",
                "390": "Paciente Ficticio Historial 390",
            }
            sql(
                f"insert into public.patients(id,display_name,birth_date,sex,phone) values "
                f"('{patient_id}','Paciente ficticio PRY07',null,null,null),"
                f"('{clinical_ids['1440']}','{clinical_names['1440']}','1988-04-12','female','5550001440'),"
                f"('{clinical_ids['390']}','{clinical_names['390']}','1990-09-23','male','5550000390');"
                f"insert into public.physicians(id,display_name) values "
                f"('{physician_id}','Médico ficticio PRY07'),"
                f"('{physician_b_id}','Médica ficticia sin vínculo PRY07');"
            )
            admin = sign("service_role", jwt_secret)
            accounts = {
                "receptionist": seed_account(auth, admin, sql, "receptionist", physician_id),
                "physician": seed_account(auth, admin, sql, "physician", physician_id),
                "physicianB": seed_account(
                    auth, admin, sql, "physician", physician_b_id, "physician-b"
                ),
                "unassigned": seed_account(auth, admin, sql, "unassigned", physician_id),
            }
            print("AUTH: PASS; cuatro cuentas ficticias preparadas.", flush=True)
            sql(
                f"insert into public.patient_physicians(patient_id,physician_id,created_by) values "
                f"('{clinical_ids['1440']}','{physician_id}','{accounts['physician']['id']}'),"
                f"('{clinical_ids['390']}','{physician_id}','{accounts['physician']['id']}');"
                f"insert into public.appointments(patient_id,physician_id,starts_at,duration_minutes,reason,status) values "
                f"('{clinical_ids['1440']}','{physician_id}','2035-09-10T09:00:00Z',30,'Cita ficticia E2E historial 1440','confirmed'),"
                f"('{clinical_ids['390']}','{physician_id}','2035-09-11T09:00:00Z',30,'Cita ficticia E2E historial 390','confirmed'),"
                f"('{clinical_ids['1440']}','{physician_b_id}','2035-09-10T10:00:00Z',30,'Cita ficticia cancelada sin vínculo','cancelled');"
            )
            clinical_texts = {}
            for width in CLINICAL_WIDTHS:
                clinical_texts[width] = {
                    "first": {
                        "allergies": f"Alergia ficticia inicial {width}",
                        "allergiesStatus": "reported",
                        "background": f"Antecedentes ficticios iniciales {width}",
                        "diagnosis": f"Diagnóstico ficticio inicial {width}",
                        "treatment": f"Tratamiento ficticio inicial {width}",
                    },
                    "second": {
                        "allergies": None,
                        "allergiesStatus": "none_reported",
                        "background": f"Antecedentes ficticios revisados {width}",
                        "changeReason": f"Motivo ficticio de la segunda revisión {width}",
                        "diagnosis": f"Diagnóstico ficticio revisado {width}",
                        "treatment": f"Tratamiento ficticio revisado {width}",
                    },
                    "concurrent": {
                        "allergies": None,
                        "allergiesStatus": "not_recorded",
                        "background": f"Antecedentes ficticios concurrentes {width}",
                        "changeReason": f"Actualización concurrente ficticia {width}",
                        "diagnosis": f"Diagnóstico ficticio concurrente {width}",
                        "treatment": f"Tratamiento ficticio concurrente {width}",
                    },
                    "stale": {
                        "allergies": None,
                        "allergiesStatus": "none_reported",
                        "background": f"Antecedentes ficticios obsoletos {width}",
                        "changeReason": f"Intento obsoleto ficticio {width}",
                        "diagnosis": f"Diagnóstico ficticio obsoleto {width}",
                        "treatment": f"Tratamiento ficticio obsoleto {width}",
                    },
                    "final": {
                        "allergies": f"Alergia ficticia final {width}",
                        "allergiesStatus": "reported",
                        "background": f"Antecedentes ficticios finales {width}",
                        "changeReason": f"Motivo ficticio de la revisión final {width}",
                        "diagnosis": f"Diagnóstico ficticio final {width}",
                        "treatment": f"Tratamiento ficticio final {width}",
                    },
                }
            api, allow_origin = gateway(stack, {"auth": auth, "rest": rest}, sign("anon", jwt_secret), public_key)
            now = int(time.time())
            cookie_name, cookie_value = session_cookie(
                urlparse(api).hostname or "127.0.0.1",
                expired_session(accounts["physician"], physician_id, jwt_secret, now),
            )
            fixtures = {
                "accounts": accounts,
                "clinical": {
                    width: {
                        "patientId": str(clinical_ids[width]),
                        "patientName": clinical_names[width],
                        "texts": clinical_texts[width],
                    }
                    for width in CLINICAL_WIDTHS
                },
                "expiredSession": {"name": cookie_name, "value": cookie_value},
                "nonexistentPatientId": str(nonexistent_patient_id),
                "patientId": str(patient_id),
                "physicianBId": str(physician_b_id),
                "physicianId": str(physician_id),
            }
            with open(scratch / "fixtures.json", "w", encoding="utf-8", opener=lambda p, flags: os.open(p, flags, 0o600)) as fixture_file:
                json.dump(fixtures, fixture_file)
            env = {
                **os.environ, "NEXT_PUBLIC_SUPABASE_URL": api,
                "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": public_key,
                "NEXT_PUBLIC_VAPID_PUBLIC_KEY": "", "NEXT_TELEMETRY_DISABLED": "1",
                "PRY07_FIXTURES": str(scratch / "fixtures.json"),
                "PRY07_E2E_OUTPUT": str(output),
            }
            print("BUILD: iniciando compilación local.", flush=True)
            with (scratch / "build.log").open("w", encoding="utf-8") as build_log:
                result = subprocess.run(["npm", "run", "build"], cwd=ROOT, env=env, stdout=build_log,
                                        stderr=subprocess.STDOUT, timeout=300)
            if result.returncode:
                print(f"BUILD: FAIL (código {result.returncode}).", flush=True)
                raise RuntimeError("Falló la compilación local. Ejecuta npm run build para diagnosticar.")
            print("BUILD: PASS", flush=True)
            with socket.socket() as reservation:
                reservation.bind(("127.0.0.1", 0))
                port = reservation.getsockname()[1]
            app = f"http://127.0.0.1:{port}"
            allow_origin(app)
            app_log = stack.enter_context((scratch / "app.log").open("w", encoding="utf-8"))
            process = subprocess.Popen(
                ["node", "node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", str(port)],
                cwd=ROOT, env=env, stdout=app_log, stderr=subprocess.STDOUT,
            )
            stack.callback(stop, process)
            wait_for("Aplicación", lambda: ready(app + "/citas/acceso"), process)
            for test in e2e_scripts():
                if not test.is_relative_to(ROOT) or not test.is_file():
                    raise RuntimeError("El escenario E2E debe ser un archivo de esta copia local.")
                print(f"E2E: ejecutando {test.name}", flush=True)
                subprocess.run(["node", str(test)], cwd=ROOT, env={**env, "PRY07_BASE_URL": app},
                               check=True, timeout=300)
            verify_clinical(sql, fixtures)
        print("CLEANUP: PASS; aplicación, contenedores, red y credenciales efímeras retirados.", flush=True)


if __name__ == "__main__":
    try:
        run()
    except (KeyError, OSError, RuntimeError, subprocess.SubprocessError) as error:
        # Container and browser output may include credentials; report only safe context.
        message = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        print(f"PRY07: ejecución fallida ({message}).", file=sys.stderr)
        sys.exit(1)
