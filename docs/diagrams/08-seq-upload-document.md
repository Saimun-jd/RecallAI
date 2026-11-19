# 08 · Sequence: upload a PDF

`POST /api/v1/documents/upload` (`app/api/v1/documents.py`), then the background pipeline (`app/services/pipeline.py`).

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "primaryColor": "#BFE3FD", "primaryTextColor": "#1f1f1f", "primaryBorderColor": "#5b7fa6", "lineColor": "#555555", "actorBkg": "#FEC8C3", "actorBorder": "#c98a84", "noteBkgColor": "#FFF1B8", "noteBorderColor": "#d9c27a", "fontFamily": "Segoe UI, Inter, Helvetica, Arial, sans-serif"}}}%%
sequenceDiagram
    autonumber
    actor S as Student
    participant UI as Desktop UI (React)
    participant API as FastAPI /api/v1/documents
    participant ST as StorageService
    participant L as recall.db (legacy)
    participant DB as recall_saas.db
    participant P as Pipeline (background task)

    S->>UI: Choose PDF
    UI->>API: POST /upload (file, Bearer token)
    API->>DB: Check plan limit (EntitlementService)
    API->>ST: save_file(users/{uid}/documents/...)
    API->>DB: Insert file record
    API->>L: save_book (reuses book if same hash)
    API->>L: insert_topics_bulk (table of contents)
    API->>DB: Insert document (status "uploading") + processing job
    API-->>UI: 200 {document_id, job_id, book_id}
    API->>P: add_task(process_document)
    Note over P: Runs after the response is sent
    P->>ST: read_file
    P->>P: validate → extract pages → chunk (1500 tokens)
    P->>P: generate_embeddings (hash-based, not AI)
    P->>DB: Save chunks, job "completed", document "ready"
    UI->>API: Poll document / job status
    API-->>UI: status "ready"
```

**As built:** step 6 links the upload to an existing book with the same file hash, even one owned by another user. Step 13's embeddings are not from an AI model.

SVG export: [08-seq-upload-document.svg](08-seq-upload-document.svg)
