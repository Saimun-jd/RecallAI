import os
import logging
from typing import Dict, Any, List
from supabase import create_client, Client
from app.database import get_connection

logger = logging.getLogger(__name__)

# List of tables to sync, in dependency order
SYNC_TABLES = ["books", "topics", "flashcards", "notes", "review_log", "pdf_annotations"]

def get_supabase_client(token: str) -> Client:
    import sys
    
    if hasattr(sys, '_MEIPASS'):
        env_path = os.path.join(sys._MEIPASS, '.env')
    else:
        env_path = '.env'
        
    from dotenv import load_dotenv
    load_dotenv(env_path)
    
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env")
    
    supabase = create_client(url, key)
    # By passing only the access_token, the client acts on behalf of the user
    # Note: refresh_token is not needed here as frontend manages the session lifecycle
    supabase.auth.set_session(access_token=token, refresh_token="dummy")
    return supabase

def get_last_sync_time() -> str:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM settings WHERE key = 'last_sync_time'")
        row = cursor.fetchone()
        return row['value'] if row else "1970-01-01 00:00:00"

def update_last_sync_time(timestamp: str):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO settings (key, value)
            VALUES ('last_sync_time', ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value
        """, (timestamp,))


# -----------------------------------------------------------------------------
# Translation Layer (Local ID <-> Remote UUID)
# -----------------------------------------------------------------------------

def get_mapping_id_to_uuid(table: str) -> Dict[int, str]:
    """Returns a dict mapping local `id` (int) to remote `uuid` (str)."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"SELECT id, uuid FROM {table} WHERE uuid IS NOT NULL")
        return {row["id"]: row["uuid"] for row in cursor.fetchall()}

def get_mapping_uuid_to_id(table: str) -> Dict[str, int]:
    """Returns a dict mapping remote `uuid` (str) to local `id` (int)."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"SELECT uuid, id FROM {table} WHERE uuid IS NOT NULL")
        return {row["uuid"]: row["id"] for row in cursor.fetchall()}

def translate_fks_for_push(table: str, record: dict, mappings: dict):
    """
    Translates local integer foreign keys to remote UUIDs before pushing.
    """
    # Remove local-only 'id'
    record.pop("id", None)
    
    if table == "topics":
        if record.get("book_id"):
            record["book_id"] = mappings["books"].get(record["book_id"])
        if record.get("parent_id"):
            record["parent_id"] = mappings["topics"].get(record["parent_id"])
    elif table == "flashcards":
        if record.get("topic_id"):
            record["topic_id"] = mappings["topics"].get(record["topic_id"])
    elif table == "notes":
        if record.get("topic_id"):
            record["topic_id"] = mappings["topics"].get(record["topic_id"])
    elif table == "review_log":
        if record.get("flashcard_id"):
            record["flashcard_id"] = mappings["flashcards"].get(record["flashcard_id"])
    elif table == "pdf_annotations":
        if record.get("book_id"):
            record["book_id"] = mappings["books"].get(record["book_id"])
            
    # Clean up null bytes from all string fields as Postgres rejects \u0000
    for k, v in record.items():
        if isinstance(v, str):
            record[k] = v.replace("\x00", "")

def translate_fks_for_pull(table: str, record: dict, reverse_mappings: dict) -> bool:
    """
    Translates remote UUID foreign keys back into local integer IDs before pulling.
    Returns True if translation was successful, False if a parent is missing (skip record).
    """
    if "user_id" in record:
        record.pop("user_id", None)
        
    if table == "topics":
        if record.get("book_id"):
            local_id = reverse_mappings["books"].get(record["book_id"])
            if not local_id: return False
            record["book_id"] = local_id
        if record.get("parent_id"):
            local_id = reverse_mappings["topics"].get(record["parent_id"])
            if not local_id: return False
            record["parent_id"] = local_id
    elif table == "flashcards":
        if record.get("topic_id"):
            local_id = reverse_mappings["topics"].get(record["topic_id"])
            if not local_id: return False
            record["topic_id"] = local_id
    elif table == "notes":
        if record.get("topic_id"):
            local_id = reverse_mappings["topics"].get(record["topic_id"])
            if not local_id: return False
            record["topic_id"] = local_id
    elif table == "review_log":
        if record.get("flashcard_id"):
            local_id = reverse_mappings["flashcards"].get(record["flashcard_id"])
            if not local_id: return False
            record["flashcard_id"] = local_id
    elif table == "pdf_annotations":
        if record.get("book_id"):
            local_id = reverse_mappings["books"].get(record["book_id"])
            if not local_id: return False
            record["book_id"] = local_id
            
    return True


# -----------------------------------------------------------------------------
# Push & Pull Operations
# -----------------------------------------------------------------------------

def pull_changes(supabase: Client, last_sync: str):
    """Pulls changes from Supabase that occurred after last_sync."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        reverse_mappings = {t: get_mapping_uuid_to_id(t) for t in SYNC_TABLES}
        
        for table in SYNC_TABLES:
            try:
                # 1. Pull and apply tombstones for this table
                tombstones_resp = supabase.table("sync_tombstones").select("uuid").eq("table_name", table).gt("deleted_at", last_sync).execute()
                if tombstones_resp.data:
                    deleted_uuids = [t["uuid"] for t in tombstones_resp.data]
                    if deleted_uuids:
                        placeholders = ",".join(["?"] * len(deleted_uuids))
                        # Execute local hard delete; SQLite ON DELETE CASCADE will handle children,
                        # and our BEFORE DELETE triggers will put these into the local sync_tombstones.
                        # This ensures our local database stays perfectly consistent.
                        cursor.execute(f"DELETE FROM {table} WHERE uuid IN ({placeholders})", deleted_uuids)

                # 2. Fetch updated records from Supabase
                response = supabase.table(table).select("*").gt("updated_at", last_sync).order("updated_at").execute()
                records = response.data
                
                if not records:
                    continue
                    
                for record in records:
                    # Translate foreign keys (UUID -> int)
                    success = translate_fks_for_pull(table, record, reverse_mappings)
                    if not success:
                        logger.warning(f"Skipping remote record {record.get('uuid')} in {table} due to missing parent.")
                        continue
                        
                    for k, v in record.items():
                        if isinstance(v, bool):
                            record[k] = 1 if v else 0
                    
                    columns = ", ".join(record.keys())
                    placeholders = ", ".join(["?" for _ in record.values()])
                    update_clause = ", ".join([f"{k}=excluded.{k}" for k in record.keys() if k != "uuid"])
                    
                    query = f"""
                        INSERT INTO {table} ({columns})
                        VALUES ({placeholders})
                        ON CONFLICT(uuid) DO UPDATE SET {update_clause}
                    """
                    
                    try:
                        cursor.execute(query, tuple(record.values()))
                        if record["uuid"] not in reverse_mappings[table]:
                            cursor.execute(f"SELECT id FROM {table} WHERE uuid = ?", (record["uuid"],))
                            new_row = cursor.fetchone()
                            if new_row:
                                reverse_mappings[table][record["uuid"]] = new_row["id"]
                                
                    except Exception as e:
                        logger.error(f"Failed to upsert record into {table}: {e}")
            except Exception as e:
                logger.error(f"Error pulling table {table} from Supabase: {e}")

def push_changes(supabase: Client, last_sync: str):
    """Pushes local changes that occurred after last_sync to Supabase."""
    with get_connection() as conn:
        cursor = conn.cursor()
        user_response = supabase.auth.get_user()
        user_id = user_response.user.id if user_response and user_response.user else None
        
        if not user_id:
            logger.error("Could not determine user_id from token")
            return
            
        import uuid
        for table in SYNC_TABLES:
            cursor.execute(f"SELECT id FROM {table} WHERE uuid IS NULL")
            missing = cursor.fetchall()
            for r in missing:
                cursor.execute(f"UPDATE {table} SET uuid = ? WHERE id = ?", (str(uuid.uuid4()), r['id']))
        conn.commit()
            
        mappings = {t: get_mapping_id_to_uuid(t) for t in SYNC_TABLES}
            
        for table in SYNC_TABLES:
            try:
                # Fetch local records modified since last sync
                cursor.execute(f"SELECT * FROM {table} WHERE updated_at > ?", (last_sync,))
                rows = cursor.fetchall()
                
                if rows:
                    records = [dict(row) for row in rows]
                    for r in records:
                        r["user_id"] = user_id
                        translate_fks_for_push(table, r, mappings)
                    
                    res = supabase.table(table).upsert(records, on_conflict="uuid").execute()
                    
            except Exception as e:
                logger.error(f"Error pushing table {table} to Supabase: {e}")
                import traceback
                with open(r"C:\Users\user\.gemini\antigravity-ide\brain\39d21ad3-51f9-4c1c-955c-aaaf3b917b83\scratch\sync_error.txt", "a", encoding="utf-8") as f:
                    f.write(f"Error pushing table {table}:\n{traceback.format_exc()}\n")
                    f.write(f"First record: {records[0] if records else 'None'}\n\n")

        # Process local tombstones in reverse dependency order (children first) to avoid FK constraint errors on Supabase
        for table in reversed(SYNC_TABLES):
            try:
                cursor.execute("SELECT uuid, deleted_at FROM sync_tombstones WHERE table_name = ? AND deleted_at > ?", (table, last_sync))
                tombstone_rows = cursor.fetchall()
                if tombstone_rows:
                    uuids_to_delete = [r["uuid"] for r in tombstone_rows]
                    # Send delete requests to Supabase
                    supabase.table(table).delete().in_("uuid", uuids_to_delete).execute()
                    
                    # Push tombstones to Supabase so other clients know to delete
                    tombstones_payload = [{"uuid": r["uuid"], "table_name": table, "deleted_at": r["deleted_at"]} for r in tombstone_rows]
                    supabase.table("sync_tombstones").upsert(tombstones_payload, on_conflict="uuid").execute()
            except Exception as e:
                logger.error(f"Error pushing tombstones for {table}: {e}")

def sync_with_remote(token: str):
    """Coordinates the two-way sync process."""
    try:
        supabase = get_supabase_client(token)
        last_sync = get_last_sync_time()
        
        logger.info(f"Starting sync loop. Last sync was: {last_sync}")
        
        pull_changes(supabase, last_sync)
        push_changes(supabase, last_sync)
        
        import datetime
        now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        update_last_sync_time(now)
        
        return {"status": "success", "synced_at": now}
    except Exception as e:
        logger.exception("Sync failed")
        raise e
