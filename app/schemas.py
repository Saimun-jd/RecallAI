# schemas.py
from pydantic import BaseModel, Field
from typing import List, Literal, Optional

class AtomicTopic(BaseModel):
    topic_name: str = Field(description="Short 3-6 word title of the concept")
    concept_type: Literal["Definition", "Key Feature", "Formula", "Comparison", "Process Step", "Code Example", "Diagram"]
    summary: str = Field(description="1-3 sentence self-contained explanation")
    key_terms: List[str] = Field(description="Key domain terms")
    related_code_id: Optional[str] = Field(None, description="If this concept directly relates to a code block, provide its code_id here.")
    related_image_id: Optional[str] = Field(None, description="If this concept directly relates to an image/diagram, provide its img_id here.")

class FlashcardItem(BaseModel):
    concept_type: Literal["Definition", "Key Feature", "Formula", "Comparison", "Process Step", "Code Example", "Diagram"]
    summary: Optional[str] = Field(None, description="1-3 sentence self-contained explanation (optional)")
    question: str = Field(description="Clear test question")
    answer: str = Field(description="Complete answer to the question")
    key_terms: List[str] = Field(description="Key domain terms")
    related_code_id: Optional[str] = Field(None, description="If this concept directly relates to a code block, provide its code_id here.")
    related_image_id: Optional[str] = Field(None, description="If this concept directly relates to an image/diagram, provide its img_id here.")

class FlashcardList(BaseModel):
    flashcards: List[FlashcardItem]

class SimpleFlashcard(BaseModel):
    question: str
    answer: str

class SimpleFlashcardList(BaseModel):
    flashcards: List[SimpleFlashcard]

class SectionExtraction(BaseModel):
    section_title: str
    atomic_topics: List[AtomicTopic]

class Chunk(AtomicTopic):
    topic_id: Optional[int] = None
    breadcrumb: str
    source_page: Optional[int] = None
    code_snippet: Optional[str] = None
    image_url: Optional[str] = None

# ── Socratic Drill Schemas ──────────────────────────────────────────────

class DiagnosticQuestion(BaseModel):
    """A single probing question generated from topic content."""
    id: str = Field(description="Unique question identifier, e.g. q1, q2")
    tier: Literal["causal_mechanism", "counterfactual", "applied_scenario"] = Field(
        description="Bloom's cognitive tier of the question"
    )
    question_text: str = Field(description="The full probing question text")
    key_invariants: List[str] = Field(
        description="2-4 core concepts the student must demonstrate understanding of to answer correctly"
    )
    socratic_hint: str = Field(
        description="A leading hint that nudges toward the answer without revealing it"
    )
    reference_page: Optional[int] = Field(None, description="The page in the source PDF most relevant to this question")

class DiagnosticQuestionSet(BaseModel):
    """The full set of questions generated for a topic drill."""
    topic_title: str
    questions: List[DiagnosticQuestion]

class SuggestedFlashcard(BaseModel):
    """A flashcard synthesized from a diagnosed knowledge gap."""
    question: str = Field(description="Flashcard question targeting the specific gap")
    answer: str = Field(description="Concise correct answer")
    gap_source: str = Field(description="Brief description of the misconception or gap this card addresses")

class DiagnosticEvaluation(BaseModel):
    """Result of evaluating a student's free-form answer against ground truth."""
    mastery_score: int = Field(ge=0, le=100, description="Overall mastery score 0-100")
    status: Literal["mastered", "developing", "fragile", "misconception"] = Field(
        description="Calibrated mastery status"
    )
    strengths: List[str] = Field(description="Concepts the student demonstrated correctly")
    diagnosed_gaps: List[str] = Field(description="Important concepts omitted or only partially addressed")
    misconceptions: List[str] = Field(description="Actively incorrect beliefs or confusions detected")
    socratic_nudge: Optional[str] = Field(
        None, description="A follow-up thinking prompt if the student was close but missed a nuance"
    )
    suggested_flashcards: List[SuggestedFlashcard] = Field(
        default_factory=list, description="0-2 targeted flashcards for diagnosed gaps"
    )