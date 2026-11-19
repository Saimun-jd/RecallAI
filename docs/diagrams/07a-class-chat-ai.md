# 07a · Class diagram: chat, search and AI providers

How a chat answer is produced (`app/services/rag.py`, `retrieval.py`, `embedding.py`, `ai/`).

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "primaryColor": "#BFE3FD", "primaryTextColor": "#1f1f1f", "primaryBorderColor": "#5b7fa6", "lineColor": "#555555", "fontFamily": "Segoe UI, Inter, Helvetica, Arial, sans-serif", "fontSize": "16px"}}}%%
classDiagram
    direction LR
    class RAGService {
        +execute_rag(workspace_id, conversation_id, query)
        +execute_rag_stream(workspace_id, conversation_id, query)
        -_build_context_prompt(query, results, history)
    }
    class CitationValidator {
        +validate(response_text, retrieved_results)
    }
    class EntitlementService {
        +reserve_usage(workspace_id, feature)
        +finalize_usage(reservation)
        +release_usage(reservation)
    }
    class RetrievalService {
        +search(query, workspace_id, document_id, mode, limit)
    }
    class VectorSearcher {
        +TARGET_MODEL
        +compute_similarity(a, b)
    }
    class KeywordSearcher {
        +score_chunk(chunk, keywords)
    }
    class EmbeddingService {
        +get_embedding(text, provider)
        +generate_embedding(text) hash only
    }
    class AIService {
        +resolve_adapter(workspace_id, preference)
        +generate(workspace_id, messages)
        +generate_stream(workspace_id, messages)
    }
    class BaseAIAdapter {
        <<abstract>>
        +generate(messages)
        +generate_stream(messages)
    }
    class GeminiAdapter
    class OpenAIAdapter
    class OllamaAdapter
    class MockAIAdapter

    RAGService --> RetrievalService : search
    RAGService --> AIService : generate
    RAGService --> CitationValidator : check [S#]
    RAGService --> EntitlementService : reserve credit
    RetrievalService *-- VectorSearcher
    RetrievalService *-- KeywordSearcher
    RetrievalService --> EmbeddingService : query vector
    AIService --> BaseAIAdapter : picks one
    BaseAIAdapter <|-- GeminiAdapter
    BaseAIAdapter <|-- OpenAIAdapter
    BaseAIAdapter <|-- OllamaAdapter
    BaseAIAdapter <|-- MockAIAdapter
```

**As built:** search calls `generate_embedding`, which always returns a hash-based vector, not the AI model. `AIService` falls back to `MockAIAdapter` when no key is found. OpenAI and Groq both use `OpenAIAdapter`.

SVG export: [07a-class-chat-ai.svg](07a-class-chat-ai.svg)
