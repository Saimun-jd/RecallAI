"""
Secure File Storage Service for Recall AI.
Enforces server-controlled storage keys and checksum verification.
Path format: users/{user_id}/documents/{document_id}/{file_id}.{ext}
"""

import hashlib
import os
from pathlib import Path
from typing import Optional, Union
from platformdirs import user_data_dir

DATA_DIR = user_data_dir("Recall", "Recall")
DEFAULT_STORAGE_ROOT = Path(os.path.join(DATA_DIR, "storage"))


class StorageService:
    _root_dir: Path = DEFAULT_STORAGE_ROOT

    def __init__(self, root_dir: Optional[Union[Path, str]] = None):
        if root_dir:
            self._root_dir = Path(root_dir)
        self._root_dir.mkdir(parents=True, exist_ok=True)

    @property
    def root_dir(self) -> Path:
        return self._root_dir

    @classmethod
    def set_root_dir(cls, path: Union[Path, str]) -> None:
        """Configures storage root directory (used for testing isolation)."""
        cls._root_dir = Path(path)
        cls._root_dir.mkdir(parents=True, exist_ok=True)

    @classmethod
    def get_root_dir(cls) -> Path:
        return cls._root_dir

    @staticmethod
    def compute_checksum(content: bytes) -> str:
        """Computes SHA-256 hex digest of file contents."""
        return hashlib.sha256(content).hexdigest()

    @classmethod
    def compute_sha256(cls, content: bytes) -> str:
        return cls.compute_checksum(content)

    @classmethod
    def generate_storage_path(
        cls,
        user_id: str,
        document_id: str,
        file_id: str,
        extension: Optional[str] = None,
        original_filename: Optional[str] = None
    ) -> str:
        """
        Generates safe, non-guessable relative storage key.
        Never incorporates untrusted user-supplied filenames directly into path.
        """
        ext = ""
        if extension:
            ext = extension.lstrip(".").lower()
        elif original_filename:
            safe_name = original_filename.split("/")[-1].split("\\")[-1]
            if "." in safe_name:
                ext = safe_name.split(".")[-1].lower()
        if not ext:
            ext = "bin"
        return f"users/{user_id}/documents/{document_id}/{file_id}.{ext}"

    @classmethod
    def save_file(
        cls,
        first_arg: str,
        second_arg: Optional[Union[bytes, str]] = None,
        file_id: Optional[str] = None,
        extension: Optional[str] = None,
        content: Optional[bytes] = None
    ) -> str:
        """
        Saves raw bytes into the filesystem using either:
          save_file(storage_path, content_bytes)
          save_file(user_id, document_id, file_id, extension, content)
        Returns the relative storage path.
        """
        if isinstance(second_arg, bytes):
            # Signature: save_file(storage_path, content)
            rel_path = first_arg
            data = second_arg
        else:
            # Signature: save_file(user_id, document_id, file_id, extension, content)
            user_id = first_arg
            doc_id = str(second_arg)
            rel_path = cls.generate_storage_path(
                user_id=user_id,
                document_id=doc_id,
                file_id=file_id or "file",
                extension=extension
            )
            data = content or b""

        full_path = cls._root_dir / rel_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(data)
        return rel_path

    @classmethod
    def read_file(cls, storage_path: str) -> bytes:
        """Reads raw bytes for a stored file."""
        full_path = cls._root_dir / storage_path
        if not full_path.exists():
            raise FileNotFoundError(f"Storage file not found: {storage_path}")
        return full_path.read_bytes()

    @classmethod
    def file_exists(cls, storage_path: str) -> bool:
        """Checks if storage path exists on disk."""
        full_path = cls._root_dir / storage_path
        return full_path.exists() and full_path.is_file()

    @classmethod
    def delete_file(cls, storage_path: str) -> bool:
        """Deletes a file from storage if present and cleans empty parent directories."""
        full_path = cls._root_dir / storage_path
        if full_path.exists():
            try:
                full_path.unlink()
                # Clean up empty parent directories up to storage root
                parent = full_path.parent
                while parent != cls._root_dir and parent.exists() and not any(parent.iterdir()):
                    parent.rmdir()
                    parent = parent.parent
                return True
            except Exception:
                return False
        return False


storage_service = StorageService()
