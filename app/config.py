# config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    llm_provider: str = "openai"  # "ollama" or "openai"
    
    # Ollama settings
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "gemma3:4b"
    ollama_embedding_model: str = "nomic-embed-text"
    
    # OpenAI compatible settings
    openai_api_key: str = "REDACTED"
    openai_model: str = "llama-3.1-8b-instant"
    openai_base_url: str = "https://api.groq.com/openai/v1"
    openai_embedding_model: str = "text-embedding-3-small"
    
    database_url: str = "postgresql://srs_user:srs_pass@localhost:5432/srs"
    prefilter_threshold: float = 0.55
    min_chunk_tokens: int = 40

settings = Settings()