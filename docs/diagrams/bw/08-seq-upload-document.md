# 08 · Sequence: upload a PDF

`POST /api/v1/documents/upload` (`app/api/v1/documents.py`), then the background pipeline (`app/services/pipeline.py`).

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "primaryColor": "#ffffff", "primaryTextColor": "#000000", "primaryBorderColor": "#000000", "secondaryColor": "#ffffff", "secondaryBorderColor": "#000000", "tertiaryColor": "#ffffff", "tertiaryBorderColor": "#000000", "mainBkg": "#ffffff", "nodeBorder": "#000000", "lineColor": "#000000", "textColor": "#000000", "edgeLabelBackground": "#ffffff", "clusterBkg": "#ffffff", "clusterBorder": "#000000", "actorBkg": "#ffffff", "actorBorder": "#000000", "actorTextColor": "#000000", "actorLineColor": "#000000", "signalColor": "#000000", "signalTextColor": "#000000", "labelBoxBkgColor": "#ffffff", "labelBoxBorderColor": "#000000", "labelTextColor": "#000000", "loopTextColor": "#000000", "noteBkgColor": "#ffffff", "noteBorderColor": "#000000", "noteTextColor": "#000000", "activationBkgColor": "#ffffff", "activationBorderColor": "#000000", "sequenceNumberColor": "#ffffff", "labelBackgroundColor": "#ffffff", "compositeBackground": "#ffffff", "compositeTitleBackground": "#ffffff", "altBackground": "#ffffff", "transitionColor": "#000000", "transitionLabelColor": "#000000", "stateLabelColor": "#000000", "stateBkg": "#ffffff", "fontFamily": "Segoe UI, Inter, Helvetica, Arial, sans-serif"}}}%%
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

SVG export (black and white): [08-seq-upload-document.svg](08-seq-upload-document.svg)
