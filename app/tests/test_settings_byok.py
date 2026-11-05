"""
Integration Tests for Settings, BYOK Credentials, Preferences, and Security Endpoints.
"""

import os
import tempfile
import unittest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import set_db_path
from app.models.schema_init import init_foundation_db


class TestSettingsBYOKAPI(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db_path = self.temp_db.name
        self.temp_db.close()

        set_db_path(self.temp_db_path)
        init_foundation_db(self.temp_db_path)

        self.client = TestClient(app)

        # Create authenticated test user
        res = self.client.post("/api/v1/auth/signup", json={
            "email": "settings_user@example.com",
            "password": "Password123!",
            "full_name": "Settings Tester"
        })
        self.token = res.json()["data"]["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def tearDown(self):
        try:
            if os.path.exists(self.temp_db_path):
                os.remove(self.temp_db_path)
        except Exception:
            pass

    def test_byok_crud_flow(self):
        # 1. Initially empty
        res = self.client.get("/api/v1/account/byok/credentials", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()["data"]), 0)

        # 2. Save OpenAI credential
        raw_key = "sk-proj-1234567890abcdefghijklmnopqrstuvwxyz"
        save_res = self.client.post("/api/v1/account/byok/credentials", json={
            "provider": "openai",
            "api_key": raw_key
        }, headers=self.headers)
        self.assertEqual(save_res.status_code, 200)
        saved = save_res.json()["data"]
        self.assertEqual(saved["provider"], "openai")
        # Ensure plaintext is never exposed
        self.assertNotIn(raw_key, saved["key_hint"])
        self.assertTrue(saved["key_hint"].startswith("...") or "..." in saved["key_hint"])

        # 3. List credentials
        list_res = self.client.get("/api/v1/account/byok/credentials", headers=self.headers)
        self.assertEqual(list_res.status_code, 200)
        creds = list_res.json()["data"]
        self.assertEqual(len(creds), 1)
        self.assertEqual(creds[0]["provider"], "openai")

        # 4. Check account overview reflects configured providers
        overview_res = self.client.get("/api/v1/account/overview", headers=self.headers)
        self.assertEqual(overview_res.status_code, 200)
        byok = overview_res.json()["data"]["byok"]
        self.assertTrue(byok["enabled"])
        self.assertTrue(byok["has_configured_providers"])
        self.assertIn("openai", byok["configured_providers"])

        # 5. Delete credential
        del_res = self.client.delete("/api/v1/account/byok/credentials/openai", headers=self.headers)
        self.assertEqual(del_res.status_code, 200)
        self.assertTrue(del_res.json()["data"]["success"])

        # 6. Verify removed
        list_res2 = self.client.get("/api/v1/account/byok/credentials", headers=self.headers)
        self.assertEqual(len(list_res2.json()["data"]), 0)

        overview_res2 = self.client.get("/api/v1/account/overview", headers=self.headers)
        self.assertFalse(overview_res2.json()["data"]["byok"]["has_configured_providers"])

    def test_byok_invalid_provider(self):
        res = self.client.post("/api/v1/account/byok/credentials", json={
            "provider": "unsupported_llm",
            "api_key": "some-key"
        }, headers=self.headers)
        self.assertEqual(res.status_code, 422)

    def test_change_password_flow(self):
        # 1. Fail with incorrect current password
        res_fail = self.client.post("/api/v1/auth/change-password", json={
            "current_password": "WrongPassword!",
            "new_password": "NewValidPassword123!"
        }, headers=self.headers)
        self.assertEqual(res_fail.status_code, 401)

        # 2. Fail with too short new password
        res_short = self.client.post("/api/v1/auth/change-password", json={
            "current_password": "Password123!",
            "new_password": "short"
        }, headers=self.headers)
        self.assertEqual(res_short.status_code, 422)

        # 3. Succeed with valid current and new password
        res_ok = self.client.post("/api/v1/auth/change-password", json={
            "current_password": "Password123!",
            "new_password": "BrandNewPassword123!"
        }, headers=self.headers)
        self.assertEqual(res_ok.status_code, 200)

        # 4. Verify login with old password fails
        res_old_login = self.client.post("/api/v1/auth/login", json={
            "email": "settings_user@example.com",
            "password": "Password123!"
        })
        self.assertEqual(res_old_login.status_code, 401)

        # 5. Verify login with new password succeeds
        res_new_login = self.client.post("/api/v1/auth/login", json={
            "email": "settings_user@example.com",
            "password": "BrandNewPassword123!"
        })
        self.assertEqual(res_new_login.status_code, 200)

    def test_user_preferences_update(self):
        # Update preferences
        update_res = self.client.put("/api/v1/users/me/preferences", json={
            "theme": "dark",
            "daily_review_goal": 35,
            "preferred_llm_provider": "gemini"
        }, headers=self.headers)
        self.assertEqual(update_res.status_code, 200)
        prefs = update_res.json()["data"]
        self.assertEqual(prefs["theme"], "dark")
        self.assertEqual(prefs["daily_review_goal"], 35)
        self.assertEqual(prefs["preferred_llm_provider"], "gemini")

        # Fetch and verify
        get_res = self.client.get("/api/v1/users/me/preferences", headers=self.headers)
        self.assertEqual(get_res.status_code, 200)
        fetched = get_res.json()["data"]
        self.assertEqual(fetched["theme"], "dark")
        self.assertEqual(fetched["daily_review_goal"], 35)
        self.assertEqual(fetched["preferred_llm_provider"], "gemini")
