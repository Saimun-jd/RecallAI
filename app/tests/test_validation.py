"""
Unit & API Tests for Request Validation and Error Formatting.
"""

import os
import tempfile
import unittest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import set_db_path
from app.models.schema_init import init_foundation_db


class TestValidationAndErrors(unittest.TestCase):
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

    def test_invalid_email_format_rejected(self):
        res = self.client.post("/api/v1/auth/signup", json={
            "email": "not-an-email",
            "password": "ValidPassword123!"
        })
        self.assertEqual(res.status_code, 422)
        error = res.json()["error"]
        self.assertEqual(error["code"], "VALIDATION_ERROR")
        self.assertIsNotNone(error["details"])

    def test_short_password_rejected(self):
        res = self.client.post("/api/v1/auth/signup", json={
            "email": "valid@example.com",
            "password": "short"
        })
        self.assertEqual(res.status_code, 422)
        error = res.json()["error"]
        self.assertEqual(error["code"], "VALIDATION_ERROR")

    def test_missing_fields_rejected(self):
        # Empty body
        res = self.client.post("/api/v1/auth/signup", json={})
        self.assertEqual(res.status_code, 422)
        error = res.json()["error"]
        self.assertEqual(error["code"], "VALIDATION_ERROR")


if __name__ == "__main__":
    unittest.main()
