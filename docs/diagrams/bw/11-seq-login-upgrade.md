# 11 · Sequence: login and Premium upgrade

Login in `desktop/src/contexts/AuthProvider.tsx` → `/api/v1/auth/login` or Supabase, then `/api/set-user`. Upgrade via `/api/v1/billing/checkout` and `/billing/webhook` (`app/services/billing.py`).

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "primaryColor": "#ffffff", "primaryTextColor": "#000000", "primaryBorderColor": "#000000", "secondaryColor": "#ffffff", "secondaryBorderColor": "#000000", "tertiaryColor": "#ffffff", "tertiaryBorderColor": "#000000", "mainBkg": "#ffffff", "nodeBorder": "#000000", "lineColor": "#000000", "textColor": "#000000", "edgeLabelBackground": "#ffffff", "clusterBkg": "#ffffff", "clusterBorder": "#000000", "actorBkg": "#ffffff", "actorBorder": "#000000", "actorTextColor": "#000000", "actorLineColor": "#000000", "signalColor": "#000000", "signalTextColor": "#000000", "labelBoxBkgColor": "#ffffff", "labelBoxBorderColor": "#000000", "labelTextColor": "#000000", "loopTextColor": "#000000", "noteBkgColor": "#ffffff", "noteBorderColor": "#000000", "noteTextColor": "#000000", "activationBkgColor": "#ffffff", "activationBorderColor": "#000000", "sequenceNumberColor": "#ffffff", "labelBackgroundColor": "#ffffff", "compositeBackground": "#ffffff", "compositeTitleBackground": "#ffffff", "altBackground": "#ffffff", "transitionColor": "#000000", "transitionLabelColor": "#000000", "stateLabelColor": "#000000", "stateBkg": "#ffffff", "fontFamily": "Segoe UI, Inter, Helvetica, Arial, sans-serif"}}}%%
sequenceDiagram
    autonumber
    actor S as Student
    participant UI as Desktop UI
    participant SB as Supabase Auth
    participant API as FastAPI
    participant DB as recall_saas.db
    participant L as Legacy DB file switch
    participant PAY as Billing provider (mock)

    S->>UI: Email + password
    alt Supabase configured
        UI->>SB: signInWithPassword
        SB-->>UI: Supabase JWT
    else local auth
        UI->>API: POST /api/v1/auth/login
        API->>DB: get user, verify PBKDF2 hash
        API-->>UI: Recall JWT (HS256, 60 min)
    end
    UI->>API: POST /api/set-user {user_id} (no auth check)
    API->>L: set_active_db_path(user_{id}_recall.db) for the whole server
    Note over API,L: Every later legacy request uses this one file

    S->>UI: Upgrade to Pro
    UI->>API: POST /api/v1/billing/checkout {plan_id}
    API->>PAY: create_checkout_session
    PAY-->>UI: fake checkout.stripe.com URL
    Note over PAY: No real payment page exists
    PAY--)API: POST /billing/webhook (never sent by a real provider)
    API->>API: verify signature (accepts "valid_test_signature")
    API->>DB: create active subscription
```

**As built:** step 8 switches the legacy database for every user on the server, not only this one. Steps 13–15 can only complete through a forged webhook.

SVG export (black and white): [11-seq-login-upgrade.svg](11-seq-login-upgrade.svg)
