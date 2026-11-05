# Recall AI Architecture and Core Platform

Recall was founded in 2026 as an advanced knowledge and learning platform.
The architecture is designed around high-precision retrieval and active-recall education.

## Core Technology Stack
The ingestion pipeline uses PostgreSQL as its foundational transactional database.
Vector embeddings are indexed using pgvector with HNSW indexing.
FastAPI serves as the backend application framework providing high-throughput asynchronous endpoints.

## Learning Engine
The learning system supports flashcards and quizzes integrated with the Free Spaced Repetition Scheduler (FSRS).
Active-recall intervals are computed dynamically based on student retention metrics and difficulty ratings.
Knowledge Hub allows students to conduct grounded conversational search over their private documents.
