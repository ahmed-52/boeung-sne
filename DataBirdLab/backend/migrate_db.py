import sqlite3
import os

db_path = "data/db.sqlite"

if not os.path.exists(db_path):
    print("Database not found. It will be created by the app.")
else:
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    try:
        # Check if column exists first to be polite, or just try to add it.
        # SQLite ADD COLUMN adds it to the end.
        c.execute('ALTER TABLE acousticdetection ADD COLUMN absolute_start_time DATETIME')
        conn.commit()
        print("Column 'absolute_start_time' added successfully.")
    except sqlite3.OperationalError as e:
        print(f"Migration notice: {e}")

    conn.close()
