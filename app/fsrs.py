from fsrs import Scheduler, Card, Rating, State
from datetime import datetime, timezone

def review_card(card_data: dict, rating: int) -> dict:
    """
    Applies the FSRS scheduling algorithm to a flashcard.
    card_data: Dictionary containing SQLite flashcard state metrics.
    rating: Integer (1=Again, 2=Hard, 3=Good, 4=Easy).
    """
    if rating not in [1, 2, 3, 4]:
        raise ValueError("Rating must be between 1 and 4")
        
    card = Card()
    
    state_val = card_data.get("state", 0)
    if state_val != 0:
        card.state = State(state_val)
        card.stability = card_data.get("stability", 0.0)
        card.difficulty = card_data.get("difficulty", 0.0)
        
        last_review = card_data.get("last_review")
        if last_review:
            try:
                card.last_review = datetime.fromisoformat(last_review).replace(tzinfo=timezone.utc)
            except ValueError:
                pass
                
        due = card_data.get("due")
        if due:
            try:
                card.due = datetime.fromisoformat(due).replace(tzinfo=timezone.utc)
            except ValueError:
                pass
                
    scheduler = Scheduler()
    now = datetime.now(timezone.utc)
    
    rating_enum = Rating(rating)
    updated_card, review_log = scheduler.review_card(card, rating_enum, now)
    
    # Calculate custom DB values that were removed from the v6 Card model
    reps = card_data.get("reps", 0) + 1
    lapses = card_data.get("lapses", 0)
    if rating == 1:
        lapses += 1
        
    elapsed_days = getattr(review_log, 'elapsed_days', 0)
    scheduled_days = getattr(review_log, 'scheduled_days', 0)
    
    return {
        "state": updated_card.state.value,
        "stability": updated_card.stability,
        "difficulty": updated_card.difficulty,
        "elapsed_days": elapsed_days,
        "scheduled_days": scheduled_days,
        "reps": reps,
        "lapses": lapses,
        "last_review": updated_card.last_review.isoformat() if updated_card.last_review else None,
        "due": updated_card.due.isoformat() if updated_card.due else None
    }
