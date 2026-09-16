import pytest
from app.toc_parser import (
    is_noise_heading,
    is_valid_heading_candidate,
    build_granular_toc,
    find_subtopics,
    search_toc_by_title,
)


def test_is_noise_heading():
    assert is_noise_heading("CHECKPOINT: The figure shows three") is True
    assert is_noise_heading("PROBLEM 30-03: In Fig. a 120-turn coil") is True
    assert is_noise_heading("ANSWER: b, then d and e tie") is True
    assert is_noise_heading("Table of Contents") is True  # filtered as front-matter noise
    # Slide noise: bullets, presenter, affiliation, outlines, Q&A
    assert is_noise_heading("• A heuristic is a technique") is True
    assert is_noise_heading("• Traveling Salesman Problem") is True
    assert is_noise_heading("▪ Key concepts") is True
    assert is_noise_heading("Dr. Mohammed M. Rahman") is True
    assert is_noise_heading("Prof. Jane Doe") is True
    assert is_noise_heading("CSE, CUET") is True
    assert is_noise_heading("Department of Computer Science") is True
    assert is_noise_heading("CSE 311") is True
    assert is_noise_heading("Outlines") is True
    assert is_noise_heading("Agenda") is True
    assert is_noise_heading("Questions?") is True
    assert is_noise_heading("Thank You!") is True
    # Legitimate topic headings
    assert is_noise_heading("FARADAY'S LAW") is False
    assert is_noise_heading("LENZ'S LAW: LAW OF CONSERVATION OF ENERGY") is False
    assert is_noise_heading("Heuristic Function") is False
    assert is_noise_heading("Simple Hill Climbing") is False


def test_is_valid_heading_candidate():
    assert is_valid_heading_candidate("FARADAY'S LAW") is True
    assert is_valid_heading_candidate("LENZ'S LAW: LAW OF CONSERVATION OF ENERGY") is True
    assert is_valid_heading_candidate("INDUCTION AND ENERGY TRANSFERS") is True
    assert is_valid_heading_candidate("Form of Energy Transfer:") is True
    assert is_valid_heading_candidate("Energy Transfer:") is True
    assert is_valid_heading_candidate("Heuristic Function") is True
    assert is_valid_heading_candidate("Simple Hill Climbing") is True
    # Slide noise should be rejected
    assert is_valid_heading_candidate("• A heuristic is a ...") is False
    assert is_valid_heading_candidate("• Traveling Salesm...") is False
    assert is_valid_heading_candidate("Dr. Mohammed M...") is False
    assert is_valid_heading_candidate("CSE, CUET") is False
    assert is_valid_heading_candidate("Outlines") is False
    assert is_valid_heading_candidate("Questions?") is False
    # Sentences and clauses should be rejected
    assert is_valid_heading_candidate("where the number of turns N is 130") is False
    assert is_valid_heading_candidate("therefore, we get,") is False
    assert is_valid_heading_candidate("in other words, the flow of induced current") is False
    assert is_valid_heading_candidate("move in a straight line]. Therefore,") is False
    # Raw equations should be rejected
    assert is_valid_heading_candidate("P = F_a v = B^2 L^2 v^2 / R") is False
    assert is_valid_heading_candidate("Phi_B = \\iint B \\cdot dA") is False


def test_build_granular_toc_ranges():
    mock_toc = [
        [1, "MODULE 08: INDUCTION & INDUCTANCE", 1],
        [2, "LECTURE 17", 1],
        [3, "BACKGROUND", 1],
        [3, "ELECTROMAGNETIC INDUCTION", 1],
        [3, "FARADAY'S LAW", 2],
        [3, "LENZ'S LAW: LAW OF CONSERVATION OF ENERGY", 4],
        [3, "INDUCTION AND ENERGY TRANSFERS", 8],
    ]
    granular = build_granular_toc(mock_toc, total_pages=11)

    assert len(granular) == 7
    # Parent levels 1 & 2 span full document
    assert granular[0]["title"] == "MODULE 08: INDUCTION & INDUCTANCE"
    assert granular[0]["start_page"] == 1
    assert granular[0]["end_page"] == 11

    assert granular[1]["title"] == "LECTURE 17"
    assert granular[1]["start_page"] == 1
    assert granular[1]["end_page"] == 11

    # Faraday's law spans pages 2 to 3
    faraday = next(g for g in granular if g["title"] == "FARADAY'S LAW")
    assert faraday["start_page"] == 2
    assert faraday["end_page"] == 3

    # Lenz's law spans pages 4 to 7
    lenz = next(g for g in granular if "LENZ'S LAW" in g["title"])
    assert lenz["start_page"] == 4
    assert lenz["end_page"] == 7

    # Induction & Energy Transfers spans pages 8 to 11
    energy = next(g for g in granular if "INDUCTION AND ENERGY TRANSFERS" in g["title"])
    assert energy["start_page"] == 8
    assert energy["end_page"] == 11


def test_build_granular_toc_single_entry():
    mock_toc = [[1, "Single Chapter", 1]]
    granular = build_granular_toc(mock_toc, total_pages=50)
    assert len(granular) == 1
    assert granular[0]["start_page"] == 1
    assert granular[0]["end_page"] == 50


def test_auto_synthesize_parent_topic_for_flat_slides():
    mock_flat_toc = [
        [1, "Heuristic Function", 1],
        [1, "Simple Hill Climbing", 4],
        [1, "Steepest-Ascent Hill Climbing", 7],
    ]
    granular = build_granular_toc(mock_flat_toc, total_pages=12, document_title="AI_Lecture_Heuristic_Search.pdf")

    # Parent topic should be synthesized at level 1, and the 3 slides become level 2
    assert len(granular) == 4

    parent = granular[0]
    assert parent["level"] == 1
    assert parent["title"] == "AI Lecture Heuristic Search"
    assert parent["start_page"] == 1
    assert parent["end_page"] == 12

    child1 = granular[1]
    assert child1["level"] == 2
    assert child1["title"] == "Heuristic Function"
    assert child1["start_page"] == 1
    assert child1["end_page"] == 3

    child2 = granular[2]
    assert child2["level"] == 2
    assert child2["title"] == "Simple Hill Climbing"
    assert child2["start_page"] == 4
    assert child2["end_page"] == 6

    child3 = granular[3]
    assert child3["level"] == 2
    assert child3["title"] == "Steepest-Ascent Hill Climbing"
    assert child3["start_page"] == 7
    assert child3["end_page"] == 12


def test_auto_synthesize_filters_noise_before_synthesis():
    # If a slide deck has noise entries like presenter, affiliation, outline, bullet points
    mock_slide_deck = [
        [1, "Dr. Mohammed M...", 1],
        [1, "CSE, CUET", 1],
        [1, "Outlines", 2],
        [1, "Heuristic Function", 3],
        [1, "• A heuristic is a ...", 4],
        [1, "Simple Hill Climbing", 5],
        [1, "Steepest-Ascent Hill Climbing", 9],
        [1, "Questions?", 12],
    ]
    granular = build_granular_toc(mock_slide_deck, total_pages=12, document_title="Lecture Heuristic Search")

    # Only valid topics: Parent + 3 real topics = 4
    assert len(granular) == 4
    assert granular[0]["level"] == 1
    assert granular[0]["title"] == "Lecture Heuristic Search"
    assert [g["title"] for g in granular[1:]] == [
        "Heuristic Function",
        "Simple Hill Climbing",
        "Steepest-Ascent Hill Climbing"
    ]
    assert all(g["level"] == 2 for g in granular[1:])

