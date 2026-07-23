import asyncio
import os
from app.config import settings
from app.llm_segment import extract_atomic_concepts

async def test_ollama():
    print("=== Testing Ollama Provider ===")
    settings.llm_provider = "ollama"
    # Ensure this model is pulled on your machine, e.g., 'ollama run gemma2:2b'
    settings.ollama_model = "gemma2:2b" 
    
    try:
        result = await extract_atomic_concepts(
            heading="Test Heading",
            text="Machine learning is a field of study in artificial intelligence characterized by the development of statistical algorithms that can learn from data and generalize to unseen data, and thus perform tasks without explicit instructions.",
        )
        print("Success! Extracted Topics:")
        for topic in result.atomic_topics:
            print(f"- {topic.topic_name}: {topic.summary}")
    except Exception as e:
        print(f"Ollama test failed: {e}")
        print("Hint: Make sure Ollama is running and the model is pulled ('ollama pull gemma2:2b').")

async def test_openai():
    print("\n=== Testing OpenAI/Cloud Provider ===")
    settings.llm_provider = "openai"
    
    # You can put your real API key here to test it, or use OpenRouter
    api_key = os.getenv("OPENAI_API_KEY", "REDACTED")
    
    if api_key == "YOUR_API_KEY_HERE":
        print("Skipping OpenAI test because no API key is provided.")
        print("To test, set OPENAI_API_KEY environment variable or edit this script.")
        return

    settings.openai_api_key = api_key
    settings.openai_model = "llama-3.1-8b-instant"
    settings.openai_base_url = "https://api.groq.com/openai/v1"
    
    try:
        result = await extract_atomic_concepts(
            heading="Test Heading",
            text="Machine learning is a field of study in artificial intelligence characterized by the development of statistical algorithms that can learn from data and generalize to unseen data, and thus perform tasks without explicit instructions.",
        )
        print("Success! Extracted Topics:")
        for topic in result.atomic_topics:
            print(f"- {topic.topic_name}: {topic.summary}")
    except Exception as e:
        print(f"OpenAI test failed: {e}")

async def main():
    await test_ollama()
    await test_openai()

if __name__ == "__main__":
    asyncio.run(main())
