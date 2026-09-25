# Ingestion Pipeline and Data Storage

The ingestion pipeline processes documents into semantic chunks using structural boundary detection.
Extracted text is partitioned into chunks of 1500 characters with 150 character overlap.

## Embeddings and Storage
Embeddings are generated as 1536-dimensional L2-normalized float vectors.
Embeddings are stored in pgvector with cosine distance metrics.
Model versioning ensures that vectors generated with different embedding models are isolated.

## Review Scheduling
Review scheduling is handled by the backend learning analytics engine.
Reviews are prioritized according to forgetting curves and retention targets.
Credit consumption is tracked atomically using transactional usage reservations.
