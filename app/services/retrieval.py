"""
Centralized Knowledge Retrieval & Semantic Search Service for Recall AI.
Provides unified query processing, hybrid vector/keyword candidate search,
diversity filtering (neighbor suppression), score fusion, and context building.
"""

import json
import logging
import math
import re
from typing import Any, Dict, List, Optional, Set, Tuple

try:
    import numpy as np
    HAVE_NUMPY = True
except ImportError:
    HAVE_NUMPY = False

from app.models.repositories import ChunkRepository
from app.schemas.search import (
    SearchResultItem,
    SearchResponse,
    StructuredContext,
)
from app.services.chunker import SemanticChunker
from app.services.embedding import EmbeddingService

logger = logging.getLogger(__name__)

STOPWORDS: Set[str] = {
    "a", "an", "the", "and", "or", "but", "if", "because", "as", "what",
    "which", "this", "that", "these", "those", "then", "just", "so", "than",
    "such", "both", "through", "about", "for", "is", "of", "while", "during",
    "to", "from", "in", "out", "on", "off", "again", "further", "then", "once",
    "here", "there", "when", "where", "why", "how", "all", "any", "both",
    "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not",
    "only", "own", "same", "so", "than", "too", "very", "can", "will", "are",
    "was", "were", "be", "been", "being", "have", "has", "had", "having",
    "do", "does", "did", "doing", "at", "by", "with", "into", "it"
}


class QueryProcessor:
    """Normalizes and extracts keywords from search queries."""

    MIN_QUERY_LENGTH = 2
    MAX_QUERY_LENGTH = 500

    @classmethod
    def normalize(cls, query: str) -> str:
        """Strips control characters, normalizes whitespace, and trims."""
        if not query:
            return ""
        # Remove control chars
        cleaned = re.sub(r'[\x00-\x1f\x7f]', ' ', query)
        # Collapse repeated whitespace
        cleaned = re.sub(r'\s+', ' ', cleaned)
        return cleaned.strip()[:cls.MAX_QUERY_LENGTH]

    @classmethod
    def is_valid(cls, query: str) -> bool:
        """Checks if query satisfies minimal searchable length without being blank."""
        norm = cls.normalize(query)
        return len(norm) >= cls.MIN_QUERY_LENGTH

    @classmethod
    def extract_keywords(cls, query: str) -> List[str]:
        """Extracts significant alphanumeric search terms, filtering stopwords."""
        norm = cls.normalize(query).lower()
        tokens = re.findall(r'\b[a-z0-9_]{2,40}\b', norm)
        significant = [t for t in tokens if t not in STOPWORDS]
        return significant if significant else tokens


class VectorSearcher:
    """Computes cosine similarity for chunk embeddings using numpy or pure Python."""

    TARGET_MODEL = "text-embedding-3-small"
    TARGET_VERSION = 1

    @classmethod
    def compute_similarity(cls, query_vec: List[float], chunk_vec: List[float]) -> float:
        """Computes dot product (cosine similarity for L2-normalized vectors)."""
        if not query_vec or not chunk_vec or len(query_vec) != len(chunk_vec):
            return 0.0

        if HAVE_NUMPY:
            q = np.array(query_vec, dtype=np.float32)
            c = np.array(chunk_vec, dtype=np.float32)
            sim = float(np.dot(q, c))
        else:
            sim = sum(a * b for a, b in zip(query_vec, chunk_vec))

        # Clamp to [0.0, 1.0] range
        return max(0.0, min(1.0, (sim + 1.0) / 2.0))


class KeywordSearcher:
    """Computes lexical term match and token overlap score."""

    @classmethod
    def score_chunk(cls, query_keywords: List[str], full_query: str, content: str, title: str) -> float:
        if not query_keywords:
            return 0.0

        content_lower = content.lower()
        title_lower = title.lower()

        # Check full exact phrase match boost
        phrase_boost = 0.3 if (full_query and full_query.lower() in content_lower) else 0.0
        title_boost = 0.2 if (full_query and full_query.lower() in title_lower) else 0.0

        matched_count = 0
        for kw in query_keywords:
            if kw in content_lower:
                matched_count += 1
            elif kw in title_lower:
                matched_count += 0.8

        keyword_ratio = matched_count / len(query_keywords)
        raw_score = 0.5 * keyword_ratio + phrase_boost + title_boost
        return max(0.0, min(1.0, raw_score))


class DiversityFilter:
    """
    Prevents repetitive retrieval of adjacent chunks from the same document section.
    Dampens score of neighbor chunks (index - 1, index + 1) already selected.
    """

    NEIGHBOR_DAMPENING_FACTOR = 0.75

    @classmethod
    def apply_diversity(
        cls,
        candidates: List[Dict[str, Any]],
        limit: int
    ) -> List[Dict[str, Any]]:
        if not candidates or len(candidates) <= 1:
            return candidates[:limit]

        selected: List[Dict[str, Any]] = []
        # Track (document_id, chunk_index) of chosen chunks
        chosen_indices: Set[Tuple[str, int]] = set()

        # Copy candidates so we don't mutate input
        pool = list(candidates)

        while pool and len(selected) < limit:
            # Pick highest scoring candidate in current pool
            best = max(pool, key=lambda x: x["final_score"])
            pool.remove(best)
            selected.append(best)

            doc_id = best["document_id"]
            c_idx = best["chunk_index"]
            chosen_indices.add((doc_id, c_idx))

            # Apply dampening to remaining pool candidates adjacent to chosen chunks
            for item in pool:
                if item["document_id"] == doc_id and abs(item["chunk_index"] - c_idx) == 1:
                    item["final_score"] = round(item["final_score"] * cls.NEIGHBOR_DAMPENING_FACTOR, 4)

        return selected


class ContextBuilder:
    """Builds token-budgeted structured prompt context with source citations."""

    DEFAULT_MAX_TOKENS = 3000

    @classmethod
    def build_structured_context(
        cls,
        results: List[SearchResultItem],
        max_tokens: int = DEFAULT_MAX_TOKENS
    ) -> StructuredContext:
        if not results:
            return StructuredContext(text="", sources=[], total_tokens=0)

        context_parts: List[str] = []
        sources: List[Dict[str, Any]] = []
        current_tokens = 0

        for idx, r in enumerate(results, start=1):
            page_info = f" (Page {r.page_number})" if r.page_number else ""
            block = (
                f"### [Source {idx}]: {r.document_title}{page_info}\n"
                f"{r.content.strip()}\n"
            )
            block_tokens = SemanticChunker.estimate_tokens(block)

            if current_tokens + block_tokens > max_tokens and context_parts:
                # Token limit reached, stop adding chunks
                break

            context_parts.append(block)
            current_tokens += block_tokens
            sources.append({
                "source_index": idx,
                "document_id": r.document_id,
                "document_title": r.document_title,
                "chunk_id": r.chunk_id,
                "page_number": r.page_number,
                "score": r.score,
            })

        formatted_text = "\n".join(context_parts)
        return StructuredContext(
            text=formatted_text,
            sources=sources,
            total_tokens=current_tokens
        )


class RetrievalService:
    """
    Centralized Knowledge Retrieval Service.
    Single reusable entrypoint for Semantic, Keyword, and Hybrid knowledge retrieval.
    """

    DEFAULT_SIMILARITY_THRESHOLD = 0.25
    HYBRID_ALPHA = 0.7  # 70% vector similarity, 30% keyword relevance

    @classmethod
    def search(
        cls,
        query: str,
        workspace_id: str,
        document_id: Optional[str] = None,
        mode: str = "hybrid",
        limit: int = 10,
        similarity_threshold: Optional[float] = None,
    ) -> SearchResponse:
        """
        Executes unified knowledge retrieval scoped to workspace and optional document.
        Supported modes: 'hybrid', 'semantic', 'keyword'.
        """
        threshold = similarity_threshold if similarity_threshold is not None else cls.DEFAULT_SIMILARITY_THRESHOLD
        clean_query = QueryProcessor.normalize(query)

        # Fast rejection on empty / short query without external API cost
        if not QueryProcessor.is_valid(clean_query):
            return SearchResponse(
                query=clean_query,
                total_results=0,
                mode=mode,
                results=[]
            )

        keywords = QueryProcessor.extract_keywords(clean_query)

        # 1. Fetch Candidate Chunks
        # Query up to 300 candidates scoped to tenant workspace
        raw_candidates = ChunkRepository.search_candidates(
            workspace_id=workspace_id,
            document_id=document_id,
            limit=300
        )

        if not raw_candidates:
            return SearchResponse(
                query=clean_query,
                total_results=0,
                mode=mode,
                results=[]
            )

        # 2. Query Embedding (only if semantic or hybrid mode)
        query_vec: Optional[List[float]] = None
        if mode in ("hybrid", "semantic"):
            query_vec = EmbeddingService.generate_embedding(
                clean_query,
                workspace_id=workspace_id
            )

        # 3. Score Each Candidate Chunk
        scored_candidates: List[Dict[str, Any]] = []
        for c in raw_candidates:
            # Model consistency check
            emb_model = c.get("embedding_model")
            emb_version = c.get("embedding_version")
            if emb_model != VectorSearcher.TARGET_MODEL or emb_version != VectorSearcher.TARGET_VERSION:
                # Incompatible embedding version - skip or flag for reindex
                continue

            semantic_score = 0.0
            if query_vec and c.get("embedding"):
                try:
                    raw_emb = c["embedding"]
                    c_vec = json.loads(raw_emb) if isinstance(raw_emb, str) else raw_emb
                    if isinstance(c_vec, list):
                        semantic_score = VectorSearcher.compute_similarity(query_vec, c_vec)
                except Exception as e:
                    logger.debug("Failed to parse chunk embedding: %s", e)
                    semantic_score = 0.0

            keyword_score = 0.0
            if mode in ("hybrid", "keyword") and keywords:
                keyword_score = KeywordSearcher.score_chunk(
                    query_keywords=keywords,
                    full_query=clean_query,
                    content=c["content"],
                    title=c["document_title"]
                )

            # Mode-specific fusion
            if mode == "semantic":
                final_score = semantic_score
                match_type = "semantic"
            elif mode == "keyword":
                final_score = keyword_score
                match_type = "keyword"
            else:  # hybrid
                final_score = (cls.HYBRID_ALPHA * semantic_score) + ((1.0 - cls.HYBRID_ALPHA) * keyword_score)
                match_type = "hybrid"

            final_score = round(final_score, 4)

            # Minimum relevance threshold check
            if final_score >= threshold:
                scored_candidates.append({
                    "chunk_id": c["id"],
                    "document_id": c["document_id"],
                    "document_title": c["document_title"],
                    "chunk_index": c["chunk_index"],
                    "content": c["content"],
                    "page_number": c.get("page_number"),
                    "token_count": c.get("token_count", SemanticChunker.estimate_tokens(c["content"])),
                    "final_score": final_score,
                    "match_type": match_type
                })

        # 4. Diversity / Neighbor Suppression
        diverse_results = DiversityFilter.apply_diversity(
            candidates=scored_candidates,
            limit=limit
        )

        # 5. Build Final SearchResultItem List
        result_items = [
            SearchResultItem(
                chunk_id=item["chunk_id"],
                document_id=item["document_id"],
                document_title=item["document_title"],
                content=item["content"],
                page_number=item.get("page_number"),
                token_count=item["token_count"],
                score=item["final_score"],
                match_type=item["match_type"]
            )
            for item in diverse_results
        ]

        logger.info(
            "Search query='%s' mode=%s yielded %d results in workspace=%s",
            clean_query, mode, len(result_items), workspace_id
        )

        return SearchResponse(
            query=clean_query,
            total_results=len(result_items),
            mode=mode,
            results=result_items
        )

    @classmethod
    def build_context(
        cls,
        results: List[SearchResultItem],
        max_tokens: int = ContextBuilder.DEFAULT_MAX_TOKENS
    ) -> StructuredContext:
        """Helper to build structured prompt context with citations from search results."""
        return ContextBuilder.build_structured_context(results, max_tokens=max_tokens)


retrieval_service = RetrievalService()
