# database.py
import psycopg2
from app.config import settings
import logging

logger = logging.getLogger(__name__)

def init_db():
    try:
        conn = psycopg2.connect(settings.database_url)
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        logger.info("Database connection successful and vector extension enabled.")
        conn.close()
    except Exception as e:
        logger.error(f"Failed to connect to database or create extension: {e}")
