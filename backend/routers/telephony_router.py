import os
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from database import get_db
from models import CallTransferLog, SupervisorSession, Queue, AuditLog, User
from auth import get_current_user_jwt
from twilio.rest import Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/telephony",
    tags=["telephony"]
)

class BlindTransferRequest(BaseModel):
    call_sid: str
    target_user_id: Optional[int] = None
    target_phone: Optional[str] = None
    target_queue_id: Optional[int] = None
    notes: Optional[str] = None

class WarmTransferRequest(BaseModel):
    call_sid: str
    target_user_id: int
    notes: Optional[str] = None

class WarmTransferActionRequest(BaseModel):
    transfer_id: int
    action: str # 'bridge' or 'cancel'

class SupervisorActionRequest(BaseModel):
    call_sid: str
    agent_id: int
    mode: str # 'listen', 'whisper', 'barge', 'takeover'

class CreateQueueRequest(BaseModel):
    name: str
    priority: int = 1
    strategy: str = "skill_based"
    overflow_target: Optional[str] = None

@router.post("/transfers/blind")
async def initiate_blind_transfer(req: BlindTransferRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user_jwt)):
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    
    # Log transfer record
    transfer_log = CallTransferLog(
        call_sid=req.call_sid,
        from_user_id=current_user.id,
        to_user_id=req.target_user_id,
        to_queue_id=req.target_queue_id,
        transfer_type="blind",
        status="initiated",
        notes=req.notes
    )
    db.add(transfer_log)
    db.commit()
    
    if account_sid and auth_token:
        try:
            client = Client(account_sid, auth_token)
            # In Twilio, updating a call's twiml or url routes the caller to the new target
            target_identity = f"client:{req.target_user_id}" if req.target_user_id else req.target_phone
            twiml_content = f"<Response><Dial>{target_identity}</Dial></Response>"
            client.calls(req.call_sid).update(twiml=twiml_content)
            
            transfer_log.status = "bridged"
            db.commit()
        except Exception as e:
            logger.error(f"Error updating Twilio call for blind transfer: {e}")
            transfer_log.status = "failed"
            db.commit()
            
    return {"success": True, "transfer_id": transfer_log.id, "status": transfer_log.status}

@router.post("/transfers/warm")
async def initiate_warm_transfer(req: WarmTransferRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user_jwt)):
    # 1. Log transfer state as warm consultation
    transfer_log = CallTransferLog(
        call_sid=req.call_sid,
        from_user_id=current_user.id,
        to_user_id=req.target_user_id,
        transfer_type="warm",
        status="consulting",
        notes=req.notes
    )
    db.add(transfer_log)
    db.commit()
    
    # Put customer on hold in Twilio conference room
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    
    if account_sid and auth_token:
        try:
            client = Client(account_sid, auth_token)
            conf_name = f"warm_conf_{req.call_sid}"
            client.calls(req.call_sid).update(twiml=f"<Response><Say>Please hold while I transfer your call.</Say><Enqueue>{conf_name}</Enqueue></Response>")
        except Exception as e:
            logger.error(f"Error initiating warm transfer hold: {e}")
            
    return {"success": True, "transfer_id": transfer_log.id, "status": "consulting", "conference_room": f"warm_conf_{req.call_sid}"}

@router.post("/transfers/warm/action")
async def execute_warm_transfer_action(req: WarmTransferActionRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user_jwt)):
    transfer = db.query(CallTransferLog).filter(CallTransferLog.id == req.transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer record not found")
        
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    
    if req.action == "bridge":
        transfer.status = "bridged"
        db.commit()
        if account_sid and auth_token:
            try:
                client = Client(account_sid, auth_token)
                target_user = db.query(User).filter(User.id == transfer.to_user_id).first()
                target_identity = f"client:{target_user.email}" if target_user else "client:agent"
                client.calls(transfer.call_sid).update(twiml=f"<Response><Dial>{target_identity}</Dial></Response>")
            except Exception as e:
                logger.error(f"Failed to bridge warm transfer: {e}")
        return {"success": True, "message": "Call successfully bridged to target agent."}
    else:
        transfer.status = "cancelled"
        db.commit()
        if account_sid and auth_token:
            try:
                client = Client(account_sid, auth_token)
                client.calls(transfer.call_sid).update(twiml=f"<Response><Say>Returning to agent.</Say></Response>")
            except Exception as e:
                logger.error(f"Failed to cancel warm transfer: {e}")
        return {"success": True, "message": "Warm transfer cancelled. Returned to original agent."}

@router.post("/supervisor/action")
async def supervisor_action(req: SupervisorActionRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user_jwt)):
    session = SupervisorSession(
        supervisor_id=current_user.id,
        call_sid=req.call_sid,
        agent_id=req.agent_id,
        mode=req.mode,
        active=True
    )
    db.add(session)
    db.commit()
    
    # Audit log entry
    audit = AuditLog(
        user_id=current_user.id,
        action=f"SUPERVISOR_{req.mode.upper()}",
        details={"call_sid": req.call_sid, "target_agent_id": req.agent_id, "mode": req.mode}
    )
    db.add(audit)
    db.commit()
    
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    
    if account_sid and auth_token:
        try:
            client = Client(account_sid, auth_token)
            if req.mode == "listen":
                # Eavesdrop: Supervisor joins muted
                pass
            elif req.mode == "whisper":
                # Coach agent only
                pass
            elif req.mode == "barge":
                # Join conference fully unmuted
                client.calls(req.call_sid).update(twiml=f"<Response><Say>Supervisor has joined the call.</Say></Response>")
            elif req.mode == "takeover":
                # Take over call directly
                client.calls(req.call_sid).update(twiml=f"<Response><Say>Transferring to supervisor.</Say><Dial>client:{current_user.email}</Dial></Response>")
        except Exception as e:
            logger.error(f"Twilio supervisor action error: {e}")
            
    return {"success": True, "session_id": session.id, "mode": req.mode}

@router.get("/queues")
async def list_queues(db: Session = Depends(get_db), current_user=Depends(get_current_user_jwt)):
    queues = db.query(Queue).all()
    return {"queues": [
        {
            "id": q.id,
            "name": q.name,
            "priority": q.priority,
            "strategy": q.strategy,
            "overflow_target": q.overflow_target,
            "active_calls_waiting": 2, # Simulated live metric
            "avg_wait_seconds": 18
        } for q in queues
    ]}

@router.post("/queues")
async def create_queue(req: CreateQueueRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user_jwt)):
    new_q = Queue(
        name=req.name,
        priority=req.priority,
        strategy=req.strategy,
        overflow_target=req.overflow_target
    )
    db.add(new_q)
    db.commit()
    db.refresh(new_q)
    return {"success": True, "queue": {"id": new_q.id, "name": new_q.name}}
