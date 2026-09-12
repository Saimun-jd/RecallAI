"""
Cryptographic Security Primitives for Recall AI.
Includes:
- PBKDF2-HMAC-SHA256 Password Hashing and Verification (OWASP Compliant)
- JWT Token Issuance and Verification (PyJWT)
- AES-256-GCM BYOK Encryption and Decryption (cryptography.hazmat)
- Sensitive Key Masking Utilities
"""

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple
import jwt
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings

# PBKDF2 Configuration
PBKDF2_ROUNDS = 600_000
SALT_BYTES = 16


def hash_password(password: str) -> str:
    """
    Hashes a plaintext password using PBKDF2-HMAC-SHA256.
    Returns: 'pbkdf2_sha256$600000$<salt_hex>$<hash_hex>'
    """
    salt = secrets.token_bytes(SALT_BYTES)
    derived = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt,
        PBKDF2_ROUNDS
    )
    return f"pbkdf2_sha256${PBKDF2_ROUNDS}${salt.hex()}${derived.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plaintext password against the stored PBKDF2 hash
    using timing-attack safe comparison.
    """
    try:
        parts = hashed_password.split('$')
        if len(parts) != 4 or parts[0] != 'pbkdf2_sha256':
            return False
        
        rounds = int(parts[1])
        salt = bytes.fromhex(parts[2])
        expected_hash = bytes.fromhex(parts[3])

        candidate = hashlib.pbkdf2_hmac(
            'sha256',
            plain_password.encode('utf-8'),
            salt,
            rounds
        )
        return hmac.compare_digest(candidate, expected_hash)
    except Exception:
        return False


def create_access_token(
    subject: str,
    workspace_id: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[Dict[str, Any]] = None
) -> str:
    """Generates a signed JWT access token for an authenticated user."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: Dict[str, Any] = {
        "sub": subject,
        "iss": "recall-ai",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    if workspace_id:
        payload["workspace_id"] = workspace_id
    if extra_claims:
        payload.update(extra_claims)

    token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
    return token


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decodes and validates a JWT access token.
    Raises ValueError if expired, malformed, or signature is invalid.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=["HS256"],
            issuer="recall-ai"
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Token has expired.")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid token: {e}")


# ── AES-256-GCM Encryption for BYOK Vault ─────────────────────────────

def get_encryption_master_key() -> bytes:
    """Retrieves and parses the 32-byte master encryption key from settings."""
    return bytes.fromhex(settings.BYOK_ENCRYPTION_KEY)


def encrypt_secret(plaintext: str, key_override: Optional[bytes] = None) -> Tuple[str, str, str]:
    """
    Encrypts a secret (e.g., BYOK API key) using AES-256-GCM.
    Returns:
        (ciphertext_hex, nonce_hex, tag_hex)
    """
    key = key_override or get_encryption_master_key()
    aesgcm = AESGCM(key)
    nonce = secrets.token_bytes(12)  # 12-byte GCM standard nonce

    # AESGCM.encrypt returns ciphertext + 16-byte tag appended
    encrypted_data = aesgcm.encrypt(nonce, plaintext.encode('utf-8'), None)
    ciphertext = encrypted_data[:-16]
    tag = encrypted_data[-16:]

    return ciphertext.hex(), nonce.hex(), tag.hex()


def decrypt_secret(
    ciphertext_hex: str,
    nonce_hex: str,
    tag_hex: str,
    key_override: Optional[bytes] = None
) -> str:
    """
    Decrypts an AES-256-GCM encrypted secret and verifies the authentication tag.
    Raises ValueError if ciphertext or tag has been tampered with.
    """
    key = key_override or get_encryption_master_key()
    aesgcm = AESGCM(key)
    try:
        ciphertext = bytes.fromhex(ciphertext_hex)
        nonce = bytes.fromhex(nonce_hex)
        tag = bytes.fromhex(tag_hex)
        
        # Recombine ciphertext + tag for AESGCM.decrypt
        combined = ciphertext + tag
        decrypted_bytes = aesgcm.decrypt(nonce, combined, None)
        return decrypted_bytes.decode('utf-8')
    except Exception as e:
        raise ValueError("Decryption failed. Authentication tag verification failed or key is invalid.") from e


def mask_key(key: str) -> str:
    """
    Creates a safe hint for user identification without revealing the secret.
    Example: 'sk-abcdef1234567890' -> '...7890'
    """
    clean = key.strip()
    if len(clean) <= 4:
        return "****"
    return f"...{clean[-4:]}"
