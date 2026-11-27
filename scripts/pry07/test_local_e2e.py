"""Regression tests for transient startup and clinical E2E helpers."""

import base64
import importlib.util
import json
from pathlib import Path
from subprocess import CompletedProcess
import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4

spec = importlib.util.spec_from_file_location(
    "local_e2e", Path(__file__).with_name("local-e2e.py")
)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class LocalE2ETest(unittest.TestCase):
    def test_wait_retries_connection_reset_during_startup(self):
        response = MagicMock()
        response.__enter__.return_value.status = 200
        with patch.object(runner, "urlopen", side_effect=[ConnectionResetError, response]) as fetch:
            with patch.object(runner.time, "sleep"):
                runner.wait_for("servicio", lambda: runner.ready("http://127.0.0.1:1234"))
        self.assertEqual(fetch.call_count, 2)

    def test_cleanup_retries_after_transient_container_failure(self):
        with patch.object(
            runner.subprocess, "run",
            side_effect=[CompletedProcess([], 1), CompletedProcess([], 0)],
        ) as run:
            with patch.object(runner.time, "sleep"):
                runner.cleanup("rm", "-f", "-v", "fhf-pry07-ficticio")
        self.assertEqual(run.call_count, 2)

    def test_e2e_scripts_defaults_to_appointments_and_clinical_history(self):
        with patch.dict(runner.os.environ, {}, clear=False):
            runner.os.environ.pop("PRY07_E2E_SCRIPT", None)
            scripts = runner.e2e_scripts()
        self.assertEqual(
            [path.name for path in scripts],
            ["appointments.mjs", "clinical-history.mjs"],
        )

    def test_e2e_scripts_honors_explicit_override(self):
        selected = runner.ROOT / "scripts/pry07/clinical-history.mjs"
        with patch.dict(
            runner.os.environ, {"PRY07_E2E_SCRIPT": str(selected)}
        ):
            scripts = runner.e2e_scripts()
        self.assertEqual(scripts, [selected.resolve()])

    def test_jwt_contains_role_and_future_expiration(self):
        token = runner.sign("anon", "secreto-ficticio")
        self.assertEqual(len(token.split(".")), 3)
        payload = token.split(".")[1]
        claims = json.loads(
            base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4))
        )
        self.assertEqual(claims["role"], "anon")
        self.assertGreater(claims["exp"], int(runner.time.time()))

    def test_expired_session_uses_past_token_and_invalid_refresh(self):
        account = {
            "id": str(uuid4()),
            "email": "medico-ficticio@example.com",
            "createdAt": "2026-01-01T00:00:00Z",
        }
        now = 1_800_000_000
        session = runner.expired_session(
            account,
            "e1000000-0000-4000-8000-000000000001",
            "secreto-ficticio",
            now,
        )
        self.assertLess(session["expires_at"], now)
        self.assertTrue(session["refresh_token"].startswith("invalid-"))
        payload = session["access_token"].split(".")[1]
        claims = json.loads(
            base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4))
        )
        self.assertEqual(claims["sub"], account["id"])
        self.assertLess(claims["exp"], now)
        self.assertEqual(
            claims["app_metadata"]["appointment_role"], "physician"
        )

    def test_session_cookie_matches_supabase_base64url_format(self):
        session = {
            "access_token": "token-ficticio",
            "user": {"id": "e1000000-0000-4000-8000-000000000001"},
        }
        name, value = runner.session_cookie("127.0.0.1", session)
        self.assertEqual(name, "sb-127-auth-token")
        self.assertTrue(value.startswith("base64-"))
        encoded = value[len("base64-"):]
        decoded = base64.urlsafe_b64decode(
            encoded + "=" * (-len(encoded) % 4)
        )
        self.assertEqual(json.loads(decoded), session)
