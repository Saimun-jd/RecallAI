import sys
from unittest.mock import patch, MagicMock
from io import StringIO
import pytest

from cli import run_review_mode

@pytest.fixture
def mock_backend():
    with patch('cli.requests') as mock_requests:
        yield mock_requests

def test_no_cards_due(mock_backend, capsys):
    # Mock GET /flashcards/due to return empty list
    mock_resp = MagicMock()
    mock_resp.json.return_value = []
    mock_resp.status_code = 200
    mock_backend.get.return_value = mock_resp
    
    mock_args = MagicMock()
    mock_args.endpoint = "http://127.0.0.1:8000"
    mock_args.limit = 20
    
    run_review_mode(mock_args)
    
    captured = capsys.readouterr()
    assert "No cards due for review right now" in captured.out

@patch('builtins.input')
def test_review_loop_success(mock_input, mock_backend, capsys):
    # Mock GET /flashcards/due
    mock_get_resp = MagicMock()
    mock_get_resp.json.return_value = [
        {
            "id": 1,
            "breadcrumb": "Test > Topic",
            "topic_name": "Context",
            "question": "What is 2+2?",
            "answer": "4"
        }
    ]
    mock_get_resp.status_code = 200
    mock_backend.get.return_value = mock_get_resp
    
    # Mock POST /flashcards/{id}/review
    mock_post_resp = MagicMock()
    # return future date
    from datetime import datetime, timedelta, timezone
    future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    mock_post_resp.json.return_value = {"due": future}
    mock_post_resp.status_code = 200
    mock_backend.post.return_value = mock_post_resp
    
    # Simulate user pressing ENTER for answer, then typing 3 for rating
    mock_input.side_effect = ["", "3"]
    
    mock_args = MagicMock()
    mock_args.endpoint = "http://127.0.0.1:8000"
    mock_args.limit = 20
    
    run_review_mode(mock_args)
    
    # Check that POST was called with rating 3
    mock_backend.post.assert_called_once_with(
        "http://127.0.0.1:8000/flashcards/1/review",
        json={"rating": 3}
    )
    
    captured = capsys.readouterr()
    assert "What is 2+2?" in captured.out
    assert "Reviewed 1 cards" in captured.out
    assert "Next review in" in captured.out

@patch('builtins.input')
def test_review_loop_quit_early(mock_input, mock_backend, capsys):
    mock_get_resp = MagicMock()
    mock_get_resp.json.return_value = [
        {"id": 1, "question": "Q1", "answer": "A1"},
        {"id": 2, "question": "Q2", "answer": "A2"}
    ]
    mock_backend.get.return_value = mock_get_resp
    
    # user presses 'q' immediately on the question flip prompt
    mock_input.side_effect = ["q"]
    
    mock_args = MagicMock()
    mock_args.endpoint = "http://127.0.0.1:8000"
    mock_args.limit = 20
    
    run_review_mode(mock_args)
    
    # Should not post any reviews
    mock_backend.post.assert_not_called()
    
    captured = capsys.readouterr()
    assert "Reviewed 0 cards" in captured.out

@patch('builtins.input')
def test_review_loop_invalid_input(mock_input, mock_backend, capsys):
    mock_get_resp = MagicMock()
    mock_get_resp.json.return_value = [
        {"id": 1, "question": "Q1", "answer": "A1"}
    ]
    mock_backend.get.return_value = mock_get_resp
    
    mock_post_resp = MagicMock()
    mock_post_resp.json.return_value = {"due": None}
    mock_backend.post.return_value = mock_post_resp
    
    # user presses enter to flip, types '5' (invalid), types 'abc' (invalid), types '2' (valid)
    mock_input.side_effect = ["", "5", "abc", "2"]
    
    mock_args = MagicMock()
    mock_args.endpoint = "http://127.0.0.1:8000"
    mock_args.limit = 20
    
    run_review_mode(mock_args)
    
    # Check that POST was called with rating 2 eventually
    mock_backend.post.assert_called_once_with(
        "http://127.0.0.1:8000/flashcards/1/review",
        json={"rating": 2}
    )
    
    captured = capsys.readouterr()
    assert "Invalid rating. Please enter 1, 2, 3, or 4." in captured.out
