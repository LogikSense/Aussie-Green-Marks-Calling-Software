import sqlite3
from datetime import datetime
import bcrypt

# Password to set
new_password = "Admin123456"

# Hash the password using bcrypt
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

conn = sqlite3.connect('crm_outcalling.db')
cursor = conn.cursor()

# Update password for admin@example.com
password_hash = hash_password(new_password)
cursor.execute('UPDATE users SET password_hash = ? WHERE email = ?', (password_hash, 'admin@example.com'))
conn.commit()

print(f"Password reset for admin@example.com")
print(f"New password: {new_password}")

conn.close()

