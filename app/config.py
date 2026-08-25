# config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

import sys
import os

if hasattr(sys, '_MEIPASS'):
    ENV_PATH = os.path.join(sys._MEIPASS, '.env')
else:
    ENV_PATH = '.env'

class Settings(BaseSettings):
    llm_provider: str = "openai"  # "ollama" or "openai"
    
    # Ollama settings
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "gemma3:4b"
    ollama_embedding_model: str = "nomic-embed-text"
    
    # OpenAI compatible settings
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"
    openai_embedding_model: str = "text-embedding-3-small"
    
    # Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.6-flash"
    
    # Groq
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-20b"
    
    # Langfuse
    langfuse_secret_key: str = ""
    langfuse_public_key: str = ""
    langfuse_host: str = "https://cloud.langfuse.com"

    
    prefilter_threshold: float = 0.55
    min_chunk_tokens: int = 40

    # Supabase Settings
    supabase_url: str = ""
    supabase_anon_key: str = ""

    # Error system: debug_mode=True shows full tracebacks in API responses.
    # Set RECALL_DEBUG=0 in production builds to hide internal details.
    debug_mode: bool = True

    model_config = SettingsConfigDict(env_file=ENV_PATH, env_file_encoding="utf-8")

settings = Settings()

PROVIDER_CONCURRENCY = {
    "ollama": 2,
    "openai": 10,
    "gemini": 10,
    "groq": 15,
}

def get_provider_concurrency(provider_name: str | None = None) -> int:
    if not provider_name:
        provider_name = settings.llm_provider
    provider_name = provider_name.lower().strip()
    return PROVIDER_CONCURRENCY.get(provider_name, 5)