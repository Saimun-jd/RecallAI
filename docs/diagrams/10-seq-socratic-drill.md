# 10 · Sequence: Socratic drill

Legacy endpoints `POST /topics/{id}/drill/generate` and `/drill/evaluate` (`app/main.py`, `app/socratic_drill.py`). No login check, and no plan limit.

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "primaryColor": "#BFE3FD", "primaryTextColor": "#1f1f1f", "primaryBorderColor": "#5b7fa6", "lineColor": "#555555", "actorBkg": "#FEC8C3", "actorBorder": "#c98a84", "noteBkgColor": "#FFF1B8", "noteBorderColor": "#d9c27a", "fontFamily": "Segoe UI, Inter, Helvetica, Arial, sans-serif"}}}%%
sequenceDiagram
    autonumber
    actor S as Student
    participant UI as Drill widget
    participant API as FastAPI (legacy routes)
    participant SD as socratic_drill.py
    participant PM as prompt_manager
    participant LLM as LLM provider (legacy layer)
    participant L as recall.db (active file)

    S->>UI: Start Socratic Drill on a topic
    UI->>API: POST /topics/{id}/drill/generate
    API->>L: get_topic + topic markdown
    API->>SD: generate_diagnostic_questions
    SD->>PM: get_prompt_template("socratic_question_prompt")
    SD->>LLM: generate (JSON schema)
    LLM-->>UI: 2 questions + key invariants
    S->>UI: Type explanation (no length limit)
    UI->>API: POST /topics/{id}/drill/evaluate
    API->>SD: evaluate_student_answer
    SD->>PM: get_prompt_template("socratic_evaluation_prompt")
    PM-->>SD: "" (key not registered)
    SD->>LLM: generate(empty prompt)
    LLM-->>SD: made-up evaluation
    API->>L: record_drill_attempt + update mastery score
    API-->>UI: score, gaps, nudge
```

**As built:** steps 11–14 are the grading bug. The evaluation prompt doesn't exist, so the score has nothing to do with the answer.

SVG export: [10-seq-socratic-drill.svg](10-seq-socratic-drill.svg)
