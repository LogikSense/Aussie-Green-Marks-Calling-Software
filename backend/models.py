from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, Float
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


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    vapi_assistant_id = Column(String(255), nullable=True)
    status = Column(String(50), default="active") # active, paused, completed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    total_leads = Column(Integer, default=0)
    calls_made = Column(Integer, default=0)
    success_rate = Column(String(50), default="0%")


class CampaignLead(Base):
    __tablename__ = "campaign_leads"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, nullable=False)
    customer_id = Column(String(255), nullable=False) # Maps to Customer.customer_id
    status = Column(String(50), default="pending") # pending, calling, completed, failed
    vapi_call_id = Column(String(255), nullable=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    result = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, unique=True)
    balance = Column(Float, default=0.0)
    currency = Column(String(10), default="AUD")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    amount = Column(Float, nullable=False)
    type = Column(String(50), nullable=False) # topup, usage
    description = Column(String(255), nullable=True)
    status = Column(String(50), default="completed") # pending, completed, failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TwilioPhoneNumber(Base):
    __tablename__ = "twilio_phone_numbers"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(50), unique=True, index=True, nullable=False)
    friendly_name = Column(String(255), nullable=True)
    locality = Column(String(100), nullable=True)
    region = Column(String(100), nullable=True)
    assigned_to = Column(Integer, nullable=True) # user_id
    assignment_type = Column(String(50), nullable=True) # primary, secondary
    status = Column(String(50), default="active") # active, released
    capabilities = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

