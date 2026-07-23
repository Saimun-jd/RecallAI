import asyncio
import os
from app.llm_segment import extract_atomic_concepts

async def test_openai():
    text = "The MNIST dataset is a collection of 70000 images of handwritten digits."
    print("Testing extraction with OpenAI...")
    try:
        result = await extract_atomic_concepts("MNIST", text, provider_override="openai")
        print("Success!")
        print(result)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(test_openai())
