import sqlite3
import hashlib
import json
import logging
import os
from contextlib import contextmanager
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# Ensure it connects to data/recall.db by default
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "recall.db")

@contextmanager
def get_connection():
    """Yields a database connection with Row factory enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def init_db():
    """Initializes the database schema if it doesn't exist."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_hash TEXT UNIQUE NOT NULL,
                total_pages INTEGER NOT NULL,
                prompt_overrides TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS topics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                book_id INTEGER NOT NULL,
                parent_id INTEGER,
                title TEXT NOT NULL,
                level INTEGER NOT NULL,
                start_page INTEGER NOT NULL,
                end_page INTEGER NOT NULL,
                content_md TEXT,
                is_processed BOOLEAN DEFAULT 0,
                sort_order INTEGER NOT NULL,
                FOREIGN KEY (book_id) REFERENCES books (id),
                FOREIGN KEY (parent_id) REFERENCES topics (id)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS flashcards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                topic_id INTEGER NOT NULL,
                topic_name TEXT NOT NULL,
                concept_type TEXT NOT NULL,
                summary TEXT NOT NULL,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                key_terms TEXT NOT NULL,
                code_snippet TEXT,
                image_url TEXT,
                breadcrumb TEXT,
                source_page INTEGER,
                content_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (topic_id) REFERENCES topics (id),
                UNIQUE(topic_id, content_hash)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                topic_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (topic_id) REFERENCES topics (id)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS review_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                flashcard_id INTEGER NOT NULL,
                stability REAL NOT NULL,
                difficulty REAL NOT NULL,
                due_date TIMESTAMP NOT NULL,
                last_review TIMESTAMP,
                reps INTEGER DEFAULT 0,
                lapses INTEGER DEFAULT 0,
                state INTEGER DEFAULT 0,
                rating INTEGER,
                FOREIGN KEY (flashcard_id) REFERENCES flashcards (id)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)
        
        # Seed default settings if empty
        cursor.execute("SELECT COUNT(*) as count FROM settings")
        if cursor.fetchone()['count'] == 0:
            defaults = [
                ("llm_provider", json.dumps({"type": "ollama", "host": "http://localhost:11434", "model": "gemma3:4b"})),
                ("prompt_preset", "default"),
                ("prompt_custom_text", "")
            ]
            cursor.executemany("INSERT INTO settings (key, value) VALUES (?, ?)", defaults)
            
        logger.info(f"Database initialized successfully at {DB_PATH}")

def save_book(title: str, file_path: str, file_hash: str, total_pages: int) -> int:
    """Inserts a new book or returns the existing book ID if file_hash matches."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM books WHERE file_hash = ?", (file_hash,))
        row = cursor.fetchone()
        if row:
            return row['id']
            
        cursor.execute("""
            INSERT INTO books (title, file_path, file_hash, total_pages)
            VALUES (?, ?, ?, ?)
        """, (title, file_path, file_hash, total_pages))
        
        return cursor.lastrowid

def save_topic(
    book_id: int,
    title: str,
    level: int,
    parent_id: Optional[int] = None,
    start_page: Optional[int] = None,
    end_page: Optional[int] = None,
    content_md: Optional[str] = None,
    sort_order: int = 0
) -> int:
    """Inserts or updates a topic and returns its ID."""
    with get_connection() as conn:
        cursor = conn.cursor()
        # Check if topic already exists for this book to avoid duplicates
        cursor.execute(
            """
            SELECT id FROM topics 
            WHERE book_id = ? AND title = ? AND level = ?
            """,
            (book_id, title, level)
        )
        row = cursor.fetchone()
        if row:
            return row['id']
            
        cursor.execute(
            """
            INSERT INTO topics (
                book_id, parent_id, title, level, 
                start_page, end_page, content_md, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (book_id, parent_id, title, level, start_page or 0, end_page or 0, content_md, sort_order)
        )
        return cursor.lastrowid

def save_flashcards(topic_id: int, flashcards_list: List[Dict[str, Any]]) -> int:
    """
    Saves a list of flashcards. Deduplicates using a SHA-256 hash of question+answer.
    Returns the number of cards successfully inserted.
    """
    inserted = 0
    with get_connection() as conn:
        cursor = conn.cursor()
        
        for card in flashcards_list:
            question = card.get("flashcard_question", "")
            answer = card.get("flashcard_answer", "")
            
            # Content Hash for deduplication
            content_str = f"{question}:{answer}"
            content_hash = hashlib.sha256(content_str.encode("utf-8")).hexdigest()
            
            key_terms = json.dumps(card.get("key_terms", []))
            
            try:
                cursor.execute("""
                    INSERT OR IGNORE INTO flashcards (
                        topic_id, topic_name, concept_type, summary, 
                        question, answer, key_terms, code_snippet, 
                        image_url, breadcrumb, source_page, content_hash
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    topic_id,
                    card.get("topic_name", ""),
                    card.get("concept_type", ""),
                    card.get("summary", ""),
                    question,
                    answer,
                    key_terms,
                    card.get("related_code_id"),
                    card.get("related_image_id"),
                    card.get("breadcrumb", ""),
                    card.get("source_page"),
                    content_hash
                ))
                if cursor.rowcount > 0:
                    inserted += 1
            except Exception as e:
                logger.error(f"Failed to insert flashcard {content_hash}: {e}")
                
    return inserted

def get_setting(key: str) -> Optional[str]:
    """Retrieves a setting value by key."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
        row = cursor.fetchone()
        return row['value'] if row else None

def set_setting(key: str, value: str):
    """Sets a setting value by key, inserting or updating as needed."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO settings (key, value) 
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """, (key, value))
