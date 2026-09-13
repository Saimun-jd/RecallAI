import pytest
from app.prompt_manager import (
    get_all_prompts,
    get_prompt_template,
    update_prompt,
    reset_prompt,
    reset_all_prompts,
    validate_prompt_template,
    PROMPT_REGISTRY,
)
from app.database import init_db

@pytest.fixture(autouse=True)
def setup_database():
    init_db()
    reset_all_prompts()
    yield
    reset_all_prompts()

def test_get_all_prompts():
    prompts = get_all_prompts()
    assert len(prompts) == len(PROMPT_REGISTRY)
    for p in prompts:
        assert "key" in p
        assert "name" in p
        assert "category" in p
        assert "variables" in p
        assert "default_template" in p
        assert "current_template" in p
        assert p["is_customized"] is False

def test_validate_prompt_template():
    # Valid template matching variables
    default_chat = PROMPT_REGISTRY["chat_prompt"]["default_template"]
    err = validate_prompt_template("chat_prompt", default_chat)
    assert err is None

    # Missing required variable: question
    bad_template = "You are an AI tutor. Answer context: {context_markdown}"
    err = validate_prompt_template("chat_prompt", bad_template)
    assert err is not None
    assert "{question}" in err

    # Syntax error in brackets
    syntax_error_template = "Context: {context_markdown} Question: {question} broken: {"
    err = validate_prompt_template("chat_prompt", syntax_error_template)
    assert err is not None

def test_update_and_reset_prompt():
    default_chat = get_prompt_template("chat_prompt")
    custom_chat = default_chat + "\nEXTRA_CUSTOM_INSTRUCTION_TEST"

    # Update
    updated = update_prompt("chat_prompt", custom_chat)
    assert updated["is_customized"] is True
    assert get_prompt_template("chat_prompt") == custom_chat.strip()

    # Reset single prompt
    reset = reset_prompt("chat_prompt")
    assert reset["is_customized"] is False
    assert get_prompt_template("chat_prompt") == PROMPT_REGISTRY["chat_prompt"]["default_template"]

def test_reset_all_prompts():
    default_chat = get_prompt_template("chat_prompt")
    update_prompt("chat_prompt", default_chat + "\nRule 1")
    default_summary = get_prompt_template("summary_prompt")
    update_prompt("summary_prompt", default_summary + "\nSummary Rule")

    all_prompts = get_all_prompts()
    customized_count = sum(1 for p in all_prompts if p["is_customized"])
    assert customized_count == 2

    reset_all_prompts()
    all_prompts_after = get_all_prompts()
    assert all(not p["is_customized"] for p in all_prompts_after)
