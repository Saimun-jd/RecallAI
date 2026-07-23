import asyncio
import json
from app.pdf_extract import extract_raw_text
from app.heading_detect import detect_headings
from app.llm_segment import extract_atomic_concepts
from app.schemas import SectionExtraction

async def main():
    md_text, _, _ = extract_raw_text("Hands_On_Machine_Learning_with_Scikit_Learn_Keras_and_Tensorflow.pdf", start_page=113)
    sections = detect_headings(md_text, 113)
    
    target_sec = None
    for sec in sections:
        if "mnist" in sec["heading"].lower():
            target_sec = sec
            break
            
    # Mock the openai provider to just print the payload size
    from app.llm_providers.openai import OpenAIProvider
    class MockProvider(OpenAIProvider):
        async def generate(self, prompt, json_schema, temperature=0.1, max_tokens=4096):
            prompt_with_schema = f"{prompt}\n\nIMPORTANT: You must return a valid JSON object. Your JSON object must strictly adhere to the following JSON schema. Do not return the schema itself, return the data formatted according to the schema:\n{json.dumps(json_schema)}"
            payload = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt_with_schema}],
                "temperature": temperature,
                "max_tokens": max_tokens,
                "response_format": {
                    "type": "json_object"
                }
            }
            payload_str = json.dumps(payload)
            print(f"Payload size: {len(payload_str)} bytes")
            print(f"Messages content length: {len(prompt_with_schema)} chars")
            return "{}"

    import app.llm_segment
    app.llm_segment.get_llm_provider = lambda x: MockProvider(api_key="mock", model="mock")
    
    try:
        await extract_atomic_concepts(target_sec["heading"], target_sec["text"], {}, {}, "openai")
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
