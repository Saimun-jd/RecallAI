import os
import logging
import traceback
from typing import Dict, Any, List, Optional
from supabase import create_client, Client
from app.database import get_connection

logger = logging.getLogger(__name__)

# List of tables to sync, in dependency order
SYNC_TABLES = ["books", "topics", "flashcards", "notes", "review_log", "pdf_annotations"]

def extract_user_id_from_token(token: Optional[str]) -> Optional[str]:
    """Extracts user_id ('sub' claim) directly from JWT payload without network calls."""
    if not token:
        return None
    try:
        parts = token.split(".")
        if len(parts) >= 2:
            import base64
            import json
            payload_b64 = parts[1]
            payload_b64 += "=" * (-len(payload_b64) % 4)
            data = json.loads(base64.urlsafe_b64decode(payload_b64).decode("utf-8"))
            return data.get("sub")
    except Exception:
        pass
    return None

def get_supabase_client(token: str) -> Client:
    import sys
    import os
    from supabase import create_client, Client
    
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
    # 1. Always set PostgREST auth header immediately so database queries succeed
    try:
        supabase.postgrest.auth(token)
    except Exception:
        pass
    # 2. Best-effort GoTrue session initialization (non-blocking if offline/signing out)
    try:
        supabase.auth.set_session(access_token=token, refresh_token="dummy")
    except Exception as e:
        logger.debug(f"GoTrue session set_session skipped: {e}")
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

def normalize_timestamp(ts: Any) -> str:
    """Normalizes various timestamp formats (e.g. ISO 8601 with T/Z/+00:00 or space) to standard 'YYYY-MM-DD HH:MM:SS'."""
    if not ts:
        return "1970-01-01 00:00:00"
    cleaned = str(ts).replace("T", " ").replace("Z", "")
    if "+" in cleaned:
        cleaned = cleaned.split("+")[0]
    if "." in cleaned:
        cleaned = cleaned.split(".")[0]
    cleaned = cleaned.strip()
    return cleaned if cleaned else "1970-01-01 00:00:00"

def translate_fks_for_push(table: str, record: dict, mappings: dict) -> bool:
    """
    Translates local integer foreign keys to remote UUIDs before pushing.
    Returns True if translation succeeded, False if a required foreign key could not be resolved.
    """
    # Remove local-only 'id'
    record.pop("id", None)
    
    if table == "books":
        if record.get("last_topic_id"):
            record["last_topic_id"] = mappings.get("topics", {}).get(record["last_topic_id"])
    elif table == "topics":
        if record.get("book_id"):
            book_uuid = mappings.get("books", {}).get(record["book_id"])
            if not book_uuid:
                return False
            record["book_id"] = book_uuid
        if record.get("parent_id"):
            record["parent_id"] = mappings.get("topics", {}).get(record["parent_id"])
    elif table == "flashcards":
        if record.get("topic_id"):
            topic_uuid = mappings.get("topics", {}).get(record["topic_id"])
            if not topic_uuid:
                return False
            record["topic_id"] = topic_uuid
    elif table == "notes":
        if record.get("topic_id"):
            topic_uuid = mappings.get("topics", {}).get(record["topic_id"])
            if not topic_uuid:
                return False
            record["topic_id"] = topic_uuid
    elif table == "review_log":
        if record.get("flashcard_id"):
            fc_uuid = mappings.get("flashcards", {}).get(record["flashcard_id"])
            if not fc_uuid:
                return False
            record["flashcard_id"] = fc_uuid
    elif table == "pdf_annotations":
        if record.get("book_id"):
            book_uuid = mappings.get("books", {}).get(record["book_id"])
            if not book_uuid:
                return False
            record["book_id"] = book_uuid
            
    # Clean up null bytes from all string fields as Postgres rejects \u0000
    for k, v in record.items():
        if isinstance(v, str):
            record[k] = v.replace("\x00", "")

    return True

def translate_fks_for_pull(table: str, record: dict, reverse_mappings: dict) -> bool:
    """
    Translates remote UUID foreign keys back into local integer IDs before pulling.
    Returns True if translation was successful, False if a parent is missing (skip record).
    """
    if "user_id" in record:
        record.pop("user_id", None)
        
    if table == "books":
        if record.get("last_topic_id"):
            record["last_topic_id"] = reverse_mappings.get("topics", {}).get(record["last_topic_id"])
    elif table == "topics":
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
        if not record.get("book_id"):
            return False
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
                # 0. Get local tombstones for this table to blacklist resurrection
                cursor.execute("SELECT uuid FROM sync_tombstones WHERE table_name = ?", (table,))
                local_tombstones = {row["uuid"] for row in cursor.fetchall()}

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

                # 2. Server deletion reconciliation (for books table)
                if table == "books" and last_sync != "1970-01-01 00:00:00":
                    reconcile_remote_deletions(supabase, last_sync)

                # 3. Fetch updated records from Supabase
                response = supabase.table(table).select("*").gt("updated_at", last_sync).order("updated_at").execute()
                records = response.data
                
                if not records:
                    continue
                    
                cursor.execute(f"PRAGMA table_info({table})")
                table_cols = {row['name'] for row in cursor.fetchall()}

                deferred_records = []
                for raw_record in records:
                    # Skip any record that was locally deleted (prevent resurrection)
                    if raw_record.get("uuid") in local_tombstones:
                        logger.info(f"Skipping resurrecting locally deleted {table} record: {raw_record.get('uuid')}")
                        continue

                    record = {k: v for k, v in raw_record.items() if k in table_cols}
                    success = translate_fks_for_pull(table, record, reverse_mappings)
                    if not success:
                        deferred_records.append(record)
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

                while deferred_records:
                    resolved_in_this_pass = 0
                    still_deferred = []
                    for record in deferred_records:
                        success = translate_fks_for_pull(table, record, reverse_mappings)
                        if success:
                            resolved_in_this_pass += 1
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
                                logger.error(f"Failed to upsert deferred record into {table}: {e}")
                        else:
                            still_deferred.append(record)
                    
                    deferred_records = still_deferred
                    if resolved_in_this_pass == 0:
                        logger.debug(f"Skipping {len(deferred_records)} orphaned records in {table} (parent not present or deleted).")
                        break
            except Exception as e:
                logger.error(f"Error pulling table {table} from Supabase: {e}")
                raise e

def reconcile_remote_deletions(supabase: Client, last_sync: str):
    """
    Reconciles deletions performed directly on Supabase (e.g. from web app or another client).
    Deletes local books that are missing from Supabase.
    """
    if last_sync == "1970-01-01 00:00:00":
        return

    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            remote_books_resp = supabase.table("books").select("uuid").execute()
            if remote_books_resp and remote_books_resp.data is not None:
                remote_uuids = {r["uuid"] for r in remote_books_resp.data if r.get("uuid")}
                
                cursor.execute("SELECT uuid FROM sync_tombstones WHERE table_name = 'books'")
                local_tombstones = {row["uuid"] for row in cursor.fetchall()}
                
                cursor.execute("SELECT id, uuid, file_path, file_hash, created_at, updated_at FROM books WHERE uuid IS NOT NULL")
                local_synced_books = cursor.fetchall()
                
                norm_last_sync = normalize_timestamp(last_sync)
                
                # Grace period: do not delete any book created or updated within the last 10 minutes
                import datetime
                utc_now = datetime.datetime.now(datetime.timezone.utc)
                grace_cutoff = (utc_now - datetime.timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M:%S")
                
                for b in local_synced_books:
                    b_created = normalize_timestamp(b["created_at"]) if "created_at" in b.keys() else "1970-01-01 00:00:00"
                    b_updated = normalize_timestamp(b["updated_at"]) if "updated_at" in b.keys() else b_created
                    
                    # 1. Protect any book created or modified within the 10-minute grace period
                    if b_created > grace_cutoff or b_updated > grace_cutoff:
                        continue
                        
                    # 2. If the book was created or updated locally on or after last_sync, it is a newly added local book
                    # or has local pending changes that have not yet been pushed to Supabase.
                    # It MUST NOT be considered a remote deletion!
                    if b_created >= norm_last_sync or b_updated >= norm_last_sync:
                        continue

                    if b["uuid"] not in remote_uuids and b["uuid"] not in local_tombstones:
                        logger.info(f"Reconciling remote deletion for book id={b['id']}, uuid={b['uuid']}")
                        cursor.execute("DELETE FROM books WHERE id = ?", (b["id"],))
                        try:
                            from app.models.repositories import DocumentRepository
                            docs = DocumentRepository.list_by_workspace(workspace_id="default", limit=500)
                            for doc in docs:
                                if doc.get("metadata", {}).get("book_id") == b["id"] or doc.get("id") == str(b["id"]):
                                    DocumentRepository.delete_document_cascade(doc["id"], "default")
                        except Exception as e:
                            logger.warning(f"Failed to cascade remote deletion to DocumentRepository: {e}")
        except Exception as e:
            logger.warning(f"Failed to reconcile remote book deletions: {e}")

def push_changes(supabase: Client, last_sync: str, token: Optional[str] = None):
    """Pushes local changes that occurred after last_sync to Supabase."""
    with get_connection() as conn:
        cursor = conn.cursor()
        user_id = extract_user_id_from_token(token)
        if not user_id:
            try:
                user_response = supabase.auth.get_user()
                user_id = user_response.user.id if user_response and user_response.user else None
            except Exception:
                pass
        
        if not user_id:
            logger.info("Sync push skipped: No authenticated user session.")
            return
            
        import uuid
        for table in SYNC_TABLES:
            cursor.execute(f"SELECT id FROM {table} WHERE uuid IS NULL")
            missing = cursor.fetchall()
            for r in missing:
                cursor.execute(f"UPDATE {table} SET uuid = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (str(uuid.uuid4()), r['id']))
            
        mappings = {t: get_mapping_id_to_uuid(t) for t in SYNC_TABLES}
        norm_last_sync = normalize_timestamp(last_sync)
            
        for table in SYNC_TABLES:
            try:
                # Fetch local records modified since last sync using normalized timestamp comparison.
                # For topics, push parent topics first (level ASC) so parent_id references succeed.
                order_clause = "ORDER BY level ASC" if table == "topics" else ""
                cursor.execute(
                    f"""SELECT * FROM {table} 
                        WHERE datetime(replace(replace(replace(updated_at, 'T', ' '), 'Z', ''), '+00:00', '')) > datetime(?)
                        {order_clause}""",
                    (norm_last_sync,)
                )
                rows = cursor.fetchall()
                
                if rows:
                    raw_records = [dict(row) for row in rows]
                    
                    # If pushing topics, ensure parent books exist on Supabase
                    if table == "topics":
                        try:
                            remote_books_resp = supabase.table("books").select("uuid").execute()
                            remote_book_uuids = {r["uuid"] for r in (remote_books_resp.data or []) if r.get("uuid")}
                        except Exception as e:
                            logger.warning(f"Could not verify remote books: {e}")
                            remote_book_uuids = set()

                        valid_records = []
                        for r in raw_records:
                            r["user_id"] = user_id
                            if not translate_fks_for_push(table, r, mappings):
                                continue
                            book_uuid = r.get("book_id")
                            if not book_uuid:
                                continue
                            if book_uuid not in remote_book_uuids:
                                # Check if book exists locally; if so, push the book first!
                                cursor.execute("SELECT * FROM books WHERE uuid = ?", (book_uuid,))
                                book_row = cursor.fetchone()
                                if book_row:
                                    try:
                                        book_dict = dict(book_row)
                                        book_dict["user_id"] = user_id
                                        translate_fks_for_push("books", book_dict, mappings)
                                        supabase.table("books").upsert([book_dict], on_conflict="uuid").execute()
                                        remote_book_uuids.add(book_uuid)
                                    except Exception as book_push_err:
                                        logger.warning(f"Failed to auto-push parent book {book_uuid}: {book_push_err}")
                                        continue
                                else:
                                    # Parent book doesn't exist locally or remotely; skip orphaned topic
                                    logger.warning(f"Skipping topic {r.get('uuid')} - parent book {book_uuid} not found on remote")
                                    continue
                            valid_records.append(r)
                        records = valid_records
                    else:
                        valid_records = []
                        for r in raw_records:
                            r["user_id"] = user_id
                            if translate_fks_for_push(table, r, mappings):
                                valid_records.append(r)
                        records = valid_records
                    
                    # Batch in chunks of 100 for PostgREST with fallback error isolation
                    for i in range(0, len(records), 100):
                        batch = records[i:i + 100]
                        try:
                            supabase.table(table).upsert(batch, on_conflict="uuid").execute()
                        except Exception as batch_err:
                            err_str = str(batch_err)
                            if "23503" in err_str or "23505" in err_str or "foreign key" in err_str.lower() or "violates" in err_str.lower() or "constraint" in err_str.lower():
                                logger.warning(f"Batch upsert failed for {table} with constraint error. Retrying individually to isolate valid records...")
                                for item in batch:
                                    try:
                                        supabase.table(table).upsert([item], on_conflict="uuid").execute()
                                    except Exception as single_err:
                                        logger.warning(f"Skipping {table} record {item.get('uuid')} due to constraint: {single_err}")
                            else:
                                raise batch_err
                    
            except Exception as e:
                logger.error(f"Error pushing table {table} to Supabase: {e}")
                logger.error(traceback.format_exc())
                raise e

        # Process local tombstones in reverse dependency order (children first) to avoid FK constraint errors on Supabase
        for table in reversed(SYNC_TABLES):
            try:
                cursor.execute("SELECT uuid, deleted_at FROM sync_tombstones WHERE table_name = ?", (table,))
                tombstone_rows = cursor.fetchall()
                if tombstone_rows:
                    uuids_to_delete = [r["uuid"] for r in tombstone_rows]
                    # Chunk deletes into batches of 50 to avoid URL length limits
                    for i in range(0, len(uuids_to_delete), 50):
                        batch_uuids = uuids_to_delete[i:i + 50]
                        supabase.table(table).delete().in_("uuid", batch_uuids).execute()
                    
                    # Push tombstones to Supabase so other clients know to delete (batched by 100)
                    tombstones_payload = [{"uuid": r["uuid"], "table_name": table, "deleted_at": r["deleted_at"], "user_id": user_id} for r in tombstone_rows]
                    for i in range(0, len(tombstones_payload), 100):
                        batch_payload = tombstones_payload[i:i + 100]
                        supabase.table("sync_tombstones").upsert(batch_payload, on_conflict="uuid").execute()
            except Exception as e:
                logger.error(f"Error pushing tombstones for {table}: {e}")
                logger.error(traceback.format_exc())
                raise e

def sync_with_remote(token: str):
    """Coordinates the two-way sync process."""
    try:
        supabase = get_supabase_client(token)
        last_sync = get_last_sync_time()
        
        logger.info(f"Starting sync loop. Last sync was: {last_sync}")
        
        # 1. Push local changes and tombstones FIRST so newly created books and records are preserved
        push_changes(supabase, last_sync, token=token)
        
        # 2. Pull remote changes and apply remote tombstones
        pull_changes(supabase, last_sync)
        
        # 3. Reconcile out-of-band remote deletions (e.g. manual dashboard deletions)
        reconcile_remote_deletions(supabase, last_sync)
        
        import datetime
        now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        update_last_sync_time(now)
        
        return {"status": "success", "synced_at": now}
    except Exception as e:
        logger.exception("Sync failed")
        raise e
import httpx
import json

async def download_missing_pdfs_stream(token: str):
    supabase = get_supabase_client(token)
    user_response = supabase.auth.get_user()
    user_id = user_response.user.id if user_response and user_response.user else None
    
    if not user_id:
        yield f"data: {json.dumps({'status': 'error', 'message': 'Not logged in'})}\n\n"
        return

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, title, file_hash, file_path FROM books")
        books = cursor.fetchall()
        
    from app.main import PARSED_DOCS_DIR
    import os
    
    missing_books = []
    for b in books:
        expected_path = os.path.join(PARSED_DOCS_DIR, f"{b['file_hash']}.pdf")
        if not os.path.exists(expected_path):
            missing_books.append((b, expected_path))
            
    if not missing_books:
        yield f"data: {json.dumps({'status': 'complete'})}\n\n"
        return
        
    total_books = len(missing_books)
    for i, (b, expected_path) in enumerate(missing_books):
        book_title = b['title']
        yield f"data: {json.dumps({'status': 'downloading', 'current': i + 1, 'total': total_books, 'title': book_title, 'percentage': 0})}\n\n"
        
        # Download from Supabase Storage
        remote_path = f"{user_id}/{b['file_hash']}.pdf"
        try:
            # We must use raw HTTP since supabase-py storage doesn't support streaming easily, 
            # or we can just download it. supabase-py download() returns bytes. 
            # If it's a large PDF, it might take a moment.
            res = supabase.storage.from_("user_pdfs").download(remote_path)
            
            with open(expected_path, "wb") as f:
                f.write(res)
                
            yield f"data: {json.dumps({'status': 'downloading', 'current': i + 1, 'total': total_books, 'title': book_title, 'percentage': 100})}\n\n"
        except Exception as e:
            logger.error(f"Failed to download PDF {book_title}: {e}")
            yield f"data: {json.dumps({'status': 'error', 'message': f'Failed to download {book_title}'})}\n\n"
            
    yield f"data: {json.dumps({'status': 'complete'})}\n\n"
