import os
import sys
import json
import pytest
import tempfile
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

temp_db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
temp_db_path = temp_db_file.name
temp_db_file.close()

from app import database
from app.main import app
from app.schemas import DiagnosticQuestionSet, DiagnosticQuestion, DiagnosticEvaluation, SuggestedFlashcard, DiagnosedGap, ExamMisconception

database.ACTIVE_DB_PATH = temp_db_path
database.init_db()

client = TestClient(app)

def test_concept_enrichment_and_mastery_tracking():
    # 1. Save Book & Topic
    book_id = database.save_book(
        title="Physics Electromagnetism",
        file_path="C:/dummy/physics.pdf",
        file_hash="hash_concept_test",
        total_pages=50
    )
    database.insert_topics_bulk(book_id, [
        {"level": 1, "title": "Electromagnetic Induction", "start_page": 1, "end_page": 20}
    ])
    topics = database.get_topics(book_id=book_id)
    assert len(topics) == 1
    topic_id = topics[0]["id"]

    # 2. Enrich with atomic_concepts
    initial_concepts = [
        {
            "id": "c_1",
            "name": "Faraday's Law",
            "concept_type": "Formula",
            "summary": "Induced EMF equals the negative rate of change of magnetic flux.",
            "key_terms": ["EMF", "Magnetic Flux"],
            "mastery_score": None,
            "mastery_status": "untested",
            "last_drilled_at": None,
        },
        {
            "id": "c_2",
            "name": "Lenz's Law",
            "concept_type": "Definition",
            "summary": "The direction of an induced current always opposes the change in flux producing it.",
            "key_terms": ["Conservation of Energy", "Opposing Flux"],
            "mastery_score": None,
            "mastery_status": "untested",
            "last_drilled_at": None,
        }
    ]

    database.update_topic_enrichment(
        topic_id=topic_id,
        atomic_concepts=json.dumps(initial_concepts),
        content_md="# Induction\nContent text here...",
        status="processed"
    )

    t_after = database.get_topic_by_id(topic_id)
    assert t_after["status"] == "processed"
    saved_concepts = json.loads(t_after["atomic_concepts"])
    assert len(saved_concepts) == 2
    assert saved_concepts[0]["name"] == "Faraday's Law"

    # 3. Update concept mastery for Faraday's Law
    res = database.update_concept_mastery(topic_id, "Faraday's Law", 90, "mastered")
    assert res["concept"]["mastery_score"] == 90
    assert res["concept"]["mastery_status"] == "mastered"
    assert res["topic_score"] == 90
    assert res["topic_status"] == "mastered"

    # 4. Update second concept for Lenz's Law
    res2 = database.update_concept_mastery(topic_id, "Lenz's Law", 50, "fragile")
    assert res2["concept"]["mastery_score"] == 50
    # Aggregate should be round((90 + 50) / 2) = 70 ("developing")
    assert res2["topic_score"] == 70
    assert res2["topic_status"] == "developing"

    # Verify persistence
    t_final = database.get_topic_by_id(topic_id)
    assert t_final["mastery_score"] == 70
    assert t_final["mastery_status"] == "developing"
    final_concepts = json.loads(t_final["atomic_concepts"])
    assert final_concepts[0]["mastery_score"] == 90
    assert final_concepts[1]["mastery_score"] == 50


@patch("app.socratic_drill.generate_diagnostic_questions")
def test_concept_drill_generate_endpoint(mock_gen):
    mock_gen.return_value = DiagnosticQuestionSet(
        topic_title="Electromagnetic Induction",
        concept_name="Faraday's Law",
        questions=[
            DiagnosticQuestion(
                id="q1",
                tier="causal_mechanism",
                question_text="Explain why changing flux induces an EMF.",
                key_invariants=["rate of flux change", "closed loop"],
                socratic_hint="Think about what drives electron motion."
            )
        ]
    )

    # Fetch existing topic id
    topics = [t for t in database.get_topics() if t.get("atomic_concepts")]
    topic_id = topics[0]["id"]

    response = client.post(
        f"/topics/{topic_id}/drill/generate",
        json={
            "concept_name": "Faraday's Law",
            "concept_type": "Formula",
            "concept_summary": "Induced EMF equals...",
            "key_terms": ["EMF", "Flux"]
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["concept_name"] == "Faraday's Law"
    assert len(data["questions"]) == 1
    assert data["questions"][0]["id"] == "q1"


@patch("app.socratic_drill.evaluate_student_answer")
def test_concept_drill_evaluate_endpoint(mock_eval):
    mock_eval.return_value = DiagnosticEvaluation(
        concept_name="Faraday's Law",
        mastery_score=95,
        status="mastered",
        strengths=["Identified rate of change of flux correctly"],
        diagnosed_gaps=[],
        misconceptions=[],
        socratic_nudge="Consider a superconducting loop next.",
        suggested_flashcards=[]
    )

    topics = [t for t in database.get_topics() if t.get("atomic_concepts")]
    topic_id = topics[0]["id"]

    response = client.post(
        f"/topics/{topic_id}/drill/evaluate",
        json={
            "question_id": "q1",
            "question_text": "Explain why changing flux induces an EMF.",
            "key_invariants": ["rate of flux change", "closed loop"],
            "student_answer": "When the magnetic flux through a loop changes with time, an electromotive force is induced according to Faraday's Law.",
            "concept_name": "Faraday's Law"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["mastery_score"] == 95
    assert data["status"] == "mastered"
    assert data["concept_name"] == "Faraday's Law"

    # Verify topic concept was updated in DB
    topic = database.get_topic_by_id(topic_id)
    concepts = json.loads(topic["atomic_concepts"])
    faraday = next(c for c in concepts if c["name"] == "Faraday's Law")
    assert faraday["mastery_score"] == 95
    assert faraday["mastery_status"] == "mastered"


@patch("app.socratic_drill.evaluate_student_answer")
def test_structured_misconceptions_and_gaps_evaluation(mock_eval):
    mock_eval.return_value = DiagnosticEvaluation(
        concept_name="RL Circuit Energy",
        mastery_score=40,
        status="fragile",
        strengths=["Understands that current grows over time"],
        diagnosed_gaps=[
            DiagnosedGap(
                gap="Energy balance and conservation in RL circuit",
                context="Multiplying V = iR + L(di/dt) by i dt yields Vi dt = i^2 R dt + Li di. Source energy equals Joule heat plus magnetic energy 1/2 L i^2.",
                why_it_matters="Crucial for calculating power delivery and energy storage in transient exam problems."
            )
        ],
        misconceptions=[
            ExamMisconception(
                pitfall="Treating inductor as an energy-dissipating element like a resistor",
                theory="An ideal inductor has zero resistance; it stores energy in its magnetic field P = Li(di/dt), returning it when current collapses.",
                exam_tip="Never integrate inductor voltage as resistive heat loss in total energy dissipation exam questions."
            )
        ],
        socratic_nudge=None,
        suggested_flashcards=[]
    )

    topics = [t for t in database.get_topics() if t.get("atomic_concepts")]
    topic_id = topics[0]["id"]

    response = client.post(
        f"/topics/{topic_id}/drill/evaluate",
        json={
            "question_id": "q2",
            "question_text": "Explain energy conservation in an RL circuit.",
            "key_invariants": ["energy conservation", "magnetic energy storage", "resistive heat"],
            "student_answer": "The inductor consumes all the power like a resistor.",
            "concept_name": "RL Circuit Energy"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["mastery_score"] == 40
    assert data["status"] == "fragile"
    assert len(data["diagnosed_gaps"]) == 1
    assert data["diagnosed_gaps"][0]["gap"] == "Energy balance and conservation in RL circuit"
    assert "Joule heat" in data["diagnosed_gaps"][0]["context"]
    assert data["diagnosed_gaps"][0]["why_it_matters"] is not None

    assert len(data["misconceptions"]) == 1
    assert "Treating inductor" in data["misconceptions"][0]["pitfall"]
    assert "magnetic field" in data["misconceptions"][0]["theory"]
    assert "Never integrate" in data["misconceptions"][0]["exam_tip"]


def test_legacy_string_coercion_in_evaluation_schema():
    # Verify that raw strings are cleanly coerced into DiagnosedGap and ExamMisconception objects
    legacy_eval = DiagnosticEvaluation(
        mastery_score=50,
        status="fragile",
        strengths=["Good start"],
        diagnosed_gaps=["Omitted rate of flux change in equation"],
        misconceptions=["Stated that back-EMF aids the change in current"],
    )
    dumped = legacy_eval.model_dump()
    assert len(dumped["diagnosed_gaps"]) == 1
    assert dumped["diagnosed_gaps"][0]["gap"] == "Omitted rate of flux change in equation"
    assert dumped["diagnosed_gaps"][0]["context"] == "Omitted rate of flux change in equation"

    assert len(dumped["misconceptions"]) == 1
    assert dumped["misconceptions"][0]["pitfall"] == "Stated that back-EMF aids the change in current"
    assert dumped["misconceptions"][0]["theory"] == "Stated that back-EMF aids the change in current"
    assert len(dumped["misconceptions"][0]["exam_tip"]) > 0
