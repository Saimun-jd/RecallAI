import pytest
import uuid
from app.database import (
    init_db, save_book, get_connection, save_note_for_topic, get_note_by_topic
)
from app.sync_service import (
    translate_fks_for_push, translate_fks_for_pull, get_mapping_id_to_uuid, get_mapping_uuid_to_id
)

@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()

def test_notes_creation_and_retrieval_with_uuid():
    uid = uuid.uuid4().hex[:8]
    book_id = save_book("Sync Test Book", f"test_{uid}.pdf", f"hash_{uid}", 100)
    
    with get_connection() as conn:
        cur = conn.cursor()
        t_uuid = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO topics (book_id, title, level, start_page, end_page, sort_order, topic_hash, uuid, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (book_id, "Test Note Topic", 1, 1, 10, 1, f"hash_topic_{uid}", t_uuid))
        topic_id = cur.lastrowid
        
    note_content = "# Test Cornell Note\n\n- Key Point 1\n- Key Point 2"
    save_note_for_topic(topic_id, note_content)
    
    # 1. Verify retrieval
    retrieved = get_note_by_topic(topic_id)
    assert retrieved == note_content
    
    # 2. Verify UUID & timestamps exist
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT uuid, updated_at, topic_id, content FROM notes WHERE topic_id = ?", (topic_id,))
        row = cur.fetchone()
        assert row is not None
        assert row['uuid'] is not None
        assert len(row['uuid']) == 36
        assert row['updated_at'] is not None
        assert row['content'] == note_content

def test_notes_push_pull_translation():
    topic_local_id = 999
    topic_remote_uuid = str(uuid.uuid4())
    
    mappings = {
        "topics": {topic_local_id: topic_remote_uuid},
        "books": {},
        "flashcards": {}
    }
    reverse_mappings = {
        "topics": {topic_remote_uuid: topic_local_id},
        "books": {},
        "flashcards": {}
    }
    
    # Push translation: local topic_id (int) -> remote topic_id (uuid)
    local_record = {
        "id": 1,
        "uuid": str(uuid.uuid4()),
        "topic_id": topic_local_id,
        "content": "Note markdown",
        "user_id": "test-user"
    }
    translate_fks_for_push("notes", local_record, mappings)
    assert "id" not in local_record
    assert local_record["topic_id"] == topic_remote_uuid
    
    # Pull translation: remote topic_id (uuid) -> local topic_id (int)
    remote_record = {
        "uuid": local_record["uuid"],
        "topic_id": topic_remote_uuid,
        "content": "Note markdown",
        "user_id": "test-user"
    }
    success = translate_fks_for_pull("notes", remote_record, reverse_mappings)
    assert success is True
    assert remote_record["topic_id"] == topic_local_id
    assert "user_id" not in remote_record
