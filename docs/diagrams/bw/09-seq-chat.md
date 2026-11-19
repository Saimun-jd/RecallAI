# 09 · Sequence: chat with your documents

`POST /api/v1/conversations/{id}/messages` → `RAGService.execute_rag_stream` (`app/services/rag.py`).

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "primaryColor": "#ffffff", "primaryTextColor": "#000000", "primaryBorderColor": "#000000", "secondaryColor": "#ffffff", "secondaryBorderColor": "#000000", "tertiaryColor": "#ffffff", "tertiaryBorderColor": "#000000", "mainBkg": "#ffffff", "nodeBorder": "#000000", "lineColor": "#000000", "textColor": "#000000", "edgeLabelBackground": "#ffffff", "clusterBkg": "#ffffff", "clusterBorder": "#000000", "actorBkg": "#ffffff", "actorBorder": "#000000", "actorTextColor": "#000000", "actorLineColor": "#000000", "signalColor": "#000000", "signalTextColor": "#000000", "labelBoxBkgColor": "#ffffff", "labelBoxBorderColor": "#000000", "labelTextColor": "#000000", "loopTextColor": "#000000", "noteBkgColor": "#ffffff", "noteBorderColor": "#000000", "noteTextColor": "#000000", "activationBkgColor": "#ffffff", "activationBorderColor": "#000000", "sequenceNumberColor": "#ffffff", "labelBackgroundColor": "#ffffff", "compositeBackground": "#ffffff", "compositeTitleBackground": "#ffffff", "altBackground": "#ffffff", "transitionColor": "#000000", "transitionLabelColor": "#000000", "stateLabelColor": "#000000", "stateBkg": "#ffffff", "fontFamily": "Segoe UI, Inter, Helvetica, Arial, sans-serif"}}}%%
sequenceDiagram
    autonumber
    actor S as Student
    participant UI as Chat panel
    participant API as FastAPI /conversations
    participant RAG as RAGService
    participant ENT as EntitlementService
    participant RET as RetrievalService
    participant AI as AIService
    participant LLM as Gemini / OpenAI / Ollama
    participant DB as recall_saas.db

    S->>UI: Ask a question
    UI->>API: POST /messages (stream)
    API->>RAG: execute_rag_stream
    RAG->>DB: Check conversation belongs to workspace
    RAG->>AI: resolve_adapter (saved key → server key → mock)
    RAG->>ENT: reserve_usage (0 credits if own key)
    RAG->>DB: Save user message
    RAG->>RET: search(query, hybrid, limit 5)
    RET->>DB: Load up to 300 chunks
    RET->>RET: keyword score + vector score (hash vectors)
    RET-->>RAG: top 5 chunks
    RAG->>DB: Load history (oldest 7 messages)
    RAG->>AI: generate_stream(system + history + [S1..S5] + question)
    AI->>LLM: API call
    loop each token
        LLM-->>AI: token
        AI-->>UI: SSE "token"
    end
    RAG->>RAG: CitationValidator: keep cited S-numbers that exist
    RAG->>DB: Save answer + "verified" sources
    RAG->>ENT: finalize_usage
    RAG-->>UI: SSE "done" (sources, credits left)
    alt provider error (e.g. 503)
        AI-->>UI: SSE "error" with raw provider text
    end
```

**As built:** step 12 loads the oldest messages, not the latest. Step 17 marks a source "verified" if its S-number exists, not if it supports the answer.

SVG export (black and white): [09-seq-chat.svg](09-seq-chat.svg)
