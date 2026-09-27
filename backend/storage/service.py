"""Storage abstraction layer.

Local filesystem implementation now.
Replace LocalStorageService with SupabaseStorageService in Phase 5
without touching any report logic.
"""
import os
import uuid
from datetime import datetime, timezone

from config import settings


class StorageService:
    """Interface contract for file storage backends."""

    def generate_path(self, original_name: str, subfolder: str = "reports") -> str:
        raise NotImplementedError

    def save(self, file_bytes: bytes, stored_path: str) -> str:
        raise NotImplementedError

    def read(self, stored_path: str) -> bytes:
        raise NotImplementedError

    def delete(self, stored_path: str) -> None:
        raise NotImplementedError

    def exists(self, stored_path: str) -> bool:
        raise NotImplementedError


class LocalStorageService(StorageService):
    """Stores files on the local filesystem under UPLOAD_DIR."""

    def generate_path(self, original_name: str, subfolder: str = "reports") -> str:
        """Return a safe, unique relative path for a new file.

        Format: reports/YYYY/MM/uuid_ext
        The path is relative to UPLOAD_DIR — never exposed to clients.
        """
        ext = ""
        if "." in original_name:
            ext = "." + original_name.rsplit(".", 1)[-1].lower()
        now = datetime.now(timezone.utc)
        unique = uuid.uuid4().hex
        return os.path.join(subfolder, str(now.year), f"{now.month:02d}", f"{unique}{ext}")

    def _abs(self, stored_path: str) -> str:
        return os.path.join(settings.upload_dir_abs, stored_path)

    def save(self, file_bytes: bytes, stored_path: str) -> str:
        abs_path = self._abs(stored_path)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, "wb") as f:
            f.write(file_bytes)
        return stored_path

    def read(self, stored_path: str) -> bytes:
        abs_path = self._abs(stored_path)
        if not os.path.isfile(abs_path):
            raise FileNotFoundError(f"File not found: {stored_path}")
        with open(abs_path, "rb") as f:
            return f.read()

    def delete(self, stored_path: str) -> None:
        abs_path = self._abs(stored_path)
        if os.path.isfile(abs_path):
            os.remove(abs_path)

    def exists(self, stored_path: str) -> bool:
        return os.path.isfile(self._abs(stored_path))


# Singleton — swap this in Phase 5 for SupabaseStorageService()
storage: StorageService = LocalStorageService()
