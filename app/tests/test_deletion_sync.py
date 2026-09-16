import os
import tempfile
import unittest
from unittest.mock import MagicMock, patch
import sqlite3

from app.database import set_active_db_path, init_db, get_connection, save_book, delete_book
from app.core.database import set_db_path, get_db
from app.models.schema_init import init_foundation_db
from app.models.repositories import UserRepository, DocumentRepository
from app.sync_service import pull_changes, push_changes, reconcile_remote_deletions, normalize_timestamp


class TestDeletionSync(unittest.TestCase):
    def setUp(self):
        # Setup temporary SQLite db for user/learning db
        self.user_db_fd, self.user_db_path = tempfile.mkstemp(suffix="_user.db")
        os.close(self.user_db_fd)
        set_active_db_path(self.user_db_path)
        init_db()

        # Setup temporary Foundation db
        self.foundation_db_fd, self.foundation_db_path = tempfile.mkstemp(suffix="_foundation.db")
        os.close(self.foundation_db_fd)
        set_db_path(self.foundation_db_path)
        init_foundation_db(self.foundation_db_path)

        # Create default workspace for Foundation DB
        user = UserRepository.create_user("test@example.com", "hash123", "Test User")
        with get_db() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO workspaces (id, owner_id, name) VALUES ('default', ?, 'default')",
                (user["id"],)
            )

    def tearDown(self):
        try:
            if os.path.exists(self.user_db_path):
                os.remove(self.user_db_path)
            if os.path.exists(self.foundation_db_path):
                os.remove(self.foundation_db_path)
        except Exception:
            pass

    def test_delete_book_generates_tombstone_and_cleans_files(self):
        # Create a temp dummy PDF and cover file
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(b"dummy pdf content")
            temp_pdf_path = f.name

        book_id = save_book("Test Document", temp_pdf_path, "hash123", 10)
        self.assertIsNotNone(book_id)

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT uuid FROM books WHERE id = ?", (book_id,))
            row = cursor.fetchone()
            book_uuid = row["uuid"]
            self.assertIsNotNone(book_uuid)

        # Delete book
        deleted = delete_book(book_id)
        self.assertTrue(deleted)

        # 1. Verify tombstone created
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM sync_tombstones WHERE table_name = 'books' AND uuid = ?", (book_uuid,))
            tombstone = cursor.fetchone()
            self.assertIsNotNone(tombstone)

        # 2. Verify physical file was removed
        self.assertFalse(os.path.exists(temp_pdf_path))

    def test_delete_book_cascades_to_document_repository(self):
        from app.main import delete_book_api

        # Create book
        book_id = save_book("Cascade Test Doc", "/tmp/dummy.pdf", "hash456", 5)

        # Create matching Document in DocumentRepository
        doc = DocumentRepository.create_document(
            workspace_id="default",
            title="Cascade Test Doc",
            source_type="pdf",
            total_pages=5,
            metadata={"book_id": book_id}
        )
        self.assertIsNotNone(doc)
        doc_id = doc["id"]

        # Call delete_book_api
        res = delete_book_api(book_id)
        self.assertEqual(res, {"status": "success"})

        # Verify DocumentRepository no longer has this document
        fetched_doc = DocumentRepository.get_by_id_and_workspace(doc_id, "default")
        self.assertIsNone(fetched_doc)

    def test_pull_changes_does_not_resurrect_tombstoned_records(self):
        # Create and delete book locally to have a tombstone
        book_id = save_book("Resurrect Me Not", "/tmp/resurrect.pdf", "hash789", 1)
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT uuid FROM books WHERE id = ?", (book_id,))
            book_uuid = cursor.fetchone()["uuid"]

        delete_book(book_id)

        # Mock Supabase client returning this book as a remote record
        mock_supabase = MagicMock()
        mock_resp = MagicMock()
        mock_resp.execute.return_value.data = [
            {
                "uuid": book_uuid,
                "title": "Resurrect Me Not",
                "file_path": "/tmp/resurrect.pdf",
                "file_hash": "hash789",
                "total_pages": 1,
                "created_at": "2026-09-15 12:00:00",
                "updated_at": "2026-09-15 12:00:00",
                "last_read_at": None,
                "last_read_page": None,
                "last_topic_id": None
            }
        ]

        # For tombstones query on supabase
        mock_tombstones_resp = MagicMock()
        mock_tombstones_resp.execute.return_value.data = []

        def table_side_effect(table_name):
            m = MagicMock()
            if table_name == "sync_tombstones":
                m.select.return_value.eq.return_value.gt.return_value = mock_tombstones_resp
            else:
                m.select.return_value.gt.return_value.order.return_value = mock_resp
                m.select.return_value.execute.return_value.data = [{"uuid": book_uuid}]
            return m

        mock_supabase.table.side_effect = table_side_effect

        pull_changes(mock_supabase, last_sync="2026-09-15 00:00:00")

        # Verify book was NOT re-inserted locally
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM books WHERE uuid = ?", (book_uuid,))
            self.assertIsNone(cursor.fetchone())

    def test_pull_changes_reconciles_remotely_deleted_books(self):
        # Create a book locally that exists locally
        book_id = save_book("Remote Deleted Doc", "/tmp/remote_del.pdf", "hash_rem_del", 2)
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT uuid FROM books WHERE id = ?", (book_id,))
            book_uuid = cursor.fetchone()["uuid"]

        # Mock Supabase where remote has NO books at all (meaning it was deleted remotely)
        mock_supabase = MagicMock()
        mock_resp = MagicMock()
        mock_resp.execute.return_value.data = []

        mock_tombstones_resp = MagicMock()
        mock_tombstones_resp.execute.return_value.data = []

        def table_side_effect(table_name):
            m = MagicMock()
            if table_name == "sync_tombstones":
                m.select.return_value.eq.return_value.gt.return_value = mock_tombstones_resp
            else:
                m.select.return_value.gt.return_value.order.return_value = mock_resp
                m.select.return_value.execute.return_value.data = []
            return m

        mock_supabase.table.side_effect = table_side_effect

        # Backdate book to simulate a book that was synced in the past (before last_sync)
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE books SET created_at = '2026-09-14 00:00:00', updated_at = '2026-09-14 00:00:00' WHERE id = ?", (book_id,))

        pull_changes(mock_supabase, last_sync="2026-09-15 00:00:00")

        # Verify book was deleted locally due to remote server deletion reconciliation
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM books WHERE uuid = ?", (book_uuid,))
            self.assertIsNone(cursor.fetchone())

    def test_reconcile_remote_deletions_preserves_newly_uploaded_local_books(self):
        # Create a new local book created AFTER last_sync
        book_id = save_book("Newly Uploaded Doc", "/tmp/new_doc.pdf", "hash_new_doc", 5)
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT uuid FROM books WHERE id = ?", (book_id,))
            book_uuid = cursor.fetchone()["uuid"]
            cursor.execute("UPDATE books SET created_at = '2026-09-16 12:00:00', updated_at = '2026-09-16 12:00:00' WHERE id = ?", (book_id,))

        # Supabase remote has NO books (the new book has not been pushed yet)
        mock_supabase = MagicMock()
        mock_supabase.table.return_value.select.return_value.execute.return_value.data = []

        reconcile_remote_deletions(mock_supabase, last_sync="2026-09-15 00:00:00")

        # The newly uploaded book MUST NOT be deleted!
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM books WHERE uuid = ?", (book_uuid,))
            self.assertIsNotNone(cursor.fetchone())

    def test_reconcile_remote_deletions_preserves_book_with_clock_skew_or_recent_timestamp(self):
        # Book created within the last 10 minutes, but last_sync is slightly ahead or equal to created_at
        import datetime
        now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        book_id = save_book("Clock Skew Doc", "/tmp/clock_skew.pdf", "hash_skew", 5)
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT uuid FROM books WHERE id = ?", (book_id,))
            book_uuid = cursor.fetchone()["uuid"]
            # Set created_at to now, and last_sync to now (equal)
            cursor.execute("UPDATE books SET created_at = ?, updated_at = ? WHERE id = ?", (now_str, now_str, book_id))

        mock_supabase = MagicMock()
        mock_supabase.table.return_value.select.return_value.execute.return_value.data = []

        # Even with last_sync equal to created_at and remote empty, grace period MUST protect the book
        reconcile_remote_deletions(mock_supabase, last_sync=now_str)

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM books WHERE uuid = ?", (book_uuid,))
            self.assertIsNotNone(cursor.fetchone(), "Book within grace period must NEVER be deleted")

    def test_normalize_timestamp(self):
        self.assertEqual(normalize_timestamp("2026-09-15T21:12:46+00:00"), "2026-09-15 21:12:46")
        self.assertEqual(normalize_timestamp("2026-09-15T21:12:46Z"), "2026-09-15 21:12:46")
        self.assertEqual(normalize_timestamp("2026-09-15 21:12:46.999999"), "2026-09-15 21:12:46")
        self.assertEqual(normalize_timestamp(None), "1970-01-01 00:00:00")
        self.assertEqual(normalize_timestamp(""), "1970-01-01 00:00:00")

    def test_push_changes_skips_orphaned_topic_safely(self):
        # Create a book first, then insert topic, then delete book with foreign_keys OFF to simulate an orphaned topic
        book_id = save_book("Orphan Parent", "/tmp/orphan.pdf", "hash_orphan", 1)
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO topics (book_id, title, start_page, end_page, level, sort_order, topic_hash, uuid, updated_at)
                VALUES (?, 'Orphan Topic', 1, 5, 1, 1, 'orphan_hash_1', 'orphan-uuid-1', '2026-09-16 12:00:00')
            """, (book_id,))
            cursor.execute("PRAGMA foreign_keys = OFF")
            cursor.execute("DELETE FROM books WHERE id = ?", (book_id,))
            cursor.execute("PRAGMA foreign_keys = ON")

        mock_supabase = MagicMock()
        mock_user = MagicMock()
        mock_user.user.id = "user-test-123"
        mock_supabase.auth.get_user.return_value = mock_user

        # Supabase books select returns empty (book doesn't exist remotely)
        mock_supabase.table.return_value.select.return_value.execute.return_value.data = []
        mock_supabase.table.return_value.upsert.return_value.execute.return_value = MagicMock()

        # push_changes should not crash with an unhandled exception and safely skip the orphaned topic
        try:
            push_changes(mock_supabase, last_sync="2026-09-15 00:00:00")
        except Exception as e:
            self.fail(f"push_changes raised an exception on orphaned topic: {e}")

    def test_push_changes_retries_individually_on_fk_error(self):
        # Create a valid book and valid topic
        book_id = save_book("FK Test Book", "/tmp/fk.pdf", "hash_fk", 1)
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT uuid FROM books WHERE id = ?", (book_id,))
            book_uuid = cursor.fetchone()["uuid"]
            cursor.execute("""
                INSERT INTO topics (book_id, title, start_page, end_page, level, sort_order, topic_hash, uuid, updated_at)
                VALUES (?, 'Valid Topic', 1, 1, 1, 1, 'valid_hash_1', 'topic-uuid-1', '2026-09-16 12:00:00')
            """, (book_id,))

        mock_supabase = MagicMock()
        mock_user = MagicMock()
        mock_user.user.id = "user-test-123"
        mock_supabase.auth.get_user.return_value = mock_user

        # Supabase books returns the book uuid
        mock_supabase.table.return_value.select.return_value.execute.return_value.data = [{"uuid": book_uuid}]

        from postgrest.exceptions import APIError
        # Simulate batch upsert failing with 23503, but individual retry succeeding
        first_call = True
        def upsert_side_effect(batch, on_conflict=None):
            nonlocal first_call
            m = MagicMock()
            if len(batch) > 1 and first_call:
                first_call = False
                raise APIError({'message': 'violates foreign key constraint', 'code': '23503', 'hint': None, 'details': 'Key is not present'})
            return m

        mock_supabase.table.return_value.upsert.side_effect = upsert_side_effect

        try:
            push_changes(mock_supabase, last_sync="2026-09-15 00:00:00")
        except Exception as e:
            self.fail(f"push_changes should have caught FK error and retried without failing: {e}")

    def test_full_add_sync_delete_sync_lifecycle(self):
        # 1. User uploads a new book locally
        book_id = save_book("End To End Doc", "/tmp/e2e.pdf", "hash_e2e_123", 10)
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT uuid FROM books WHERE id = ?", (book_id,))
            book_uuid = cursor.fetchone()["uuid"]

        mock_supabase = MagicMock()
        mock_user = MagicMock()
        mock_user.user.id = "user-test-e2e"
        mock_supabase.auth.get_user.return_value = mock_user

        # Track remote state
        remote_books = {}
        remote_tombstones = []

        def table_side_effect(table_name):
            m = MagicMock()
            if table_name == "books":
                m.select.return_value.execute.return_value.data = [{"uuid": u} for u in remote_books.keys()]
                def upsert_books(batch, on_conflict=None):
                    for item in batch:
                        remote_books[item["uuid"]] = item
                    return MagicMock()
                def delete_books():
                    del_mock = MagicMock()
                    def in_filter(col, uuids):
                        for u in uuids:
                            remote_books.pop(u, None)
                        return MagicMock()
                    del_mock.in_ = in_filter
                    return del_mock
                m.upsert.side_effect = upsert_books
                m.delete.side_effect = delete_books
            elif table_name == "sync_tombstones":
                def upsert_tombstones(batch, on_conflict=None):
                    remote_tombstones.extend(batch)
                    return MagicMock()
                m.upsert.side_effect = upsert_tombstones
                m.select.return_value.eq.return_value.gt.return_value.execute.return_value.data = remote_tombstones
            else:
                m.select.return_value.execute.return_value.data = []
                m.select.return_value.gt.return_value.order.return_value.execute.return_value.data = []
                m.upsert.return_value.execute.return_value = MagicMock()
                m.delete.return_value.in_.return_value.execute.return_value = MagicMock()
            return m

        mock_supabase.table.side_effect = table_side_effect

        # 2. Simulate closing and reopening app BEFORE first sync
        # reconcile_remote_deletions runs with last_sync = "2026-09-15 00:00:00"
        reconcile_remote_deletions(mock_supabase, last_sync="2026-09-15 00:00:00")
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM books WHERE id = ?", (book_id,))
            self.assertIsNotNone(cursor.fetchone(), "Book must NOT be deleted on restart before sync")

        # 3. Simulate sync running (push_changes)
        push_changes(mock_supabase, last_sync="2026-09-15 00:00:00")
        self.assertIn(book_uuid, remote_books, "Book must be pushed to remote Supabase")

        # 4. Simulate closing and reopening app AFTER sync
        reconcile_remote_deletions(mock_supabase, last_sync="2026-09-16 12:00:00")
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM books WHERE id = ?", (book_id,))
            self.assertIsNotNone(cursor.fetchone(), "Book must remain intact on restart after sync")

        # 5. User deletes the book
        deleted = delete_book(book_id)
        self.assertTrue(deleted)
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM books WHERE id = ?", (book_id,))
            self.assertIsNone(cursor.fetchone(), "Book must be deleted locally")
            cursor.execute("SELECT * FROM sync_tombstones WHERE uuid = ?", (book_uuid,))
            self.assertIsNotNone(cursor.fetchone(), "Tombstone must be created locally")

        # 6. Simulate sync running after delete
        push_changes(mock_supabase, last_sync="2026-09-16 12:00:00")
        self.assertNotIn(book_uuid, remote_books, "Book must be deleted from remote Supabase")
        self.assertTrue(any(t["uuid"] == book_uuid for t in remote_tombstones), "Tombstone must be pushed to Supabase")

        # 7. Simulate restart and pull_changes
        pull_changes(mock_supabase, last_sync="2026-09-16 12:00:00")
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM books WHERE uuid = ?", (book_uuid,))
            self.assertIsNone(cursor.fetchone(), "Book must NEVER be resurrected")

    def test_delete_book_api_with_auth_deletes_remote_and_tombstones(self):
        from app.main import delete_book_api
        book_id = save_book("Auth Delete Test", "/tmp/dummy.pdf", "hash_auth_del", 10)
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT uuid FROM books WHERE id = ?", (book_id,))
            book_uuid = cursor.fetchone()["uuid"]

        with patch("app.sync_service.get_supabase_client") as mock_get_client:
            mock_sb = MagicMock()
            mock_user = MagicMock()
            mock_user.user.id = "test-user-id"
            mock_sb.auth.get_user.return_value = mock_user
            mock_get_client.return_value = mock_sb

            res = delete_book_api(book_id, authorization="Bearer valid_token_123")
            self.assertEqual(res, {"status": "success"})

            # Verify local deletion
            with get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM books WHERE id = ?", (book_id,))
                self.assertIsNone(cursor.fetchone())

            # Verify remote deletion called
            mock_sb.table.assert_any_call("books")
            mock_sb.table.return_value.delete.return_value.eq.assert_called_with("uuid", book_uuid)

            # Verify remote tombstone upserted
            mock_sb.table.assert_any_call("sync_tombstones")
            mock_sb.table.return_value.upsert.assert_called()

            # Verify storage removed
            mock_sb.storage.from_.assert_called_with("user_pdfs")
            mock_sb.storage.from_.return_value.remove.assert_called_with(["test-user-id/hash_auth_del.pdf"])



