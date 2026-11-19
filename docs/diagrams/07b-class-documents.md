# 07b · Class diagram: document upload and processing

What happens to a file after upload (`app/services/pipeline.py`, `extractor.py`, `chunker.py`, `storage.py`, `book_sync.py`).

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "primaryColor": "#BFE3FD", "primaryTextColor": "#1f1f1f", "primaryBorderColor": "#5b7fa6", "lineColor": "#555555", "fontFamily": "Segoe UI, Inter, Helvetica, Arial, sans-serif", "fontSize": "16px"}}}%%
classDiagram
    direction LR
    class DocumentProcessingPipeline {
        +process_document(document_id, job_id, workspace_id)
    }
    class StorageService {
        +generate_storage_path(user_id, document_id, file_id)
        +save_file(path, bytes)
        +read_file(path)
        +delete_file(path)
    }
    class ExtractionService {
        +validate_file(content, filename, mime_type)
        +extract(content, filename, mime_type)
    }
    class ExtractedDocument {
        +title
        +total_pages
        +pages
        +full_text
    }
    class SemanticChunker {
        +chunk_document(pages)
        +estimate_tokens(text)
    }
    class EmbeddingService {
        +generate_embeddings(texts) hash only
    }
    class BookSyncService {
        +sync_workspace_books(workspace_id)
        +sync_book_to_all_workspaces(book_id)
    }
    class KnowledgeService {
        +generate_document_summary(document_id)
        +generate_document_concepts(document_id)
    }
    class LegacyBookStore {
        <<module: app/database.py>>
        +save_book(title, file_path, file_hash, total_pages)
        +insert_topics_bulk(book_id, toc)
    }

    DocumentProcessingPipeline --> StorageService : read file
    DocumentProcessingPipeline --> ExtractionService : 1 validate, 2 extract
    ExtractionService ..> ExtractedDocument : returns
    DocumentProcessingPipeline --> SemanticChunker : 3 chunk
    DocumentProcessingPipeline --> EmbeddingService : 4 embed
    BookSyncService --> LegacyBookStore : mirrors books
    KnowledgeService ..> DocumentProcessingPipeline : uses its chunks
```

**As built:** a PDF upload also writes a book and topics to the legacy database (`LegacyBookStore`), and `BookSyncService` copies books between the two databases.

SVG export: [07b-class-documents.svg](07b-class-documents.svg)
