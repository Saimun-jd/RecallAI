import asyncio
import sys
from app.llm_segment import extract_atomic_concepts
from app.config import settings

async def main():
    heading = "MNIST"
    text = "In this chapter, we will be using the MNIST dataset, which is a set of 70,000 small images of digits handwritten by high school students and employees of the US Cen- sus Bureau."
    print("Testing extraction with Ollama...")
    try:
        res = await extract_atomic_concepts(heading, text, provider_override="ollama")
        print("Success!")
        print(res)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
