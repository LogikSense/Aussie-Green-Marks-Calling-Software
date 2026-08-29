import sqlite3
import os

db_path = 'backend/crm_outcalling.db'
if not os.path.exists(db_path):
    print(f"Error: {db_path} not found")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("Schema for user_settings:")
cursor.execute("PRAGMA table_info(user_settings)")
cols = cursor.fetchall()
for col in cols:
    print(col)

print("\nSchema for campaigns:")
cursor.execute("PRAGMA table_info(campaigns)")
cols = cursor.fetchall()
for col in cols:
    print(col)

conn.close()
