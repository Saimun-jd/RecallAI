import pytest
from app.markdown_slicer import (
    extract_concept_ground_truth,
    match_concept_to_section_heading,
)

SAMPLE_DOCUMENT = """
# MODULE 1: ELECTROMAGNETIC THEORY

## CHAPTER 1: INTRODUCTORY FIELD CONCEPTS

### HISTORICAL BACKGROUND
In early decades of the nineteenth century, Oersted demonstrated that electric current creates magnetic field.
Compass needles respond to current-carrying conductors.

### COULOMB'S LAW AND ELECTROSTATICS
Electrostatic forces between point charges follow inverse square law:
$$F = \\frac{1}{4\\pi\\varepsilon_0} \\frac{q_1 q_2}{r^2}$$
This fundamental relation governs stationary charges in vacuum.

### FARADAY'S LAW OF INDUCTION
Changing magnetic flux creates induced electromotive force in a closed circuit:
$$\\varepsilon = -\\frac{d\\Phi_B}{dt}$$
The negative sign expresses Lenz's law, enforcing conservation of energy.

### MECHANICAL POWER AND ENERGY TRANSFER IN MOVING LOOPS
Consider a rectangular loop of width $L$ moving at velocity $v$ out of a magnetic field $B$.
The external mechanical pulling force required to maintain constant speed is:
$$F_{ext} = \\frac{B^2 L^2 v}{R}$$
The mechanical power delivered to the system is:
$$P_{mech} = F_{ext} v = \\frac{B^2 L^2 v^2}{R}$$
This mechanical work is converted directly into electrical power $\\varepsilon I$ and dissipated as Joule heating:
$$P_{thermal} = I^2 R = \\frac{B^2 L^2 v^2}{R}$$
Hence, conservation of energy holds: $P_{mech} = P_{thermal}$.

### EDDY CURRENTS IN BULK CONDUCTORS
When solid conductors move through non-uniform magnetic fields, circulating swirling currents form.
These eddy currents produce Joule losses and magnetic braking effects.
"""


def test_short_markdown_passthrough():
    short_text = "# Topic\n\nShort content about physics."
    result = extract_concept_ground_truth(short_text, concept_name="Topic", max_chars=1000)
    assert result == short_text


def test_extract_concept_ground_truth_relevant_section():
    result = extract_concept_ground_truth(
        SAMPLE_DOCUMENT,
        concept_name="Mechanical Power and Energy Transfer in Moving Loops",
        concept_summary="Pulling a conducting loop requires mechanical power which is dissipated as Joule heating.",
        key_terms=["Mechanical Power", "Joule Heating", "Conservation of Energy"],
        max_chars=2000,
    )
    # Ground truth for Mechanical Power must be present
    assert "MECHANICAL POWER AND ENERGY TRANSFER IN MOVING LOOPS" in result
    assert "P_{mech} = F_{ext} v" in result
    assert "P_{thermal} = I^2 R" in result
    # Irrelevant sections should NOT be included
    assert "COULOMB'S LAW" not in result
    assert "HISTORICAL BACKGROUND" not in result


def test_extract_concept_ground_truth_token_savings():
    result = extract_concept_ground_truth(
        SAMPLE_DOCUMENT,
        concept_name="Faraday's Law of Induction",
        concept_summary="Changing magnetic flux induces EMF.",
        key_terms=["Faraday's Law", "Magnetic Flux", "EMF"],
        max_chars=1200,
    )
    assert "FARADAY'S LAW OF INDUCTION" in result
    assert "\\varepsilon = -\\frac{d\\Phi_B}{dt}" in result
    # Significantly smaller than full document
    assert len(result) < len(SAMPLE_DOCUMENT) * 0.6


def test_match_concept_to_section_heading():
    from app.heading_detect import detect_headings
    sections = detect_headings(SAMPLE_DOCUMENT, 1)

    heading = match_concept_to_section_heading(
        sections,
        concept_name="Mechanical Power and Energy Transfer in Moving Loops",
        key_terms=["Mechanical Power", "Joule Heating"],
    )
    assert heading == "MECHANICAL POWER AND ENERGY TRANSFER IN MOVING LOOPS"

    heading_faraday = match_concept_to_section_heading(
        sections,
        concept_name="Faraday's Law of Induction",
        key_terms=["Induced EMF", "Flux"],
    )
    assert heading_faraday == "FARADAY'S LAW OF INDUCTION"


def test_fallback_without_headings():
    plain_text = (
        "Introduction to thermodynamics and heat engines.\n\n"
        "Carnot cycle consists of isothermal and adiabatic reversible processes. The theoretical maximum efficiency is given by eta = 1 - Tc/Th.\n\n"
        "Entropy always increases in an isolated system according to the second law.\n\n"
        "Statistical interpretation of entropy is S = k ln Omega."
    )
    result = extract_concept_ground_truth(
        plain_text,
        concept_name="Carnot Cycle Efficiency",
        concept_summary="Maximum efficiency of heat engine.",
        key_terms=["Carnot", "efficiency", "isothermal"],
        max_chars=300,
    )
    assert "Carnot cycle" in result
    assert "eta = 1 - Tc/Th" in result
