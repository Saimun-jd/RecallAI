"""
Integration Tests for Database Foundation and Repositories.
Runs on an isolated temporary database to guarantee test isolation.
"""

import os
import tempfile
import unittest

from app.core.database import set_db_path, check_database_health, get_db
from app.models.schema_init import init_foundation_db
from app.models.repositories import (
    UserRepository,
    WorkspaceRepository,
    PreferencesRepository,
    DocumentRepository,
    ProviderCredentialRepository
)
from app.core.security import hash_password, encrypt_secret, mask_key


class TestDatabaseFoundation(unittest.TestCase):
    def setUp(self):
        # Create a clean temporary database file for each test
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db_path = self.temp_db.name
        self.temp_db.close()
        
        set_db_path(self.temp_db_path)
        init_foundation_db(self.temp_db_path)

    def tearDown(self):
        try:
            if os.path.exists(self.temp_db_path):
                os.remove(self.temp_db_path)
        except Exception:
            pass

    def test_database_health_probe(self):
        self.assertTrue(check_database_health())

    def test_user_creation_and_retrieval(self):
        pwd_hash = hash_password("Password123!")
        user = UserRepository.create_user(
            email="TestUser@example.com",
            password_hash=pwd_hash,
            full_name="Test User"
        )
        self.assertIsNotNone(user["id"])
        # Stored normalized as lowercase
        self.assertEqual(user["email"], "testuser@example.com")
        self.assertEqual(user["full_name"], "Test User")

        # Retrieve by email
        fetched = UserRepository.get_by_email("testuser@example.com")
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["id"], user["id"])

        # Case-insensitive lookup
        fetched_upper = UserRepository.get_by_email("TESTUSER@EXAMPLE.COM")
        self.assertIsNotNone(fetched_upper)
        self.assertEqual(fetched_upper["id"], user["id"])

    def test_workspace_creation_and_ownership(self):
        pwd_hash = hash_password("Password123!")
        user = UserRepository.create_user(email="owner@example.com", password_hash=pwd_hash)
        
        workspace = WorkspaceRepository.create_workspace(owner_id=user["id"], name="Scholar Space")
        self.assertIsNotNone(workspace["id"])
        self.assertEqual(workspace["owner_id"], user["id"])
        self.assertEqual(workspace["name"], "Scholar Space")

        fetched = WorkspaceRepository.get_by_owner_id(user["id"])
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["id"], workspace["id"])

    def test_preferences_lifecycle(self):
        pwd_hash = hash_password("Password123!")
        user = UserRepository.create_user(email="pref@example.com", password_hash=pwd_hash)

        prefs = PreferencesRepository.create_preferences(
            user_id=user["id"],
            theme="dark-brutalist",
            daily_review_goal=30,
            preferred_llm_provider="gemini"
        )
        self.assertEqual(prefs["theme"], "dark-brutalist")
        self.assertEqual(prefs["daily_review_goal"], 30)

        updated = PreferencesRepository.update_preferences(
            user_id=user["id"],
            theme="neo-brutalist",
            daily_review_goal=50
        )
        self.assertEqual(updated["theme"], "neo-brutalist")
        self.assertEqual(updated["daily_review_goal"], 50)

    def test_document_creation_and_isolation(self):
        pwd_hash = hash_password("Password123!")
        user = UserRepository.create_user(email="doc@example.com", password_hash=pwd_hash)
        ws = WorkspaceRepository.create_workspace(owner_id=user["id"])

        doc = DocumentRepository.create_document(
            workspace_id=ws["id"],
            title="Introduction to Quantum Mechanics",
            source_type="pdf",
            total_pages=42,
            metadata={"author": "Griffiths"}
        )
        self.assertIsNotNone(doc["id"])
        self.assertEqual(doc["title"], "Introduction to Quantum Mechanics")
        self.assertEqual(doc["metadata"]["author"], "Griffiths")

        # Query by valid ID and workspace
        fetched = DocumentRepository.get_by_id_and_workspace(doc["id"], ws["id"])
        self.assertIsNotNone(fetched)

        # Query with wrong workspace returns None (IDOR protection)
        wrong_ws_fetch = DocumentRepository.get_by_id_and_workspace(doc["id"], "other-workspace-id")
        self.assertIsNone(wrong_ws_fetch)

    def test_byok_credential_vault(self):
        pwd_hash = hash_password("Password123!")
        user = UserRepository.create_user(email="byok@example.com", password_hash=pwd_hash)
        ws = WorkspaceRepository.create_workspace(owner_id=user["id"])

        raw_key = "sk-proj-test-openai-key-secret-12345"
        cipher, nonce, tag = encrypt_secret(raw_key)
        hint = mask_key(raw_key)

        cred = ProviderCredentialRepository.save_credential(
            workspace_id=ws["id"],
            user_id=user["id"],
            provider="openai",
            encrypted_key=cipher,
            key_nonce=nonce,
            key_tag=tag,
            key_hint=hint
        )
        self.assertIsNotNone(cred["id"])
        self.assertEqual(cred["key_hint"], "...2345")

        fetched = ProviderCredentialRepository.get_by_workspace_and_provider(ws["id"], "openai")
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["encrypted_key"], cipher)

    def test_cascade_deletion(self):
        pwd_hash = hash_password("Password123!")
        user = UserRepository.create_user(email="delete-me@example.com", password_hash=pwd_hash)
        ws = WorkspaceRepository.create_workspace(owner_id=user["id"])
        doc = DocumentRepository.create_document(workspace_id=ws["id"], title="Will Be Deleted")

        # Delete user
        with get_db() as conn:
            conn.execute("DELETE FROM users WHERE id = ?", (user["id"],))

        # Workspace and Document must be deleted by cascade
        self.assertIsNone(WorkspaceRepository.get_by_id(ws["id"]))
        self.assertIsNone(DocumentRepository.get_by_id_and_workspace(doc["id"], ws["id"]))


if __name__ == "__main__":
    unittest.main()
