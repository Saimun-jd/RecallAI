import pytest
import re
from app.prompt_manager import get_prompt_template, PROMPT_REGISTRY
from app.llm_segment import _extract_diagrams_reference

SAMPLE_TOPIC_MARKDOWN = """# RL Circuit Analysis

An inductor opposes changes in current through Faraday's law of induction.

![Circuit schematic of a series RL circuit with DC voltage source V and resistor R](images/rl_circuit_dc_source.jpg)

The current response satisfies:
$$i(t) = \\frac{V}{R} \\left(1 - e^{-t/\\tau}\\right)$$
where $\\tau = \\frac{L}{R}$.

![Transient current rise curve over time showing tau time constant](transient_response_curve.png)
"""

def test_extract_diagrams_reference():
    ref = _extract_diagrams_reference(SAMPLE_TOPIC_MARKDOWN)
    assert "Available Diagrams & Figures from Context" in ref
    assert "![Circuit schematic of a series RL circuit with DC voltage source V and resistor R](images/rl_circuit_dc_source.jpg)" in ref
    assert "![Transient current rise curve over time showing tau time constant](transient_response_curve.png)" in ref

def test_extract_diagrams_reference_empty():
    assert _extract_diagrams_reference("") == ""
    assert _extract_diagrams_reference("Just plain text with no images.") == ""
    assert _extract_diagrams_reference(None) == ""

def test_chat_prompt_contains_diagram_rules_and_preserves_images():
    template = get_prompt_template("chat_prompt")
    ref = _extract_diagrams_reference(SAMPLE_TOPIC_MARKDOWN)
    
    formatted = template.format(
        context_markdown=SAMPLE_TOPIC_MARKDOWN,
        chat_history="User: Can you explain this circuit?",
        question="How does current rise in this circuit?",
        document_outline="Outline",
        diagrams_reference=ref
    )
    
    # Must contain diagram rules in prompt instructions
    assert "DIAGRAMS, FIGURES & TABLES" in formatted
    assert "YOU MUST embed the relevant diagram(s)" in formatted
    assert "clean, well-aligned Markdown table" in formatted
    
    # Must include the extracted diagrams reference in prompt
    assert "rl_circuit_dc_source.jpg" in formatted
    assert "transient_response_curve.png" in formatted

def test_cornell_scaffold_prompt_contains_diagram_section_and_rules():
    template = get_prompt_template("cornell_scaffold_prompt")
    
    diagram_matches = re.findall(r'(!\[.*?\]\(.*?\))', SAMPLE_TOPIC_MARKDOWN)
    diagrams_reference = "Available Diagrams & Figures from Source Document (PRESERVE & EMBED IN NOTES):\n" + "\n".join(
        f"- {match}" for match in diagram_matches
    )
    
    formatted = template.format(
        topic_title="RL Circuit Analysis",
        breadcrumb="Physics > Circuits",
        concepts_summary="- Inductor: Opposes current change",
        content_reference=SAMPLE_TOPIC_MARKDOWN,
        diagrams_reference=diagrams_reference
    )
    
    # Must contain visual schematics section in scaffold structure
    assert "## 📊 Visual Schematics & Key Comparisons" in formatted
    assert "DIAGRAM INTEGRATION" in formatted
    assert "rl_circuit_dc_source.jpg" in formatted
    assert "transient_response_curve.png" in formatted

def test_cornell_scaffold_backward_compatibility_without_diagrams_ref():
    # If a legacy caller formats cornell_scaffold_prompt without diagrams_reference, it shouldn't raise KeyError
    template = get_prompt_template("cornell_scaffold_prompt")
    formatted = template.format(
        topic_title="Legacy Topic",
        breadcrumb="Course",
        concepts_summary="None",
        content_reference="Some content"
    )
    assert "# 📝 Legacy Topic" in formatted
    assert "## 🎯 Core Invariants & Definitions" in formatted
