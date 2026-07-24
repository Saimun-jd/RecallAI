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
                summary TEXT,
                concept_type TEXT,
                key_terms TEXT,
                code_snippet TEXT,
                image_url TEXT,
                is_processed BOOLEAN DEFAULT 0,
                sort_order INTEGER NOT NULL,
                flashcard_count INTEGER DEFAULT 0,
                breadcrumb TEXT,
                topic_hash TEXT UNIQUE NOT NULL,
                embedding TEXT,
                FOREIGN KEY (book_id) REFERENCES books (id),
                FOREIGN KEY (parent_id) REFERENCES topics (id)
            )
        """)
        
        # Migration: Add new columns if they don't exist
        cursor.execute("PRAGMA table_info(topics)")
        columns = [row['name'] for row in cursor.fetchall()]
        
        migrations = [
            ("flashcard_count", "INTEGER DEFAULT 0"),
            ("summary", "TEXT"),
            ("concept_type", "TEXT"),
            ("key_terms", "TEXT"),
            ("code_snippet", "TEXT"),
            ("image_url", "TEXT"),
            ("breadcrumb", "TEXT"),
            ("topic_hash", "TEXT"),
            ("embedding", "TEXT")
        ]
        
        for col_name, col_type in migrations:
            if col_name not in columns:
                cursor.execute(f"ALTER TABLE topics ADD COLUMN {col_name} {col_type}")
        
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

def generate_topic_hash(book_hash: str, breadcrumb: str) -> str:
    hash_input = f"{book_hash}:{breadcrumb.strip().lower()}"
    return hashlib.sha256(hash_input.encode("utf-8")).hexdigest()

async def resolve_and_save_topic(
    book_id: int,
    book_hash: str,
    breadcrumb: str,
    title: str,
    level: int,
    parent_id: Optional[int] = None,
    start_page: Optional[int] = None,
    end_page: Optional[int] = None,
    content_md: Optional[str] = None,
    sort_order: int = 0,
    summary: Optional[str] = None,
    concept_type: Optional[str] = None,
    key_terms: Optional[str] = None,
    code_snippet: Optional[str] = None,
    image_url: Optional[str] = None,
) -> int:
    """Inserts or updates a topic using semantic deduplication and returns its ID."""
    from app.embeddings import get_embedding, cosine_similarity
    from app.config import settings
    
    topic_hash = generate_topic_hash(book_hash, breadcrumb)
    
    with get_connection() as conn:
        cursor = conn.cursor()
        # 1. Exact topic_hash match
        cursor.execute("SELECT id, content_md FROM topics WHERE topic_hash = ?", (topic_hash,))
        row = cursor.fetchone()
        
        if row:
            new_content = row['content_md']
            if content_md:
                new_content = (row['content_md'] or "") + "\n\n" + content_md
                
            cursor.execute(
                """
                UPDATE topics SET 
                    summary = COALESCE(?, summary),
                    concept_type = COALESCE(?, concept_type),
                    key_terms = COALESCE(?, key_terms),
                    code_snippet = COALESCE(?, code_snippet),
                    image_url = COALESCE(?, image_url),
                    content_md = ?
                WHERE id = ?
                """,
                (summary, concept_type, key_terms, code_snippet, image_url, new_content, row['id'])
            )
            return row['id']
            
    # 2. If no exact match, compute embeddings for semantic match
    # 2. If no exact match, compute embeddings for semantic match
    provider = settings.llm_provider
    
    kt_list = []
    if key_terms:
        try:
            kt_list = json.loads(key_terms)
        except Exception:
            pass
    text_to_embed = f"Title: {title}\nKey Terms: {', '.join(kt_list)}\nSummary: {summary or ''}"
    new_embedding = await get_embedding(text_to_embed, provider=provider)
    new_emb_json = json.dumps(new_embedding)
    
    with get_connection() as conn:
        cursor = conn.cursor()
        # Enforce book_id scoping
        cursor.execute(
            "SELECT id, embedding, content_md, key_terms, summary, title FROM topics WHERE book_id = ? AND embedding IS NOT NULL", 
            (book_id,)
        )
        rows = cursor.fetchall()
        
        max_sim = 0.0
        best_row = None
        
        for r in rows:
            try:
                emb = json.loads(r['embedding'])
                sim = cosine_similarity(new_embedding, emb)
                if sim > max_sim:
                    max_sim = sim
                    best_row = r
            except Exception:
                pass
                
        # Raise threshold to 0.94
        if max_sim >= 0.94 and best_row is not None:
            # Semantic match
            best_id = best_row['id']
            best_content = best_row['content_md']
            best_key_terms = best_row['key_terms']
            best_summary = best_row['summary']
            best_title = best_row['title']
            
            new_content = best_content
            if content_md:
                new_content = (best_content or "") + "\n\n" + content_md
                
            # Merge key terms
            merged_kt_set = set()
            if best_key_terms:
                try:
                    merged_kt_set.update(json.loads(best_key_terms))
                except Exception:
                    pass
            if key_terms:
                try:
                    merged_kt_set.update(json.loads(key_terms))
                except Exception:
                    pass
            
            merged_kt_json = json.dumps(list(merged_kt_set)) if merged_kt_set else None
            
            # Determine new merged summary for embedding
            merged_summary = best_summary if best_summary else summary
            
            # Recompute embedding for the merged concept
            merged_text_to_embed = f"Title: {best_title}\nKey Terms: {', '.join(list(merged_kt_set))}\nSummary: {merged_summary or ''}"
            merged_embedding = await get_embedding(merged_text_to_embed, provider=provider)
            merged_emb_json = json.dumps(merged_embedding)
                
            cursor.execute(
                """
                UPDATE topics SET 
                    summary = COALESCE(summary, ?),
                    concept_type = COALESCE(concept_type, ?),
                    key_terms = ?,
                    code_snippet = COALESCE(code_snippet, ?),
                    image_url = COALESCE(image_url, ?),
                    content_md = ?,
                    embedding = ?
                WHERE id = ?
                """,
                (summary, concept_type, merged_kt_json, code_snippet, image_url, new_content, merged_emb_json, best_id)
            )
            return best_id
            
        # 3. No semantic match >= 0.92, Insert new row
        cursor.execute(
            """
            INSERT INTO topics (
                book_id, parent_id, title, level, 
                start_page, end_page, content_md, sort_order,
                summary, concept_type, key_terms, code_snippet, image_url,
                breadcrumb, topic_hash, embedding
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                book_id, parent_id, title, level, 
                start_page or 0, end_page or 0, content_md, sort_order,
                summary, concept_type, key_terms, code_snippet, image_url,
                breadcrumb, topic_hash, new_emb_json
            )
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
            question = card.get("question", "")
            answer = card.get("answer", "")
            
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
                    card.get("topic_name") or "",
                    card.get("concept_type") or "",
                    card.get("summary") or "",
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
                logger.error(f"Error saving flashcard: {e}")
                
        # Recalculate flashcard_count for the topic
        cursor.execute("""
            UPDATE topics 
            SET flashcard_count = (SELECT COUNT(*) FROM flashcards WHERE topic_id = topics.id)
            WHERE id = ?
        """, (topic_id,))
                
    return inserted

def get_topic_by_id(topic_id: int) -> Optional[Dict[str, Any]]:
    """Retrieves a topic by its ID."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM topics WHERE id = ?", (topic_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

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
