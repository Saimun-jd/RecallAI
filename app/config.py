# config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ollama_host: str = "http://127.0.0.1:11434"
    ollama_model: str = "gemma3:4b"
    database_url: str = "postgresql://srs_user:srs_pass@localhost:5432/srs"
    prefilter_threshold: float = 0.55
    min_chunk_tokens: int = 40

settings = Settings()