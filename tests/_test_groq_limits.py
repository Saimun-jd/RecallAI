import asyncio
from app.llm_providers.openai import OpenAIProvider
from app.config import settings
import json

async def main():
    provider = OpenAIProvider(api_key=settings.openai_api_key, model=settings.openai_model, base_url=settings.openai_base_url)
    
    # Send a prompt of various sizes and see when it hits 413
    for size in [1000, 4000, 8000, 16000, 32000, 64000]:
        prompt = "a" * size
        schema = {"type": "object", "properties": {"b": {"type": "string"}}}
        try:
            print(f"Testing prompt size {size} chars...")
            # Use a smaller max_tokens to test if it's prompt size
            await provider.generate(prompt, schema, max_tokens=10)
            print("Success!")
        except Exception as e:
            print(f"Failed with {type(e)}: {e}")
            break

if __name__ == "__main__":
    asyncio.run(main())
