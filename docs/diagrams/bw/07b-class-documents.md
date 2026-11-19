# 07b · Class diagram: document upload and processing

What happens to a file after upload (`app/services/pipeline.py`, `extractor.py`, `chunker.py`, `storage.py`, `book_sync.py`).

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "primaryColor": "#ffffff", "primaryTextColor": "#000000", "primaryBorderColor": "#000000", "secondaryColor": "#ffffff", "secondaryBorderColor": "#000000", "tertiaryColor": "#ffffff", "tertiaryBorderColor": "#000000", "mainBkg": "#ffffff", "nodeBorder": "#000000", "lineColor": "#000000", "textColor": "#000000", "edgeLabelBackground": "#ffffff", "clusterBkg": "#ffffff", "clusterBorder": "#000000", "actorBkg": "#ffffff", "actorBorder": "#000000", "actorTextColor": "#000000", "actorLineColor": "#000000", "signalColor": "#000000", "signalTextColor": "#000000", "labelBoxBkgColor": "#ffffff", "labelBoxBorderColor": "#000000", "labelTextColor": "#000000", "loopTextColor": "#000000", "noteBkgColor": "#ffffff", "noteBorderColor": "#000000", "noteTextColor": "#000000", "activationBkgColor": "#ffffff", "activationBorderColor": "#000000", "sequenceNumberColor": "#ffffff", "labelBackgroundColor": "#ffffff", "compositeBackground": "#ffffff", "compositeTitleBackground": "#ffffff", "altBackground": "#ffffff", "transitionColor": "#000000", "transitionLabelColor": "#000000", "stateLabelColor": "#000000", "stateBkg": "#ffffff", "fontFamily": "Segoe UI, Inter, Helvetica, Arial, sans-serif"}}}%%
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

SVG export (black and white): [07b-class-documents.svg](07b-class-documents.svg)
