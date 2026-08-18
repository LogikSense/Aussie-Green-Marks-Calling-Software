import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from database import get_db
from models import TwilioPhoneNumber, AuditLog
from auth import get_current_user_jwt
from spam_protection_service import calculate_health_score, determine_health_status, rotate_phone_number_if_needed

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/spam",
    tags=["spam-protection"]
)

class ComplaintRequest(BaseModel):
    reason: Optional[str] = "Customer reported spam"

@router.get("/dashboard")
async def get_spam_dashboard(db: Session = Depends(get_db), current_user=Depends(get_current_user_jwt)):
    numbers = db.query(TwilioPhoneNumber).all()
    
    total = len(numbers)
    healthy_count = sum(1 for n in numbers if n.health_status == "Healthy" and n.status == "active")
    warning_count = sum(1 for n in numbers if n.health_status == "Warning" and n.status == "active")
    high_risk_count = sum(1 for n in numbers if n.health_status == "High Risk" and n.status == "active")
    spam_count = sum(1 for n in numbers if n.health_status == "Spam Reported" or n.status == "retired")
    spare_count = sum(1 for n in numbers if n.is_spare and n.status == "active")
    
    avg_score = (sum(n.health_score or 100 for n in numbers) / total) if total > 0 else 100
    
    audit_logs = db.query(AuditLog).filter(AuditLog.action == "NUMBER_AUTO_ROTATION").order_by(AuditLog.created_at.desc()).limit(10).all()
    
    return {
        "metrics": {
            "total_numbers": total,
            "healthy": healthy_count,
            "warning": warning_count,
            "high_risk": high_risk_count,
            "spam_reported": spam_count,
            "spare_inventory": spare_count,
            "average_health_score": round(avg_score, 1)
        },
        "recent_rotations": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "retired_number": log.details.get("retired_number"),
                "replacement_number": log.details.get("replacement_number"),
                "reason": log.details.get("reason"),
                "created_at": log.created_at.isoformat() if log.created_at else None
            } for log in audit_logs
        ]
    }

@router.get("/numbers")
async def list_spam_numbers(db: Session = Depends(get_db), current_user=Depends(get_current_user_jwt)):
    numbers = db.query(TwilioPhoneNumber).all()
    results = []
    for n in numbers:
        # Re-calculate on the fly for accurate state
        score = calculate_health_score(n)
        results.append({
            "id": n.id,
            "phone_number": n.phone_number,
            "friendly_name": n.friendly_name,
            "assigned_to": n.assigned_to,
            "assignment_type": n.assignment_type,
            "status": n.status,
            "health_score": score,
            "health_status": n.health_status or determine_health_status(score, n.spam_complaints or 0),
            "answer_rate": n.answer_rate or 85.0,
            "spam_complaints": n.spam_complaints or 0,
            "call_blocking_events": n.call_blocking_events or 0,
            "stir_shaken_status": n.stir_shaken_status or "A (Full)",
            "is_spare": n.is_spare or False,
            "last_rotated_at": n.last_rotated_at.isoformat() if n.last_rotated_at else None
        })
    return {"numbers": results}

@router.post("/numbers/{number_id}/report-complaint")
async def report_complaint(number_id: int, req: ComplaintRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user_jwt)):
    db_num = db.query(TwilioPhoneNumber).filter(TwilioPhoneNumber.id == number_id).first()
    if not db_num:
        raise HTTPException(status_code=404, detail="Number not found")
        
    db_num.spam_complaints = (db_num.spam_complaints or 0) + 1
    db.commit()
    
    rotation_res = rotate_phone_number_if_needed(db, number_id)
    return {
        "success": True,
        "new_complaint_count": db_num.spam_complaints,
        "rotation_result": rotation_res
    }

@router.post("/numbers/{number_id}/rotate")
async def force_rotate_number(number_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user_jwt)):
    rotation_res = rotate_phone_number_if_needed(db, number_id, min_threshold=100) # Force rotation
    return {"success": True, "rotation_result": rotation_res}

@router.post("/numbers/{number_id}/toggle-spare")
async def toggle_spare(number_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user_jwt)):
    db_num = db.query(TwilioPhoneNumber).filter(TwilioPhoneNumber.id == number_id).first()
    if not db_num:
        raise HTTPException(status_code=404, detail="Number not found")
        
    db_num.is_spare = not db_num.is_spare
    if db_num.is_spare:
        db_num.assigned_to = None
    db.commit()
    return {"success": True, "is_spare": db_num.is_spare}
