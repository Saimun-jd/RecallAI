"""
Database Connection & Session Management for Recall AI.
Provides centralized connection handling, WAL mode, foreign key enforcement,
and health check probes.
"""

import os
import sqlite3
import logging
from contextlib import contextmanager
from typing import Generator, Optional
from platformdirs import user_data_dir

from app.core.config import settings

logger = logging.getLogger(__name__)

# Default active database path
DATA_DIR = user_data_dir("Recall", "Recall")
_ACTIVE_DB_PATH: str = os.path.join(DATA_DIR, "recall_saas.db")


def get_db_path() -> str:
    """Returns the currently active SQLite database path or config path."""
    return _ACTIVE_DB_PATH


def set_db_path(path: str) -> None:
    """Overrides the active database path (used for isolated unit/integration tests)."""
    global _ACTIVE_DB_PATH
    _ACTIVE_DB_PATH = path


@contextmanager
def get_db(db_path: Optional[str] = None) -> Generator[sqlite3.Connection, None, None]:
    """
    Yields a thread-safe sqlite3 database connection with Row factory,
    foreign keys enforced, and WAL journal mode.
    Rolls back automatically on unhandled exception.
    """
    path = db_path or _ACTIVE_DB_PATH
    
    # Ensure directory exists if not an in-memory database
    if path != ":memory:":
        os.makedirs(os.path.dirname(path), exist_ok=True)

    conn = sqlite3.connect(path, timeout=20.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    
    # Enable SQLite constraints and performance optimizations
    conn.execute("PRAGMA foreign_keys = ON")
    if path != ":memory:":
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")

    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def check_database_health() -> bool:
    """
    Probes the database connection.
    Returns True if database can execute a basic query, False otherwise.
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            row = cursor.fetchone()
            return row is not None and row[0] == 1
    except Exception as e:
        logger.error(f"Database health check probe failed: {e}")
        return False
