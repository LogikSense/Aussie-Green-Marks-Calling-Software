import sqlite3

def run_migration():
    conn = sqlite3.connect('crm_outcalling.db')
    cursor = conn.cursor()

    def add_column_if_not_exists(table, column, col_type):
        # Check if table exists
        cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
        if not cursor.fetchone():
            print(f"Table '{table}' does not exist, skipping column checks (will be created automatically by SQLAlchemy).")
            return
            
        # Check if column exists
        cursor.execute(f"PRAGMA table_info({table})")
        columns = [row[1] for row in cursor.fetchall()]
        if column not in columns:
            print(f"Adding column '{column}' to table '{table}'...")
            try:
                cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
                conn.commit()
            except Exception as e:
                print(f"Error adding column '{column}' to table '{table}': {e}")
        else:
            print(f"Column '{column}' in table '{table}' already exists.")

    print("Starting database schema migration...")
    
    # 1. users table columns
    add_column_if_not_exists("users", "role", "VARCHAR(50) DEFAULT 'agent'")
    add_column_if_not_exists("users", "tenant_id", "INTEGER DEFAULT 1")
    add_column_if_not_exists("users", "primary_number_id", "INTEGER")
    add_column_if_not_exists("users", "secondary_number_id", "INTEGER")
    add_column_if_not_exists("users", "created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP")

    # 2. customers table columns
    add_column_if_not_exists("customers", "tenant_id", "INTEGER DEFAULT 1")

    # 3. user_settings table columns
    add_column_if_not_exists("user_settings", "chatwoot_account_id", "VARCHAR(100) DEFAULT ''")
    add_column_if_not_exists("user_settings", "chatwoot_access_token", "TEXT DEFAULT ''")
    add_column_if_not_exists("user_settings", "chatwoot_url", "VARCHAR(512) DEFAULT ''")
    add_column_if_not_exists("user_settings", "auto_rotation_enabled", "BOOLEAN DEFAULT 1")
    add_column_if_not_exists("user_settings", "min_health_threshold", "INTEGER DEFAULT 40")

    # 4. campaigns table columns
    add_column_if_not_exists("campaigns", "tenant_id", "INTEGER DEFAULT 1")

    # 5. twilio_phone_numbers table columns
    add_column_if_not_exists("twilio_phone_numbers", "tenant_id", "INTEGER DEFAULT 1")
    add_column_if_not_exists("twilio_phone_numbers", "health_score", "INTEGER DEFAULT 100")
    add_column_if_not_exists("twilio_phone_numbers", "health_status", "VARCHAR(50) DEFAULT 'Healthy'")
    add_column_if_not_exists("twilio_phone_numbers", "answer_rate", "FLOAT DEFAULT 85.0")
    add_column_if_not_exists("twilio_phone_numbers", "spam_complaints", "INTEGER DEFAULT 0")
    add_column_if_not_exists("twilio_phone_numbers", "call_blocking_events", "INTEGER DEFAULT 0")
    add_column_if_not_exists("twilio_phone_numbers", "stir_shaken_status", "VARCHAR(50) DEFAULT 'A (Full)'")
    add_column_if_not_exists("twilio_phone_numbers", "is_spare", "BOOLEAN DEFAULT 0")
    add_column_if_not_exists("twilio_phone_numbers", "provider", "VARCHAR(50) DEFAULT 'twilio'")
    add_column_if_not_exists("twilio_phone_numbers", "last_rotated_at", "DATETIME")
    add_column_if_not_exists("twilio_phone_numbers", "created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP")

    conn.close()
    print("Database migration completed successfully!")

if __name__ == "__main__":
    run_migration()
