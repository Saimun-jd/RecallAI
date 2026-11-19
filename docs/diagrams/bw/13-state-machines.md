# 13 · State machine diagrams

Three objects with real states in the code.

## 13a · Flashcard (FSRS)

States from the `fsrs` library via `app/services/scheduler.py` (`FSRSScheduler`).

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "primaryColor": "#ffffff", "primaryTextColor": "#000000", "primaryBorderColor": "#000000", "secondaryColor": "#ffffff", "secondaryBorderColor": "#000000", "tertiaryColor": "#ffffff", "tertiaryBorderColor": "#000000", "mainBkg": "#ffffff", "nodeBorder": "#000000", "lineColor": "#000000", "textColor": "#000000", "edgeLabelBackground": "#ffffff", "clusterBkg": "#ffffff", "clusterBorder": "#000000", "actorBkg": "#ffffff", "actorBorder": "#000000", "actorTextColor": "#000000", "actorLineColor": "#000000", "signalColor": "#000000", "signalTextColor": "#000000", "labelBoxBkgColor": "#ffffff", "labelBoxBorderColor": "#000000", "labelTextColor": "#000000", "loopTextColor": "#000000", "noteBkgColor": "#ffffff", "noteBorderColor": "#000000", "noteTextColor": "#000000", "activationBkgColor": "#ffffff", "activationBorderColor": "#000000", "sequenceNumberColor": "#ffffff", "labelBackgroundColor": "#ffffff", "compositeBackground": "#ffffff", "compositeTitleBackground": "#ffffff", "altBackground": "#ffffff", "transitionColor": "#000000", "transitionLabelColor": "#000000", "stateLabelColor": "#000000", "stateBkg": "#ffffff", "fontFamily": "Segoe UI, Inter, Helvetica, Arial, sans-serif"}}}%%
stateDiagram-v2
    direction LR
    [*] --> New : card generated
    New --> Learning : first rating
    Learning --> Learning : Again, Hard
    Learning --> Review : Good, Easy
    Review --> Review : Hard, Good, Easy
    Review --> Relearning : Again
    Relearning --> Relearning : Again, Hard
    Relearning --> Review : Good, Easy
    Review --> [*] : deleted
```

Learning steps are minutes apart (tested: Again → 1 min, Good → 10 min). In Review, each pass grows the interval (Easy → 8 days on first review). Again in Review counts a lapse.

## 13b · Document processing job

`ProcessingJobRepository` + `DocumentProcessingPipeline` (`app/services/pipeline.py`). The document's own status moves `uploading → processing → ready | failed` alongside.

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "primaryColor": "#ffffff", "primaryTextColor": "#000000", "primaryBorderColor": "#000000", "secondaryColor": "#ffffff", "secondaryBorderColor": "#000000", "tertiaryColor": "#ffffff", "tertiaryBorderColor": "#000000", "mainBkg": "#ffffff", "nodeBorder": "#000000", "lineColor": "#000000", "textColor": "#000000", "edgeLabelBackground": "#ffffff", "clusterBkg": "#ffffff", "clusterBorder": "#000000", "actorBkg": "#ffffff", "actorBorder": "#000000", "actorTextColor": "#000000", "actorLineColor": "#000000", "signalColor": "#000000", "signalTextColor": "#000000", "labelBoxBkgColor": "#ffffff", "labelBoxBorderColor": "#000000", "labelTextColor": "#000000", "loopTextColor": "#000000", "noteBkgColor": "#ffffff", "noteBorderColor": "#000000", "noteTextColor": "#000000", "activationBkgColor": "#ffffff", "activationBorderColor": "#000000", "sequenceNumberColor": "#ffffff", "labelBackgroundColor": "#ffffff", "compositeBackground": "#ffffff", "compositeTitleBackground": "#ffffff", "altBackground": "#ffffff", "transitionColor": "#000000", "transitionLabelColor": "#000000", "stateLabelColor": "#000000", "stateBkg": "#ffffff", "fontFamily": "Segoe UI, Inter, Helvetica, Arial, sans-serif"}}}%%
stateDiagram-v2
    direction TB
    [*] --> pending : upload accepted
    pending --> running : background task starts
    state running {
        direction TB
        validation --> extraction : 30%
        extraction --> normalization : 45%
        normalization --> chunking : 60%
        chunking --> embedding : 80%
        embedding --> indexing : 95%
    }
    running --> completed : chunks saved
    running --> failed : PipelineError / exception
    completed --> [*]
    failed --> [*]
```

## 13c · Subscription

`SubscriptionRepository` + `BillingService` (`app/services/billing.py`). The note marks an as-built flaw.

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "primaryColor": "#ffffff", "primaryTextColor": "#000000", "primaryBorderColor": "#000000", "secondaryColor": "#ffffff", "secondaryBorderColor": "#000000", "tertiaryColor": "#ffffff", "tertiaryBorderColor": "#000000", "mainBkg": "#ffffff", "nodeBorder": "#000000", "lineColor": "#000000", "textColor": "#000000", "edgeLabelBackground": "#ffffff", "clusterBkg": "#ffffff", "clusterBorder": "#000000", "actorBkg": "#ffffff", "actorBorder": "#000000", "actorTextColor": "#000000", "actorLineColor": "#000000", "signalColor": "#000000", "signalTextColor": "#000000", "labelBoxBkgColor": "#ffffff", "labelBoxBorderColor": "#000000", "labelTextColor": "#000000", "loopTextColor": "#000000", "noteBkgColor": "#ffffff", "noteBorderColor": "#000000", "noteTextColor": "#000000", "activationBkgColor": "#ffffff", "activationBorderColor": "#000000", "sequenceNumberColor": "#ffffff", "labelBackgroundColor": "#ffffff", "compositeBackground": "#ffffff", "compositeTitleBackground": "#ffffff", "altBackground": "#ffffff", "transitionColor": "#000000", "transitionLabelColor": "#000000", "stateLabelColor": "#000000", "stateBkg": "#ffffff", "fontFamily": "Segoe UI, Inter, Helvetica, Arial, sans-serif"}}}%%
stateDiagram-v2
    direction LR
    [*] --> Free : sign up (no row)
    Free --> active : webhook checkout.session.completed
    active --> past_due : webhook invoice.payment_failed
    active --> canceled : cancel (now or at period end)
    past_due --> canceled : webhook subscription.deleted
    canceled --> active : reactivate
    past_due --> active : reactivate
    canceled --> Free : period end passes
    note right of active
        reactivate needs no payment,
        and "active" never expires
    end note
```

SVG exports: [13a](13a-state-flashcard.svg) · [13b](13b-state-processing-job.svg) · [13c](13c-state-subscription.svg)
