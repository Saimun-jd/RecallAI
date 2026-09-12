"""
Integration Tests for Authentication Endpoints.
Uses FastAPI TestClient and an isolated test database.
"""

import os
import tempfile
import unittest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import set_db_path
from app.models.schema_init import init_foundation_db


class TestAuthAPI(unittest.TestCase):
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

    def test_signup_flow(self):
        payload = {
            "email": "scholar@example.com",
            "password": "Password123!",
            "full_name": "Marie Curie"
        }
        res = self.client.post("/api/v1/auth/signup", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()["data"]

        self.assertIn("access_token", data)
        self.assertEqual(data["token_type"], "bearer")
        self.assertEqual(data["user"]["email"], "scholar@example.com")
        self.assertEqual(data["user"]["full_name"], "Marie Curie")
        self.assertIsNotNone(data["workspace"]["id"])

    def test_duplicate_signup_conflict(self):
        payload = {
            "email": "duplicate@example.com",
            "password": "Password123!"
        }
        res1 = self.client.post("/api/v1/auth/signup", json=payload)
        self.assertEqual(res1.status_code, 201)

        # Attempt to signup again with same email
        res2 = self.client.post("/api/v1/auth/signup", json=payload)
        self.assertEqual(res2.status_code, 409)
        error = res2.json()["error"]
        self.assertEqual(error["code"], "CONFLICT")

    def test_login_flow(self):
        signup_payload = {
            "email": "login-test@example.com",
            "password": "CorrectPassword123!"
        }
        self.client.post("/api/v1/auth/signup", json=signup_payload)

        # Successful login
        login_res = self.client.post("/api/v1/auth/login", json=signup_payload)
        self.assertEqual(login_res.status_code, 200)
        data = login_res.json()["data"]
        self.assertIn("access_token", data)
        self.assertEqual(data["user"]["email"], "login-test@example.com")

        # Wrong password
        wrong_pwd_res = self.client.post("/api/v1/auth/login", json={
            "email": "login-test@example.com",
            "password": "WrongPassword!"
        })
        self.assertEqual(wrong_pwd_res.status_code, 401)
        self.assertEqual(wrong_pwd_res.json()["error"]["code"], "UNAUTHENTICATED")

        # Nonexistent user
        nonexistent_res = self.client.post("/api/v1/auth/login", json={
            "email": "nobody@example.com",
            "password": "Password123!"
        })
        self.assertEqual(nonexistent_res.status_code, 401)
        self.assertEqual(nonexistent_res.json()["error"]["code"], "UNAUTHENTICATED")

    def test_get_me_with_and_without_token(self):
        signup_payload = {
            "email": "profile@example.com",
            "password": "Password123!",
            "full_name": "Isaac Newton"
        }
        signup_res = self.client.post("/api/v1/auth/signup", json=signup_payload)
        token = signup_res.json()["data"]["access_token"]

        # Call /me with valid Bearer token
        headers = {"Authorization": f"Bearer {token}"}
        me_res = self.client.get("/api/v1/auth/me", headers=headers)
        self.assertEqual(me_res.status_code, 200)
        me_data = me_res.json()["data"]
        self.assertEqual(me_data["user"]["email"], "profile@example.com")
        self.assertIsNotNone(me_data["workspace"]["id"])

        # Call /me with missing token
        no_token_res = self.client.get("/api/v1/auth/me")
        self.assertEqual(no_token_res.status_code, 401)
        self.assertEqual(no_token_res.json()["error"]["code"], "UNAUTHENTICATED")

        # Call /me with forged token
        bad_token_res = self.client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid.jwt.token"})
        self.assertEqual(bad_token_res.status_code, 401)
        self.assertEqual(bad_token_res.json()["error"]["code"], "UNAUTHENTICATED")


if __name__ == "__main__":
    unittest.main()
