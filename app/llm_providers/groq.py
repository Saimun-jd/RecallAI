from app.llm_providers.openai import OpenAIProvider

class GroqProvider(OpenAIProvider):
    def __init__(self, api_key: str, model: str = "openai/gpt-oss-20b", base_url: str = "https://api.groq.com/openai/v1"):
        super().__init__(api_key=api_key, model=model, base_url=base_url)
