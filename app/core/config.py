"""
Core Configuration for Recall AI.
Centralized, validated environment configuration using Pydantic Settings.
Distinguishes server-only secrets from client-safe configuration.
"""

import os
import sys
from typing import List, Literal
from platformdirs import user_data_dir
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

if hasattr(sys, '_MEIPASS'):
    ENV_PATH = os.path.join(sys._MEIPASS, '.env')
else:
    ENV_PATH = '.env'

DATA_DIR = user_data_dir("Recall", "Recall")
DEFAULT_SQLITE_PATH = os.path.join(DATA_DIR, "recall_saas.db")


class CoreSettings(BaseSettings):
    # Environment Mode
    ENVIRONMENT: Literal["development", "test", "production"] = "development"
    DEBUG: bool = True

    # Security & Auth Secrets (Server-Only)
    # Default provided for dev/test convenience; validated for production below
    SECRET_KEY: str = Field(
        default="recall-ai-dev-secret-key-at-least-32-chars-long!",
        description="Master secret key for signing JWTs. Must be at least 32 characters."
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=60,
        description="JWT token validity duration in minutes."
    )
    BYOK_ENCRYPTION_KEY: str = Field(
        default="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        description="32-byte hex-encoded encryption key for AES-256-GCM BYOK vault."
    )

    # Database
    DATABASE_URL: str = Field(
        default="",
        description="PostgreSQL/Supabase URL or SQLite URL. If empty, defaults to local SQLite."
    )

    # CORS & Network Security
    CORS_ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "tauri://localhost",
        "https://tauri.localhost",
    ]

    # Request Limits
    MAX_REQUEST_BODY_BYTES: int = 10 * 1024 * 1024  # 10 MB default

    # Supabase (Public & Service)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Legacy & AI provider configurations (kept for complete compatibility)
    llm_provider: str = "openai"
    pdf_extractor: str = "pymupdf4llm"
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "gemma3:4b"
    ollama_embedding_model: str = "nomic-embed-text"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"
    openai_embedding_model: str = "text-embedding-3-small"
    datalab_api_key: str = ""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.6-flash"
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-20b"
    langfuse_secret_key: str = ""
    langfuse_public_key: str = ""
    langfuse_host: str = "https://cloud.langfuse.com"

    model_config = SettingsConfigDict(
        env_file=ENV_PATH,
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str, info) -> str:
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long.")
        return v

    @field_validator("BYOK_ENCRYPTION_KEY")
    @classmethod
    def validate_byok_key(cls, v: str) -> str:
        v_clean = v.strip()
        try:
            raw_bytes = bytes.fromhex(v_clean)
            if len(raw_bytes) != 32:
                raise ValueError("BYOK_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters).")
        except ValueError as e:
            raise ValueError(f"Invalid BYOK_ENCRYPTION_KEY format: {e}")
        return v_clean


settings = CoreSettings()
