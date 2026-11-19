# 09 · Sequence: chat with your documents

`POST /api/v1/conversations/{id}/messages` → `RAGService.execute_rag_stream` (`app/services/rag.py`).

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "primaryColor": "#BFE3FD", "primaryTextColor": "#1f1f1f", "primaryBorderColor": "#5b7fa6", "lineColor": "#555555", "actorBkg": "#FEC8C3", "actorBorder": "#c98a84", "noteBkgColor": "#FFF1B8", "noteBorderColor": "#d9c27a", "fontFamily": "Segoe UI, Inter, Helvetica, Arial, sans-serif"}}}%%
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

SVG export: [09-seq-chat.svg](09-seq-chat.svg)
