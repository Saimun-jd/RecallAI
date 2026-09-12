"""
Semantic Document Chunker for Recall AI.
Breaks extracted document content into semantic chunks respecting
headings, paragraphs, and page boundaries with configurable size and overlap.
"""

import re
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel

from app.services.extractor import ExtractedDocument, PageExtraction


class ChunkPayload(BaseModel):
    chunk_index: int
    content: str
    page_number: Optional[int] = None
    token_count: int
    heading_context: Optional[str] = None


class SemanticChunker:
    def __init__(
        self,
        target_chunk_chars: Optional[int] = None,
        chunk_overlap_chars: Optional[int] = None,
        min_chunk_chars: int = 100,
        target_chunk_size: Optional[int] = None,
        overlap_size: Optional[int] = None,
    ):
        self.target_chunk_chars = target_chunk_chars or target_chunk_size or 1500
        self.chunk_overlap_chars = chunk_overlap_chars or overlap_size or 150
        self.min_chunk_chars = min_chunk_chars

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """Estimates token count (~4 characters per token or word heuristic)."""
        if not text:
            return 0
        # Standard heuristic: 1 token ≈ 4 characters, floor at word count
        words = len(text.split())
        char_based = len(text) // 4
        return max(1, max(words, char_based))

    def chunk_document(self, doc_or_pages: Union[ExtractedDocument, List[PageExtraction]]) -> List[ChunkPayload]:
        """
        Chunks an ExtractedDocument or list of PageExtraction while preserving page association and heading context.
        """
        if isinstance(doc_or_pages, ExtractedDocument):
            pages = doc_or_pages.pages
            full_text = doc_or_pages.full_text
        else:
            pages = doc_or_pages
            full_text = "\n\n".join(p.text for p in pages)

        chunks: List[ChunkPayload] = []
        chunk_index = 0
        current_heading: Optional[str] = None

        # Heading detection pattern (# Heading, Chapter X, Section Y, or ALL CAPS line)
        heading_re = re.compile(r'^(#{1,6}\s+.+|Chapter\s+\d+.*|Section\s+\d+.*|[A-Z0-9\s]{4,40})$', re.IGNORECASE)

        for page in pages:
            page_text = page.text
            if not page_text.strip():
                continue

            # Split page into structural blocks (paragraphs / headings)
            blocks = page_text.split("\n\n")
            current_buffer = ""
            buffer_heading = current_heading

            for block in blocks:
                block_clean = block.strip()
                if not block_clean:
                    continue

                # Check if block is a heading
                first_line = block_clean.split("\n")[0].strip()
                if heading_re.match(first_line) and len(first_line) < 80:
                    current_heading = first_line.lstrip("#").strip()
                    buffer_heading = current_heading

                # If appending would exceed target, flush current buffer
                if current_buffer and (len(current_buffer) + len(block_clean) + 2 > self.target_chunk_chars):
                    if len(current_buffer) >= self.min_chunk_chars:
                        chunks.append(ChunkPayload(
                            chunk_index=chunk_index,
                            content=current_buffer.strip(),
                            page_number=page.page_number,
                            token_count=self.estimate_tokens(current_buffer),
                            heading_context=buffer_heading
                        ))
                        chunk_index += 1

                        # Keep overlap from the end of current buffer
                        if self.chunk_overlap_chars > 0 and len(current_buffer) > self.chunk_overlap_chars:
                            overlap = current_buffer[-self.chunk_overlap_chars:]
                            current_buffer = overlap + "\n\n" + block_clean
                        else:
                            current_buffer = block_clean
                    else:
                        current_buffer += "\n\n" + block_clean
                else:
                    if current_buffer:
                        current_buffer += "\n\n" + block_clean
                    else:
                        current_buffer = block_clean

            # Flush remaining buffer for the page
            if current_buffer and len(current_buffer) >= self.min_chunk_chars:
                chunks.append(ChunkPayload(
                    chunk_index=chunk_index,
                    content=current_buffer.strip(),
                    page_number=page.page_number,
                    token_count=self.estimate_tokens(current_buffer),
                    heading_context=buffer_heading
                ))
                chunk_index += 1

        # If document had content but produced 0 chunks (all below min), create one single chunk
        if not chunks and full_text.strip():
            chunks.append(ChunkPayload(
                chunk_index=0,
                content=full_text.strip(),
                page_number=1,
                token_count=self.estimate_tokens(full_text),
                heading_context=None
            ))

        return chunks

    @classmethod
    def chunk_text(
        cls,
        text: str,
        page_number: int = 1,
        start_index: int = 0
    ) -> List[ChunkPayload]:
        chunker = cls()
        estimated = chunker.estimate_tokens(text)
        return [
            ChunkPayload(
                chunk_index=start_index,
                content=text,
                page_number=page_number,
                token_count=estimated,
                heading_context=None
            )
        ]


chunker = SemanticChunker()
