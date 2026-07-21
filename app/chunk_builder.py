from app.schemas import Chunk, SectionExtraction

def build_chunks(section_ext: SectionExtraction, chapter_title: str, page_num: int | None = None) -> list[Chunk]:
    chunks = []
    
    breadcrumb_root = chapter_title if chapter_title else "Untitled Chapter"
    
    for topic in section_ext.atomic_topics:
        breadcrumb = f"{breadcrumb_root} > {section_ext.section_title} > {topic.topic_name}"
        
        # We copy all properties from the atomic topic, and add breadcrumb and source_page
        chunks.append(Chunk(
            breadcrumb=breadcrumb,
            topic_name=topic.topic_name,
            concept_type=topic.concept_type,
            summary=topic.summary,
            flashcard_question=topic.flashcard_question,
            flashcard_answer=topic.flashcard_answer,
            key_terms=topic.key_terms,
            source_page=page_num
        ))
        
    return chunks