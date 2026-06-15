from __future__ import annotations

import base64
import hashlib
import os
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings


class SecretStoreError(RuntimeError):
    """Raised when encrypted local secrets cannot be read."""


class SecretStore:
    def __init__(self, key: bytes, description: str) -> None:
        self._fernet = Fernet(key)
        self.description = description

    @classmethod
    def from_settings(cls) -> SecretStore:
        settings = get_settings()
        if settings.pfs_secret_key:
            return cls(normalize_key(settings.pfs_secret_key), "encrypted with PFS_SECRET_KEY")

        path = Path(settings.pfs_secret_key_file)
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            raw_key = path.read_bytes().strip()
        else:
            raw_key = Fernet.generate_key()
            path.write_bytes(raw_key + b"\n")
            try:
                os.chmod(path, 0o600)
            except OSError:
                pass
        return cls(normalize_key(raw_key.decode("utf-8")), f"encrypted with local key file {path}")

    def encrypt(self, value: str | None) -> str:
        if not value:
            return ""
        return self._fernet.encrypt(value.encode("utf-8")).decode("utf-8")

    def decrypt(self, value: str | None) -> str:
        if not value:
            return ""
        try:
            return self._fernet.decrypt(value.encode("utf-8")).decode("utf-8")
        except InvalidToken as exc:
            message = "Stored secret cannot be decrypted with the active key."
            raise SecretStoreError(message) from exc


def normalize_key(raw: str) -> bytes:
    candidate = raw.strip().encode("utf-8")
    try:
        Fernet(candidate)
        return candidate
    except ValueError:
        return base64.urlsafe_b64encode(hashlib.sha256(candidate).digest())
