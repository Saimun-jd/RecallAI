import pytest
from app.database import (
    init_db,
    log_token_usage,
    get_token_usage_summary,
    get_token_usage_logs,
    clear_token_usage_logs,
    calculate_token_cost
)

@pytest.fixture(autouse=True)
def setup_db():
    init_db()
    clear_token_usage_logs()
    yield
    clear_token_usage_logs()

def test_calculate_token_cost():
    # Ollama is free
    assert calculate_token_cost("ollama", "gemma3:4b", 1000, 500) == 0.0

    # Gemini Flash: $0.075/1M input, $0.30/1M output
    # 1,000,000 input + 1,000,000 output = $0.375
    cost = calculate_token_cost("gemini", "gemini-2.5-flash", 1_000_000, 1_000_000)
    assert abs(cost - 0.375) < 1e-4

    # GPT-4o-mini: $0.15/1M input, $0.60/1M output
    cost_mini = calculate_token_cost("openai", "gpt-4o-mini", 1_000_000, 1_000_000)
    assert abs(cost_mini - 0.75) < 1e-4

def test_log_and_summarize_token_usage():
    # Log several events
    log_token_usage("gemini", "gemini-2.5-flash", "chat", 500, 100)
    log_token_usage("gemini", "gemini-2.5-flash", "flashcards", 1500, 300)
    log_token_usage("openai", "gpt-4o-mini", "socratic_drill", 800, 200)

    summary = get_token_usage_summary()
    totals = summary["totals"]
    assert totals["total_requests"] == 3
    assert totals["total_prompt_tokens"] == 2800
    assert totals["total_completion_tokens"] == 600
    assert totals["total_tokens"] == 3400
    assert totals["total_cost_usd"] > 0.0

    # Check breakdowns
    feature_names = [f["feature"] for f in summary["by_feature"]]
    assert "chat" in feature_names
    assert "flashcards" in feature_names
    assert "socratic_drill" in feature_names

    providers = [p["provider"] for p in summary["by_provider"]]
    assert "gemini" in providers
    assert "openai" in providers

    # History logs
    logs = get_token_usage_logs(limit=10)
    assert len(logs) == 3
    assert logs[0]["feature"] == "socratic_drill" # Most recent first

def test_clear_token_usage():
    log_token_usage("gemini", "gemini-2.5-flash", "chat", 100, 50)
    assert len(get_token_usage_logs()) == 1
    clear_token_usage_logs()
    assert len(get_token_usage_logs()) == 0
