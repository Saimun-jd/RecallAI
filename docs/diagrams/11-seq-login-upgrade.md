# 11 · Sequence: login and Premium upgrade

Login in `desktop/src/contexts/AuthProvider.tsx` → `/api/v1/auth/login` or Supabase, then `/api/set-user`. Upgrade via `/api/v1/billing/checkout` and `/billing/webhook` (`app/services/billing.py`).

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "primaryColor": "#BFE3FD", "primaryTextColor": "#1f1f1f", "primaryBorderColor": "#5b7fa6", "lineColor": "#555555", "actorBkg": "#FEC8C3", "actorBorder": "#c98a84", "noteBkgColor": "#FFF1B8", "noteBorderColor": "#d9c27a", "fontFamily": "Segoe UI, Inter, Helvetica, Arial, sans-serif"}}}%%
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

SVG export: [11-seq-login-upgrade.svg](11-seq-login-upgrade.svg)
