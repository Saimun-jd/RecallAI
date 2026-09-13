import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, log_token_usage, clear_token_usage_logs
from app.prompt_manager import reset_all_prompts

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    init_db()
    reset_all_prompts()
    clear_token_usage_logs()
    yield
    reset_all_prompts()
    clear_token_usage_logs()

def test_api_prompts_crud():
    # GET /api/prompts
    r = client.get("/api/prompts")
    assert r.status_code == 200
    prompts = r.json()["prompts"]
    assert len(prompts) >= 9

    # PUT /api/prompts/{key} with valid body
    chat = [p for p in prompts if p["key"] == "chat_prompt"][0]
    custom_text = chat["default_template"] + "\nExtra test instruction."
    r_put = client.put("/api/prompts/chat_prompt", json={"custom_prompt": custom_text})
    assert r_put.status_code == 200
    assert r_put.json()["prompt"]["is_customized"] is True

    # PUT with missing variables should return 400
    r_bad = client.put("/api/prompts/chat_prompt", json={"custom_prompt": "Hello world"})
    assert r_bad.status_code == 400
    assert "Missing required template variables" in r_bad.json()["detail"]

    # POST /api/prompts/{key}/reset
    r_reset = client.post("/api/prompts/chat_prompt/reset")
    assert r_reset.status_code == 200
    assert r_reset.json()["prompt"]["is_customized"] is False

    # POST /api/prompts/reset-all
    r_reset_all = client.post("/api/prompts/reset-all")
    assert r_reset_all.status_code == 200

def test_api_token_usage():
    log_token_usage("gemini", "gemini-2.5-flash", "chat", 1000, 250)
    log_token_usage("openai", "gpt-4o-mini", "flashcards", 2000, 500)

    # GET /api/token-usage/summary
    r_sum = client.get("/api/token-usage/summary")
    assert r_sum.status_code == 200
    data = r_sum.json()
    assert data["totals"]["total_requests"] == 2
    assert data["totals"]["total_tokens"] == 3750

    # GET /api/token-usage/history
    r_hist = client.get("/api/token-usage/history")
    assert r_hist.status_code == 200
    assert len(r_hist.json()["logs"]) == 2

def test_verify_api_key_endpoint():
    # Empty key check
    r = client.post("/settings/verify-key", json={"provider": "gemini", "api_key": ""})
    assert r.status_code == 200
    assert r.json()["valid"] is False
    assert "cannot be empty" in r.json()["error"]

    # DELETE /api/token-usage
    r_del = client.delete("/api/token-usage")
    assert r_del.status_code == 200
    r_sum_after = client.get("/api/token-usage/summary")
    assert r_sum_after.json()["totals"]["total_requests"] == 0
