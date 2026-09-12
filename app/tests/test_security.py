"""
Unit Tests for Cryptographic Security Primitives.
Covers:
- PBKDF2 Password Hashing, Verification, Salt Uniqueness
- AES-256-GCM BYOK Encryption, Decryption, Tamper Detection
- JWT Access Token Creation, Verification, Expiration
- Key Hint Masking
"""

import unittest
from datetime import timedelta
import time

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    encrypt_secret,
    decrypt_secret,
    mask_key
)


class TestSecurityPrimitives(unittest.TestCase):
    def test_password_hashing_and_verification(self):
        pwd = "SuperSecretPassword123!"
        hashed = hash_password(pwd)
        
        # Verify correct structure
        self.assertTrue(hashed.startswith("pbkdf2_sha256$600000$"))
        
        # Correct password verifies
        self.assertTrue(verify_password(pwd, hashed))
        
        # Incorrect password fails
        self.assertFalse(verify_password("WrongPassword!", hashed))
        self.assertFalse(verify_password("", hashed))

    def test_password_salt_uniqueness(self):
        pwd = "IdenticalPassword123!"
        hash1 = hash_password(pwd)
        hash2 = hash_password(pwd)
        # Even with identical passwords, salts must differ
        self.assertNotEqual(hash1, hash2)
        self.assertTrue(verify_password(pwd, hash1))
        self.assertTrue(verify_password(pwd, hash2))

    def test_aes_256_gcm_encryption_and_decryption(self):
        secret = "sk-proj-super-secret-openai-api-key-xyz-987"
        cipher_hex, nonce_hex, tag_hex = encrypt_secret(secret)

        self.assertIsNotNone(cipher_hex)
        self.assertIsNotNone(nonce_hex)
        self.assertIsNotNone(tag_hex)
        # Nonce is 12 bytes = 24 hex characters
        self.assertEqual(len(nonce_hex), 24)
        # GCM Tag is 16 bytes = 32 hex characters
        self.assertEqual(len(tag_hex), 32)

        # Decrypts correctly
        decrypted = decrypt_secret(cipher_hex, nonce_hex, tag_hex)
        self.assertEqual(decrypted, secret)

    def test_aes_256_gcm_tamper_detection(self):
        secret = "sensitive-gemini-key"
        cipher_hex, nonce_hex, tag_hex = encrypt_secret(secret)

        # Tamper with the ciphertext (flip last character)
        tampered_cipher = cipher_hex[:-1] + ('0' if cipher_hex[-1] != '0' else '1')
        with self.assertRaises(ValueError):
            decrypt_secret(tampered_cipher, nonce_hex, tag_hex)

        # Tamper with the auth tag
        tampered_tag = tag_hex[:-1] + ('0' if tag_hex[-1] != '0' else '1')
        with self.assertRaises(ValueError):
            decrypt_secret(cipher_hex, nonce_hex, tampered_tag)

    def test_jwt_token_lifecycle(self):
        user_id = "test-user-uuid-123"
        workspace_id = "test-ws-uuid-456"

        token = create_access_token(
            subject=user_id,
            workspace_id=workspace_id,
            expires_delta=timedelta(minutes=15)
        )
        self.assertIsInstance(token, str)

        payload = decode_access_token(token)
        self.assertEqual(payload["sub"], user_id)
        self.assertEqual(payload["workspace_id"], workspace_id)
        self.assertEqual(payload["iss"], "recall-ai")

    def test_jwt_token_expiration(self):
        # Create token that expired 5 seconds ago
        token = create_access_token(
            subject="expired-user",
            expires_delta=timedelta(seconds=-5)
        )
        with self.assertRaises(ValueError) as ctx:
            decode_access_token(token)
        self.assertIn("expired", str(ctx.exception).lower())

    def test_jwt_tampered_token_rejected(self):
        token = create_access_token(subject="valid-user")
        # Tamper with signature
        tampered = token[:-4] + "abcd"
        with self.assertRaises(ValueError):
            decode_access_token(tampered)

    def test_mask_key(self):
        self.assertEqual(mask_key("sk-1234567890abcdef"), "...cdef")
        self.assertEqual(mask_key("AIzaSyD-abc1234"), "...1234")
        self.assertEqual(mask_key("abc"), "****")


if __name__ == "__main__":
    unittest.main()
