import logging
import os
from app.database import init_db, save_book, save_flashcards, get_setting, set_setting

logging.basicConfig(level=logging.INFO)

def main():
    print("Initializing database...")
    init_db()
    
    print("\nTesting book insertion...")
    book_id_1 = save_book("Test Book", "/path/to/test.pdf", "hash123", 100)
    print(f"Inserted book ID: {book_id_1}")
    
    book_id_2 = save_book("Test Book", "/path/to/test.pdf", "hash123", 100)
    print(f"Duplicate book ID (should match): {book_id_2}")
    
    print("\nTesting settings...")
    set_setting("test_key", "test_value")
    val = get_setting("test_key")
    print(f"Retrieved setting: {val}")
    
    print("\nTesting flashcards...")
    # Assume topic_id=1 for testing
    flashcards = [
        {
            "topic_name": "Test Topic",
            "concept_type": "Definition",
            "summary": "This is a test summary",
            "flashcard_question": "What is testing?",
            "flashcard_answer": "Ensuring code works",
            "key_terms": ["test", "code"]
        }
    ]
    
    # Try inserting once
    inserted_1 = save_flashcards(1, flashcards)
    print(f"Flashcards inserted (first time): {inserted_1} (Expected: 1)")
    
    # Try inserting same cards again
    inserted_2 = save_flashcards(1, flashcards)
    print(f"Flashcards inserted (second time): {inserted_2} (Expected: 0)")
    
if __name__ == "__main__":
    main()
