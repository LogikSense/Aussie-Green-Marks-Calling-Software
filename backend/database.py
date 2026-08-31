from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

from config import DATABASE_URL, connect_args

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _column_exists(inspector, table: str, column: str) -> bool:
    if table not in inspector.get_table_names():
        return False
    return column in {col["name"] for col in inspector.get_columns(table)}


def migrate_schema():
    """Add columns introduced after initial deploy (create_all does not alter tables)."""
    inspector = inspect(engine)
    alterations = [
        ("users", "role", "VARCHAR(50) DEFAULT 'agent'"),
        ("users", "tenant_id", "INTEGER DEFAULT 1"),
        ("users", "primary_number_id", "INTEGER"),
        ("users", "secondary_number_id", "INTEGER"),
        ("customers", "tenant_id", "INTEGER DEFAULT 1"),
        ("user_settings", "chatwoot_account_id", "VARCHAR(100) DEFAULT ''"),
        ("user_settings", "chatwoot_access_token", "TEXT DEFAULT ''"),
        ("user_settings", "chatwoot_url", "VARCHAR(512) DEFAULT ''"),
        ("user_settings", "auto_rotation_enabled", "BOOLEAN DEFAULT TRUE"),
        ("user_settings", "min_health_threshold", "INTEGER DEFAULT 40"),
        ("twilio_phone_numbers", "provider", "VARCHAR(50) DEFAULT 'twilio'"),
    ]

    with engine.begin() as conn:
        for table, column, col_type in alterations:
            if not _column_exists(inspector, table, column):
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {col_type}'))


def init_db():
    import models  # noqa: F401 — register all models with Base.metadata
    Base.metadata.create_all(bind=engine)
    migrate_schema()
