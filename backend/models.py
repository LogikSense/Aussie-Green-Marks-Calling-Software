from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String(255), unique=True, index=True, nullable=False)
    first_name = Column(String(255), nullable=False, default="")
    last_name = Column(String(255), nullable=False, default="")
    phone = Column(String(100), nullable=False, default="")
    email = Column(String(255), nullable=True, default="")
    address = Column(Text, nullable=True, default="")
    date_of_birth = Column(String(50), nullable=True, default="")
    last_four_ssn = Column(String(20), nullable=True, default="")
    security_answer = Column(Text, nullable=True, default="")
    status = Column(String(100), nullable=False, default="ready_for_auditing")
    import_date = Column(String(50), nullable=True)
    previous_attempts = Column(Integer, default=0, nullable=False)
    last_contact_date = Column(String(50), nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, unique=True)
    crm_endpoint = Column(String(512), nullable=True, default="")
    crm_api_key = Column(Text, nullable=True, default="")
    vapi_api_key = Column(Text, nullable=True, default="")
    vapi_phone_number_id = Column(String(255), nullable=True, default="")
    vapi_assistant_id = Column(String(255), nullable=True, default="")
    webhook_url = Column(String(512), nullable=True, default="")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
