# config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

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
    gemini_model: str = "gemini-2.5-flash"
    
    # Groq
    groq_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"
    

    
    prefilter_threshold: float = 0.55
    min_chunk_tokens: int = 40

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

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