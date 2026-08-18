from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, Float, ForeignKey
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(String(50), default="agent") # agent, supervisor, admin
    tenant_id = Column(Integer, nullable=True, default=1)
    is_active = Column(Boolean, default=True, nullable=False)
    primary_number_id = Column(Integer, nullable=True)
    secondary_number_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    domain = Column(String(255), nullable=True)
    white_label_config = Column(JSON, nullable=True)
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
    tenant_id = Column(Integer, nullable=True, default=1)
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
    chatwoot_account_id = Column(String(100), nullable=True, default="")
    chatwoot_access_token = Column(Text, nullable=True, default="")
    chatwoot_url = Column(String(512), nullable=True, default="")
    auto_rotation_enabled = Column(Boolean, default=True)
    min_health_threshold = Column(Integer, default=40)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    vapi_assistant_id = Column(String(255), nullable=True)
    status = Column(String(50), default="active") # active, paused, completed
    tenant_id = Column(Integer, nullable=True, default=1)
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
    status = Column(String(50), default="active") # active, released, retired
    capabilities = Column(JSON, nullable=True)
    tenant_id = Column(Integer, nullable=True, default=1)
    
    # Spam Reputation & Health Tracking
    health_score = Column(Integer, default=100) # 0 to 100
    health_status = Column(String(50), default="Healthy") # Healthy, Warning, High Risk, Spam Reported, Retired
    answer_rate = Column(Float, default=85.0) # Percentage
    spam_complaints = Column(Integer, default=0)
    call_blocking_events = Column(Integer, default=0)
    stir_shaken_status = Column(String(50), default="A (Full)") # A (Full), B (Partial), C (Gateway)
    is_spare = Column(Boolean, default=False)
    last_rotated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CallTransferLog(Base):
    __tablename__ = "call_transfer_logs"

    id = Column(Integer, primary_key=True, index=True)
    call_sid = Column(String(255), nullable=False)
    from_user_id = Column(Integer, nullable=False)
    to_user_id = Column(Integer, nullable=True)
    to_queue_id = Column(Integer, nullable=True)
    transfer_type = Column(String(50), nullable=False) # blind, warm, queue
    status = Column(String(50), default="initiated") # initiated, bridged, cancelled, failed
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SupervisorSession(Base):
    __tablename__ = "supervisor_sessions"

    id = Column(Integer, primary_key=True, index=True)
    supervisor_id = Column(Integer, nullable=False)
    call_sid = Column(String(255), nullable=False)
    agent_id = Column(Integer, nullable=False)
    mode = Column(String(50), nullable=False) # listen, whisper, barge, takeover
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Queue(Base):
    __tablename__ = "queues"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    tenant_id = Column(Integer, nullable=True, default=1)
    priority = Column(Integer, default=1)
    strategy = Column(String(50), default="skill_based") # skill_based, round_robin, longest_idle
    overflow_target = Column(String(255), nullable=True)
    max_wait_seconds = Column(Integer, default=300)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True, default=1)
    user_id = Column(Integer, nullable=True)
    action = Column(String(255), nullable=False)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), unique=True, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), unique=True, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=True)
    key_hash = Column(String(255), unique=True, index=True, nullable=False)
    key_prefix = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    tenant_id = Column(Integer, nullable=True, default=1)


