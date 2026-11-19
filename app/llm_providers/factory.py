from app.llm_providers.base import BaseLLMProvider
from app.llm_providers.ollama import OllamaProvider
from app.llm_providers.openai import OpenAIProvider
from app.llm_providers.gemini import GeminiProvider
from app.llm_providers.groq import GroqProvider
from app.config import Settings
from app.database import get_setting

DEFAULT_MODELS = {
    "gemini": "gemini-flash-latest",
    "openai": "gpt-4o-mini",
    "ollama": "gemma2:2b",
    "groq": "openai/gpt-oss-20b",
}

def get_llm_provider(config: Settings, provider_override: str = None) -> BaseLLMProvider:
    import json

    db_prov = get_setting("llm_provider")
    db_config = {}
    if db_prov:
        try:
            db_config = json.loads(db_prov)
        except Exception:
            pass

    db_type = db_config.get("type", "ollama").lower()
    target_provider = (provider_override.lower() if provider_override
                        else db_type or getattr(config, "llm_provider", "ollama").lower())

    # Only trust the DB's saved model/host/base_url when it was saved
    # for this SAME provider type. Otherwise it's a leftover from a
    # different provider and must not be reused.
    db_matches_target = db_type == target_provider
    saved_model = db_config.get("model") if db_matches_target else None
    model_name = saved_model or getattr(
        config, f"{target_provider}_model", DEFAULT_MODELS.get(target_provider, "gemini-1.5-flash")
    )

    import logging
    logger = logging.getLogger(__name__)

    if target_provider == "openai":
        api_key = get_setting("openai_api_key") or getattr(config, "openai_api_key", "")
        base_url = (db_config.get("base_url") if db_matches_target else None) \
            or getattr(config, "openai_base_url", "https://api.openai.com/v1")
        logger.debug(f"LLM Factory returning OpenAIProvider with model {model_name}")
        return OpenAIProvider(api_key=api_key, model=model_name, base_url=base_url)

    elif target_provider == "gemini":
        api_key = get_setting("gemini_api_key") or getattr(config, "gemini_api_key", "")
        logger.debug(f"LLM Factory returning GeminiProvider with model {model_name}")
        return GeminiProvider(api_key=api_key, model=model_name)

    elif target_provider == "groq":
        api_key = get_setting("groq_api_key") or getattr(config, "groq_api_key", "")
        logger.debug(f"LLM Factory returning GroqProvider with model {model_name}")
        return GroqProvider(api_key=api_key, model=model_name)

    else:
        host = get_setting("ollama_host") \
            or (db_config.get("host") if db_matches_target else None) \
            or getattr(config, "ollama_host", "http://localhost:11434")
        logger.debug(f"LLM Factory returning OllamaProvider on {host} with model {model_name}")
        return OllamaProvider(host=host, model=model_name)