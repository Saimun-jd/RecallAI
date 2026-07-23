from app.schemas import Chunk, SectionExtraction

import re

def strip_asset_tags(text: str) -> str:
    """Removes any [ASSET: id] markers that might have leaked into the text."""
    if text:
        return re.sub(r'\[ASSET:\s*[^\]]+\]\s*', '', text)
    return text

def build_chunks(section_ext: SectionExtraction, chapter_title: str, page_num: int | None = None, code_blocks: dict = None, images: dict = None) -> list[Chunk]:
    code_blocks = code_blocks or {}
    images = images or {}
    chunks = []
    
    breadcrumb_root = chapter_title if chapter_title else "Untitled Chapter"
    
    for topic in section_ext.atomic_topics:
        breadcrumb = f"{breadcrumb_root} > {section_ext.section_title} > {topic.topic_name}"
        
        code_snippet = None
        if topic.related_code_id and topic.related_code_id in code_blocks:
            code_snippet = f"```{code_blocks[topic.related_code_id]['language']}\n{code_blocks[topic.related_code_id]['code']}\n```"
            
        image_url = None
        if topic.related_image_id and topic.related_image_id in images:
            image_url = images[topic.related_image_id]
        
        # We copy all properties from the atomic topic, and add breadcrumb and source_page
        chunks.append(Chunk(
            breadcrumb=breadcrumb,
            topic_name=strip_asset_tags(topic.topic_name),
            concept_type=topic.concept_type,
            summary=strip_asset_tags(topic.summary),
            flashcard_question=strip_asset_tags(topic.flashcard_question),
            flashcard_answer=strip_asset_tags(topic.flashcard_answer),
            key_terms=topic.key_terms,
            related_code_id=topic.related_code_id,
            related_image_id=topic.related_image_id,
            source_page=page_num,
            code_snippet=code_snippet,
            image_url=image_url
        ))
        
    return chunks