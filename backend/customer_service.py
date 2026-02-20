from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from models import Customer


def row_to_dict(row: Customer) -> dict:
    return {
        "id": row.id,
        "customerId": row.customer_id,
        "firstName": row.first_name or "",
        "lastName": row.last_name or "",
        "phone": row.phone or "",
        "email": row.email or "",
        "address": row.address or "",
        "dateOfBirth": row.date_of_birth or "",
        "lastFourSSN": row.last_four_ssn or "",
        "securityAnswer": row.security_answer or "",
        "status": row.status or "ready_for_auditing",
        "importDate": row.import_date,
        "previousAttempts": row.previous_attempts or 0,
        "lastContactDate": row.last_contact_date,
        "metadata": row.metadata_,
    }


def count_customers(db: Session, status: Optional[str] = None) -> int:
    q = db.query(Customer)
    if status:
        q = q.filter(Customer.status == status)
    return q.count()


def list_customers(
    db: Session,
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> Tuple[List[dict], int]:
    q = db.query(Customer)
    if status:
        q = q.filter(Customer.status == status)
    total = q.count()
    rows = q.order_by(Customer.id).offset(offset).limit(limit).all()
    return [row_to_dict(r) for r in rows], total


def get_by_customer_id(db: Session, customer_id: str) -> Optional[dict]:
    row = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if row:
        return row_to_dict(row)
    try:
        pk = int(customer_id)
        row = db.query(Customer).filter(Customer.id == pk).first()
        return row_to_dict(row) if row else None
    except (ValueError, TypeError):
        return None


def get_by_id(db: Session, id: int) -> Optional[dict]:
    row = db.query(Customer).filter(Customer.id == id).first()
    return row_to_dict(row) if row else None


def upsert_customer(db: Session, d: dict) -> dict:
    customer_id = str(d.get("customerId", "")).strip()
    if not customer_id:
        raise ValueError("customerId required")
    existing = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    import_date = d.get("importDate")
    if not import_date:
        from datetime import datetime
        import_date = datetime.now().isoformat()
    if existing:
        existing.first_name = d.get("firstName", "") or ""
        existing.last_name = d.get("lastName", "") or ""
        existing.phone = d.get("phone", "") or ""
        existing.email = d.get("email", "") or ""
        existing.address = d.get("address", "") or ""
        existing.date_of_birth = d.get("dateOfBirth", "") or ""
        existing.last_four_ssn = d.get("lastFourSSN", "") or ""
        existing.security_answer = d.get("securityAnswer", "") or ""
        existing.status = d.get("status", "ready_for_auditing") or "ready_for_auditing"
        existing.import_date = import_date
        existing.previous_attempts = d.get("previousAttempts", 0) or 0
        existing.last_contact_date = d.get("lastContactDate")
        existing.metadata_ = d.get("metadata")
        db.commit()
        db.refresh(existing)
        return row_to_dict(existing)
    row = Customer(
        customer_id=customer_id,
        first_name=d.get("firstName", "") or "",
        last_name=d.get("lastName", "") or "",
        phone=d.get("phone", "") or "",
        email=d.get("email", "") or "",
        address=d.get("address", "") or "",
        date_of_birth=d.get("dateOfBirth", "") or "",
        last_four_ssn=d.get("lastFourSSN", "") or "",
        security_answer=d.get("securityAnswer", "") or "",
        status=d.get("status", "ready_for_auditing") or "ready_for_auditing",
        import_date=import_date,
        previous_attempts=d.get("previousAttempts", 0) or 0,
        last_contact_date=d.get("lastContactDate"),
        metadata_=d.get("metadata"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row_to_dict(row)


def add_customer(db: Session, d: dict) -> Optional[dict]:
    customer_id = str(d.get("customerId", "")).strip()
    if not customer_id:
        return None
    if db.query(Customer).filter(Customer.customer_id == customer_id).first():
        return None
    import_date = d.get("importDate")
    if not import_date:
        from datetime import datetime
        import_date = datetime.now().isoformat()
    row = Customer(
        customer_id=customer_id,
        first_name=d.get("firstName", "") or "",
        last_name=d.get("lastName", "") or "",
        phone=d.get("phone", "") or "",
        email=d.get("email", "") or "",
        address=d.get("address", "") or "",
        date_of_birth=d.get("dateOfBirth", "") or "",
        last_four_ssn=d.get("lastFourSSN", "") or "",
        security_answer=d.get("securityAnswer", "") or "",
        status=d.get("status", "ready_for_auditing") or "ready_for_auditing",
        import_date=import_date,
        previous_attempts=d.get("previousAttempts", 0) or 0,
        last_contact_date=d.get("lastContactDate"),
        metadata_=d.get("metadata"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row_to_dict(row)
