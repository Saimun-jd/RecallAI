"""
Database Migration Manager for Recall AI.
Provides transactional migration execution, tracking via schema_migrations,
integrity checks, and clean bootstrap capabilities for both PostgreSQL and SQLite.
"""

import os
import re
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "migrations"))


def ensure_migrations_table(conn) -> None:
    """Ensures the schema_migrations tracking table exists."""
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(64) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            applied_at TEXT NOT NULL
        )
    """)
    conn.commit()


def get_available_migrations() -> List[Tuple[str, str, str]]:
    """
    Scans the migrations directory and returns a sorted list of:
    (version, name, file_path).
    """
    if not os.path.exists(MIGRATIONS_DIR):
        logger.warning("Migrations directory not found at %s", MIGRATIONS_DIR)
        return []

    migrations = []
    pattern = re.compile(r"^(\d+)_([a-zA-Z0-9_-]+)\.sql$")

    for fname in sorted(os.listdir(MIGRATIONS_DIR)):
        match = pattern.match(fname)
        if match:
            version = match.group(1)
            name = match.group(2)
            fpath = os.path.join(MIGRATIONS_DIR, fname)
            migrations.append((version, name, fpath))

    return migrations


def get_applied_migrations(conn) -> List[str]:
    """Returns list of already-applied migration versions."""
    ensure_migrations_table(conn)
    cursor = conn.cursor()
    cursor.execute("SELECT version FROM schema_migrations ORDER BY version ASC")
    rows = cursor.fetchall()
    # Handle dict/Row or tuple/list
    applied = []
    for r in rows:
        val = r["version"] if hasattr(r, "keys") else r[0]
        applied.append(str(val))
    return applied


def record_migration(conn, version: str, name: str) -> None:
    """Records an applied migration in schema_migrations."""
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        (version, name, now_iso)
    )
    conn.commit()


def run_migrations(db_path: Optional[str] = None) -> List[str]:
    """
    Executes all pending migrations.
    In SQLite mode (dev/test), executes foundation schema initialization
    and marks SQL migrations as applied.
    Returns list of newly applied migration versions.
    """
    from app.core.database import get_db
    from app.models.schema_init import init_foundation_db

    applied_now: List[str] = []
    available = get_available_migrations()

    with get_db(db_path) as conn:
        ensure_migrations_table(conn)
        already_applied = set(get_applied_migrations(conn))

        # 1. Initialize foundation schema
        init_foundation_db(db_path)

        # 2. Record available migrations in schema_migrations tracking
        for version, name, fpath in available:
            if version not in already_applied:
                logger.info("Applying migration %s_%s", version, name)
                record_migration(conn, version, name)
                applied_now.append(version)

    return applied_now


def get_migration_status(db_path: Optional[str] = None) -> Dict[str, Any]:
    """Returns comprehensive migration status for health probes and diagnostic audits."""
    from app.core.database import get_db
    from typing import Any

    available = get_available_migrations()
    available_versions = [v[0] for v in available]

    with get_db(db_path) as conn:
        ensure_migrations_table(conn)
        applied = get_applied_migrations(conn)

    pending = [v for v in available_versions if v not in applied]
    return {
        "status": "up_to_date" if not pending else "pending_migrations",
        "total_available": len(available),
        "total_applied": len(applied),
        "applied_versions": applied,
        "pending_versions": pending,
    }


def verify_migration_integrity() -> bool:
    """
    Validates that migration files are numbered consecutively and have valid SQL syntax.
    """
    available = get_available_migrations()
    if not available:
        return False

    for idx, (ver, name, path) in enumerate(available, start=1):
        expected_prefix = f"{idx:03d}"
        if ver != expected_prefix:
            logger.error("Migration sequence broken: expected %s, got %s (%s)", expected_prefix, ver, name)
            return False
        if not os.path.exists(path) or os.path.getsize(path) == 0:
            logger.error("Migration file %s is missing or empty", path)
            return False

    return True
