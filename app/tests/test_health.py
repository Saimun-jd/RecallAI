"""
Tests for Health Check Endpoints and Security Headers Middleware.
"""

import os
import tempfile
import unittest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import set_db_path
from app.models.schema_init import init_foundation_db


class TestHealthAndSecurityHeaders(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db_path = self.temp_db.name
        self.temp_db.close()

        set_db_path(self.temp_db_path)
        init_foundation_db(self.temp_db_path)

        self.client = TestClient(app)

    def tearDown(self):
        try:
            if os.path.exists(self.temp_db_path):
                os.remove(self.temp_db_path)
        except Exception:
            pass

    def test_liveness_probe(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertEqual(data["status"], "ok")
        self.assertIn("environment", data)

    def test_readiness_probe(self):
        res = self.client.get("/health/db")
        self.assertEqual(res.status_code, 200)
        data = res.json()["data"]
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["database"], "connected")

    def test_security_headers_injected(self):
        res = self.client.get("/health")
        self.assertEqual(res.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(res.headers.get("X-Frame-Options"), "DENY")
        self.assertEqual(res.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin")


if __name__ == "__main__":
    unittest.main()
