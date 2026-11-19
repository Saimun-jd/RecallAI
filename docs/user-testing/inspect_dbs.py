import sqlite3
import glob
import os

appdata = os.environ.get('LOCALAPPDATA', '')
paths = glob.glob('*.db') + glob.glob(os.path.join(appdata, 'Recall', 'Recall', '*.db'))

for path in paths:
    try:
        conn = sqlite3.connect(path)
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cur.fetchall()]
        if 'books' in tables:
            cur.execute("SELECT id, title, total_pages FROM books")
            books = cur.fetchall()
            print(f"{path}: {len(books)} books:")
            for b in books[:5]:
                print(f"  ID {b[0]}: {b[1]} ({b[2]} pages)")
                cur.execute("SELECT COUNT(*) FROM topics WHERE book_id = ?", (b[0],))
                topics_cnt = cur.fetchone()[0]
                print(f"    -> {topics_cnt} topics extracted")
    except Exception as e:
        pass
