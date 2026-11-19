# 07c · Class diagram: study features and billing

Flashcards, quizzes, spaced review, plan limits and billing (`app/services/flashcards.py`, `quizzes.py`, `attempts.py`, `reviews.py`, `scheduler.py`, `entitlements.py`, `billing.py`).

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "primaryColor": "#ffffff", "primaryTextColor": "#000000", "primaryBorderColor": "#000000", "secondaryColor": "#ffffff", "secondaryBorderColor": "#000000", "tertiaryColor": "#ffffff", "tertiaryBorderColor": "#000000", "mainBkg": "#ffffff", "nodeBorder": "#000000", "lineColor": "#000000", "textColor": "#000000", "edgeLabelBackground": "#ffffff", "clusterBkg": "#ffffff", "clusterBorder": "#000000", "actorBkg": "#ffffff", "actorBorder": "#000000", "actorTextColor": "#000000", "actorLineColor": "#000000", "signalColor": "#000000", "signalTextColor": "#000000", "labelBoxBkgColor": "#ffffff", "labelBoxBorderColor": "#000000", "labelTextColor": "#000000", "loopTextColor": "#000000", "noteBkgColor": "#ffffff", "noteBorderColor": "#000000", "noteTextColor": "#000000", "activationBkgColor": "#ffffff", "activationBorderColor": "#000000", "sequenceNumberColor": "#ffffff", "labelBackgroundColor": "#ffffff", "compositeBackground": "#ffffff", "compositeTitleBackground": "#ffffff", "altBackground": "#ffffff", "transitionColor": "#000000", "transitionLabelColor": "#000000", "stateLabelColor": "#000000", "stateBkg": "#ffffff", "fontFamily": "Segoe UI, Inter, Helvetica, Arial, sans-serif"}}}%%
classDiagram
    direction TB
    class FlashcardGenerationService {
        +generate_flashcards(workspace_id, document_id)
    }
    class QuizGenerationService {
        +generate_quiz(workspace_id, document_id)
    }
    class QuizAttemptService {
        +start_attempt(quiz_id)
        +record_answer(attempt_id, answer)
        +submit_attempt(attempt_id)
    }
    class ReviewSessionService {
        +start_session(workspace_id)
        +get_next_item(session_id)
        +rate_item(review_id, rating)
    }
    class ReviewScheduler {
        <<abstract>>
        +schedule(metadata, rating, review_time)
    }
    class FSRSScheduler
    class GraduatedIntervalScheduler
    class EntitlementService {
        +can_use_feature(workspace_id, feature)
        +reserve_usage(workspace_id, feature)
        +get_usage_summary(workspace_id)
    }
    class BillingService {
        +create_checkout_session(workspace_id, plan_id)
        +cancel_subscription(workspace_id)
        +reactivate_subscription(workspace_id)
        +handle_webhook(payload, signature)
    }
    class BaseBillingProvider {
        <<abstract>>
        +create_checkout_session(plan)
        +verify_webhook_signature(payload, sig)
    }
    class MockBillingProvider
    class AIService {
        +generate(workspace_id, messages)
    }

    FlashcardGenerationService --> AIService
    FlashcardGenerationService --> EntitlementService : quota
    QuizGenerationService --> AIService
    QuizAttemptService ..> QuizGenerationService : grades its questions
    ReviewSessionService --> ReviewScheduler : next due date
    ReviewScheduler <|-- FSRSScheduler
    ReviewScheduler <|-- GraduatedIntervalScheduler
    EntitlementService ..> BillingService : reads active plan
    BillingService --> BaseBillingProvider
    BaseBillingProvider <|-- MockBillingProvider
```

**As built:** `MockBillingProvider` is the only provider, so no real payment is possible. The legacy drill and topic-flashcard endpoints in `app/main.py` don't use these classes or `EntitlementService`.

SVG export (black and white): [07c-class-study-billing.svg](07c-class-study-billing.svg)
