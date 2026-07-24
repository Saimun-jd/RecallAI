# schemas.py
from pydantic import BaseModel, Field
from typing import List, Literal, Optional

class AtomicTopic(BaseModel):
    topic_name: str = Field(description="Short 3-6 word title of the concept")
    concept_type: Literal["Definition", "Key Feature", "Formula", "Comparison", "Process Step", "Code Example", "Diagram", "Cloze"]
    summary: str = Field(description="1-3 sentence self-contained explanation")
    key_terms: List[str] = Field(description="Key domain terms")
    related_code_id: Optional[str] = Field(None, description="If this concept directly relates to a code block, provide its code_id here.")
    related_image_id: Optional[str] = Field(None, description="If this concept directly relates to an image/diagram, provide its img_id here.")

class FlashcardItem(BaseModel):
    concept_type: Literal["Definition", "Key Feature", "Formula", "Comparison", "Process Step", "Code Example", "Diagram", "Cloze"]
    summary: str = Field(description="1-3 sentence self-contained explanation")
    flashcard_question: str = Field(description="Clear test question")
    flashcard_answer: str = Field(description="Complete answer to the question")
    key_terms: List[str] = Field(description="Key domain terms")
    related_code_id: Optional[str] = Field(None, description="If this concept directly relates to a code block, provide its code_id here.")
    related_image_id: Optional[str] = Field(None, description="If this concept directly relates to an image/diagram, provide its img_id here.")

class FlashcardList(BaseModel):
    flashcards: List[FlashcardItem]

class SectionExtraction(BaseModel):
    section_title: str
    atomic_topics: List[AtomicTopic]

class Chunk(AtomicTopic):
    topic_id: Optional[int] = None
    breadcrumb: str
    source_page: Optional[int] = None
    code_snippet: Optional[str] = None
    image_url: Optional[str] = None