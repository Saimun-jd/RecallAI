from app.llm_providers.base import BaseLLMProvider
from app.llm_providers.ollama import OllamaProvider
from app.llm_providers.openai import OpenAIProvider
from app.config import Settings

def get_llm_provider(config: Settings) -> BaseLLMProvider:
    provider_type = getattr(config, "llm_provider", "ollama").lower()
    
    if provider_type == "openai":
        return OpenAIProvider(
            api_key=getattr(config, "openai_api_key", ""),
            model=getattr(config, "openai_model", "gpt-4o-mini"),
            base_url=getattr(config, "openai_base_url", "https://api.openai.com/v1")
        )
    else:
        # Default to Ollama
        return OllamaProvider(
            host=getattr(config, "ollama_host", "http://localhost:11434"),
            model=getattr(config, "ollama_model", "gemma2:2b")
        )
