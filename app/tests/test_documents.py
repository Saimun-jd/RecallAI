"""
Integration and Pipeline Tests for Document Ingestion and Knowledge Pipeline.
Tests upload validation, extraction, chunking, embedding, storage,
IDOR protection, status tracking, and cascade deletion.
"""

import os
import shutil
import tempfile
import unittest
import fitz  # PyMuPDF
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import set_db_path
from app.models.schema_init import init_foundation_db
from app.models.repositories import (
    DocumentRepository,
    FileRepository,
    ChunkRepository,
    ProcessingJobRepository,
)
from app.services.storage import StorageService
from app.services.pipeline import DocumentProcessingPipeline
from app.api.middleware import auth_rate_limiter


def create_sample_pdf() -> bytes:
    """Generates a valid 2-page PDF in-memory for testing."""
    doc = fitz.open()
    
    # Page 1
    p1 = doc.new_page(width=595, height=842)
    p1.insert_text((50, 72), "Chapter 1: Foundations of Artificial Intelligence", fontsize=16)
    p1.insert_text((50, 110), "Artificial intelligence is a branch of computer science.\nIt aims to create software capable of intelligent behavior.", fontsize=11)
    
    # Page 2
    p2 = doc.new_page(width=595, height=842)
    p2.insert_text((50, 72), "Section 1.1: Machine Learning Paradigms", fontsize=16)
    p2.insert_text((50, 110), "Supervised learning utilizes labeled datasets to train models.\nUnsupervised learning discovers hidden patterns.", fontsize=11)
    
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


class TestDocumentPipeline(unittest.TestCase):
    def setUp(self):
        auth_rate_limiter.reset()

        # 1. Isolated temporary database
        self.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_db_path = self.temp_db.name
        self.temp_db.close()

        set_db_path(self.temp_db_path)
        init_foundation_db(self.temp_db_path)

        # 2. Isolated temporary storage root
        self.temp_storage_dir = tempfile.mkdtemp(prefix="recall_test_storage_")
        StorageService.set_root_dir(self.temp_storage_dir)

        # 3. TestClient
        self.client = TestClient(app)

        # 4. Helper to register user and obtain token
        uid = os.urandom(4).hex()
        self.user_a_token, self.user_a_workspace_id = self._register_user(f"user_a_{uid}@example.com", "Password123!")
        self.user_b_token, self.user_b_workspace_id = self._register_user(f"user_b_{uid}@example.com", "Password123!")

    def tearDown(self):
        try:
            if os.path.exists(self.temp_db_path):
                os.remove(self.temp_db_path)
        except Exception:
            pass

        try:
            if os.path.exists(self.temp_storage_dir):
                shutil.rmtree(self.temp_storage_dir, ignore_errors=True)
        except Exception:
            pass

    def _register_user(self, email: str, password: str) -> tuple[str, str]:
        res = self.client.post("/api/v1/auth/signup", json={
            "email": email,
            "password": password,
            "full_name": "Test User"
        })
        self.assertEqual(res.status_code, 201)
        data = res.json()["data"]
        return data["access_token"], data["workspace"]["id"]

    def _auth_headers(self, token: str) -> dict:
        return {"Authorization": f"Bearer {token}"}

    def test_pdf_upload_and_pipeline_success(self):
        """End-to-end PDF upload, async pipeline run, chunk verification, and status."""
        pdf_bytes = create_sample_pdf()

        # 1. Upload PDF
        res = self.client.post(
            "/api/v1/documents/upload",
            headers=self._auth_headers(self.user_a_token),
            files={"file": ("ai_foundations.pdf", pdf_bytes, "application/pdf")}
        )
        self.assertEqual(res.status_code, 202)
        upload_data = res.json()["data"]
        doc_id = upload_data["document_id"]
        job_id = upload_data["job_id"]
        self.assertEqual(upload_data["status"], "uploading")
        self.assertEqual(upload_data["filename"], "ai_foundations.pdf")
        self.assertEqual(upload_data["size_bytes"], len(pdf_bytes))

        # 2. Run Pipeline
        success = DocumentProcessingPipeline.process_document(
            document_id=doc_id,
            job_id=job_id,
            workspace_id=self.user_a_workspace_id
        )
        self.assertTrue(success)

        # 3. Check Document Details
        doc_res = self.client.get(
            f"/api/v1/documents/{doc_id}",
            headers=self._auth_headers(self.user_a_token)
        )
        self.assertEqual(doc_res.status_code, 200)
        doc = doc_res.json()["data"]
        self.assertEqual(doc["status"], "ready")
        self.assertEqual(doc["total_pages"], 2)
        self.assertEqual(doc["source_type"], "pdf")

        # 4. Check Document Status Endpoint
        status_res = self.client.get(
            f"/api/v1/documents/{doc_id}/status",
            headers=self._auth_headers(self.user_a_token)
        )
        self.assertEqual(status_res.status_code, 200)
        status_data = status_res.json()["data"]
        self.assertEqual(status_data["status"], "ready")
        self.assertEqual(status_data["stage_progress"], 100)
        self.assertEqual(status_data["current_stage"], "completed")

        # 5. Check Document Chunks
        chunks_res = self.client.get(
            f"/api/v1/documents/{doc_id}/chunks",
            headers=self._auth_headers(self.user_a_token)
        )
        self.assertEqual(chunks_res.status_code, 200)
        chunks_data = chunks_res.json()["data"]
        self.assertGreater(chunks_data["total"], 0)
        first_chunk = chunks_data["chunks"][0]
        self.assertEqual(first_chunk["chunk_index"], 0)
        self.assertIn("Artificial intelligence", first_chunk["content"])
        self.assertGreater(first_chunk["token_count"], 0)

    def test_markdown_upload_and_pipeline(self):
        """Tests markdown ingestion and semantic chunking with heading preservation."""
        md_content = b"""# Introduction to Neural Networks

Neural networks are computing systems inspired by biological neural networks.

## Architecture

A network consists of layers of interconnected nodes or neurons.
Each connection can transmit a signal to other neurons.

### Activation Functions

The output of each neuron is computed by some non-linear function.
"""
        res = self.client.post(
            "/api/v1/documents/upload",
            headers=self._auth_headers(self.user_a_token),
            files={"file": ("neural_nets.md", md_content, "text/markdown")}
        )
        self.assertEqual(res.status_code, 202)
        doc_id = res.json()["data"]["document_id"]
        job_id = res.json()["data"]["job_id"]

        success = DocumentProcessingPipeline.process_document(
            document_id=doc_id,
            job_id=job_id,
            workspace_id=self.user_a_workspace_id
        )
        self.assertTrue(success)

        chunks_res = self.client.get(
            f"/api/v1/documents/{doc_id}/chunks",
            headers=self._auth_headers(self.user_a_token)
        )
        self.assertEqual(chunks_res.status_code, 200)
        chunks = chunks_res.json()["data"]["chunks"]
        self.assertGreater(len(chunks), 0)
        self.assertIn("Neural networks", chunks[0]["content"])

    def test_text_upload_and_pipeline(self):
        """Tests plain text ingestion."""
        txt_content = b"Simple study notes for history class.\nWorld War II concluded in 1945."
        res = self.client.post(
            "/api/v1/documents/upload",
            headers=self._auth_headers(self.user_a_token),
            files={"file": ("history.txt", txt_content, "text/plain")}
        )
        self.assertEqual(res.status_code, 202)
        doc_id = res.json()["data"]["document_id"]
        job_id = res.json()["data"]["job_id"]

        success = DocumentProcessingPipeline.process_document(
            document_id=doc_id,
            job_id=job_id,
            workspace_id=self.user_a_workspace_id
        )
        self.assertTrue(success)

        doc_res = self.client.get(
            f"/api/v1/documents/{doc_id}",
            headers=self._auth_headers(self.user_a_token)
        )
        self.assertEqual(doc_res.json()["data"]["status"], "ready")

    def test_empty_file_rejected(self):
        """0-byte uploads must be rejected immediately with 422."""
        res = self.client.post(
            "/api/v1/documents/upload",
            headers=self._auth_headers(self.user_a_token),
            files={"file": ("empty.pdf", b"", "application/pdf")}
        )
        self.assertEqual(res.status_code, 422)
        self.assertEqual(res.json()["error"]["code"], "VALIDATION_ERROR")

    def test_corrupt_pdf_rejected_by_magic_bytes(self):
        """Files claiming to be PDF without %PDF header must be rejected with 422."""
        res = self.client.post(
            "/api/v1/documents/upload",
            headers=self._auth_headers(self.user_a_token),
            files={"file": ("malicious.pdf", b"NOT_A_REAL_PDF_HEADER", "application/pdf")}
        )
        self.assertEqual(res.status_code, 422)
        self.assertEqual(res.json()["error"]["code"], "VALIDATION_ERROR")
        self.assertIn("%PDF", res.json()["error"]["message"])

    def test_unsupported_file_extension_rejected(self):
        """Unsupported file extensions (.exe, .csv, etc.) must be rejected with 422."""
        res = self.client.post(
            "/api/v1/documents/upload",
            headers=self._auth_headers(self.user_a_token),
            files={"file": ("malware.exe", b"MZ\x90\x00", "application/octet-stream")}
        )
        self.assertEqual(res.status_code, 422)
        self.assertEqual(res.json()["error"]["code"], "VALIDATION_ERROR")

    def test_payload_too_large_rejected(self):
        """Text files larger than 10MB must be rejected with 413 PAYLOAD_TOO_LARGE."""
        oversized = b"A" * (10 * 1024 * 1024 + 1024)
        res = self.client.post(
            "/api/v1/documents/upload",
            headers=self._auth_headers(self.user_a_token),
            files={"file": ("huge.txt", oversized, "text/plain")}
        )
        self.assertEqual(res.status_code, 413)
        self.assertEqual(res.json()["error"]["code"], "PAYLOAD_TOO_LARGE")

    def test_document_idor_protection(self):
        """Guarantees User B cannot read, status-check, chunk-view, or delete User A's document."""
        pdf_bytes = create_sample_pdf()
        upload_res = self.client.post(
            "/api/v1/documents/upload",
            headers=self._auth_headers(self.user_a_token),
            files={"file": ("classified.pdf", pdf_bytes, "application/pdf")}
        )
        doc_id = upload_res.json()["data"]["document_id"]
        job_id = upload_res.json()["data"]["job_id"]
        DocumentProcessingPipeline.process_document(doc_id, job_id, self.user_a_workspace_id)

        # 1. User B tries to view details -> 404
        res = self.client.get(f"/api/v1/documents/{doc_id}", headers=self._auth_headers(self.user_b_token))
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()["error"]["code"], "NOT_FOUND")

        # 2. User B tries to view status -> 404
        res = self.client.get(f"/api/v1/documents/{doc_id}/status", headers=self._auth_headers(self.user_b_token))
        self.assertEqual(res.status_code, 404)

        # 3. User B tries to view chunks -> 404
        res = self.client.get(f"/api/v1/documents/{doc_id}/chunks", headers=self._auth_headers(self.user_b_token))
        self.assertEqual(res.status_code, 404)

        # 4. User B tries to delete -> 404
        res = self.client.delete(f"/api/v1/documents/{doc_id}", headers=self._auth_headers(self.user_b_token))
        self.assertEqual(res.status_code, 404)

        # 5. User B document list does not contain User A's document
        list_res = self.client.get("/api/v1/documents", headers=self._auth_headers(self.user_b_token))
        self.assertEqual(list_res.status_code, 200)
        self.assertEqual(list_res.json()["data"]["total"], 0)

    def test_cascade_deletion(self):
        """Deleting a document must delete chunks, processing jobs, and the stored file on disk."""
        pdf_bytes = create_sample_pdf()
        upload_res = self.client.post(
            "/api/v1/documents/upload",
            headers=self._auth_headers(self.user_a_token),
            files={"file": ("temp.pdf", pdf_bytes, "application/pdf")}
        )
        doc_id = upload_res.json()["data"]["document_id"]
        job_id = upload_res.json()["data"]["job_id"]
        DocumentProcessingPipeline.process_document(doc_id, job_id, self.user_a_workspace_id)

        # Verify chunks exist
        self.assertGreater(ChunkRepository.count_by_document(doc_id), 0)

        # Retrieve file path
        doc = DocumentRepository.get_by_id_and_workspace(doc_id, self.user_a_workspace_id)
        self.assertIsNotNone(doc["file_id"])
        file_rec = FileRepository.get_by_id(doc["file_id"])
        self.assertIsNotNone(file_rec)
        self.assertTrue(StorageService.file_exists(file_rec["storage_path"]))

        # Delete document via API
        del_res = self.client.delete(
            f"/api/v1/documents/{doc_id}",
            headers=self._auth_headers(self.user_a_token)
        )
        self.assertEqual(del_res.status_code, 200)

        # Verify document is gone
        self.assertIsNone(DocumentRepository.get_by_id_and_workspace(doc_id, self.user_a_workspace_id))

        # Verify chunks are cascaded
        self.assertEqual(ChunkRepository.count_by_document(doc_id), 0)

        # Verify file is deleted from disk
        self.assertFalse(StorageService.file_exists(file_rec["storage_path"]))

    def test_pipeline_idempotency(self):
        """Reprocessing an existing document updates chunks cleanly without duplicate index violations."""
        pdf_bytes = create_sample_pdf()
        upload_res = self.client.post(
            "/api/v1/documents/upload",
            headers=self._auth_headers(self.user_a_token),
            files={"file": ("rerun.pdf", pdf_bytes, "application/pdf")}
        )
        doc_id = upload_res.json()["data"]["document_id"]
        job_id = upload_res.json()["data"]["job_id"]

        # First run
        run1 = DocumentProcessingPipeline.process_document(doc_id, job_id, self.user_a_workspace_id)
        self.assertTrue(run1)
        count1 = ChunkRepository.count_by_document(doc_id)
        self.assertGreater(count1, 0)

        # Second run (reprocessing)
        run2 = DocumentProcessingPipeline.process_document(doc_id, job_id, self.user_a_workspace_id)
        self.assertTrue(run2)
        count2 = ChunkRepository.count_by_document(doc_id)

        # Count must remain exactly the same due to ON CONFLICT (document_id, chunk_index)
        self.assertEqual(count1, count2)


if __name__ == "__main__":
    unittest.main()
