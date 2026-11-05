"""
Unit & Integration Tests for Authorization Primitives and IDOR Prevention.
"""

import os
import tempfile
import unittest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import set_db_path
from app.models.schema_init import init_foundation_db
from app.models.repositories import DocumentRepository, WorkspaceRepository, UserRepository
from app.core.security import hash_password
from app.api.deps import require_workspace_owner, require_document_owner
from app.core.errors import AuthorizationError, NotFoundError


class TestAuthorizationPrimitives(unittest.TestCase):
    def setUp(self):
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db_path = self.temp_db.name
        self.temp_db.close()

        set_db_path(self.temp_db_path)
        init_foundation_db(self.temp_db_path)

        # Setup User A
        self.user_a = UserRepository.create_user(
            email="alice@example.com",
            password_hash=hash_password("Password123!")
        )
        self.ws_a = WorkspaceRepository.create_workspace(owner_id=self.user_a["id"], name="Alice Space")
        self.doc_a = DocumentRepository.create_document(
            workspace_id=self.ws_a["id"],
            title="Alice Private Notes"
        )

        # Setup User B
        self.user_b = UserRepository.create_user(
            email="bob@example.com",
            password_hash=hash_password("Password123!")
        )
        self.ws_b = WorkspaceRepository.create_workspace(owner_id=self.user_b["id"], name="Bob Space")
        self.doc_b = DocumentRepository.create_document(
            workspace_id=self.ws_b["id"],
            title="Bob Research Paper"
        )

    def tearDown(self):
        try:
            if os.path.exists(self.temp_db_path):
                os.remove(self.temp_db_path)
        except Exception:
            pass

    def test_workspace_owner_access(self):
        # Alice accessing her own workspace succeeds
        res = require_workspace_owner(workspace_id=self.ws_a["id"], current_user=self.user_a)
        self.assertEqual(res["id"], self.ws_a["id"])

        # Bob accessing Alice's workspace raises AuthorizationError (403)
        with self.assertRaises(AuthorizationError):
            require_workspace_owner(workspace_id=self.ws_a["id"], current_user=self.user_b)

    def test_document_owner_idor_protection(self):
        # Alice accessing her own document succeeds
        doc = require_document_owner(document_id=self.doc_a["id"], workspace=self.ws_a)
        self.assertEqual(doc["title"], "Alice Private Notes")

        # Bob attempting to access Alice's document ID from his workspace fails with NotFoundError (404)
        # We raise 404 to avoid leaking existence of Alice's document to Bob
        with self.assertRaises(NotFoundError):
            require_document_owner(document_id=self.doc_a["id"], workspace=self.ws_b)

        # Accessing completely nonexistent document ID returns 404
        with self.assertRaises(NotFoundError):
            require_document_owner(document_id="nonexistent-id", workspace=self.ws_a)


if __name__ == "__main__":
    unittest.main()
