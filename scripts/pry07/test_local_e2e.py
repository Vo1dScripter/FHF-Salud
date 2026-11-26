"""Regression tests for transient startup and cleanup failures."""

import importlib.util
from pathlib import Path
from subprocess import CompletedProcess
import unittest
from unittest.mock import MagicMock, patch

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
