# schemas.py
from pydantic import BaseModel, Field
from typing import List, Literal, Optional

class AtomicTopic(BaseModel):
    topic_name: str = Field(description="Short 3-6 word title of the concept")
    concept_type: Literal["Definition", "Key Feature", "Formula", "Comparison", "Process Step"]
    summary: str = Field(description="1-3 sentence self-contained explanation")
    flashcard_question: str = Field(description="Clear test question")
    flashcard_answer: str = Field(description="Complete answer to the question")
    key_terms: List[str] = Field(description="Key domain terms")

class SectionExtraction(BaseModel):
    section_title: str
    atomic_topics: List[AtomicTopic]

class Chunk(AtomicTopic):
    breadcrumb: str
    source_page: Optional[int] = None