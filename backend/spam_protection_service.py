import os
import logging
import httpx
from datetime import datetime
from sqlalchemy.orm import Session
from models import TwilioPhoneNumber, AuditLog, User
from config import TELNYX_API_KEY
from twilio.rest import Client

logger = logging.getLogger(__name__)

def calculate_health_score(number: TwilioPhoneNumber) -> int:
    """
    Calculate health score from 0 to 100 based on answer rate, spam complaints, and call blocks.
    """
    score = 100
    
    # Answer rate impact (ideal > 60%)
    if number.answer_rate < 30:
        score -= 40
    elif number.answer_rate < 50:
        score -= 25
    elif number.answer_rate < 70:
        score -= 10
        
    # Spam complaints impact (-15 points per complaint)
    score -= (number.spam_complaints or 0) * 15
    
    # Call blocking events impact (-20 points per event)
    score -= (number.call_blocking_events or 0) * 20
    
    # STIR/SHAKEN status penalty
    if number.stir_shaken_status == "B (Partial)":
        score -= 10
    elif number.stir_shaken_status == "C (Gateway)":
        score -= 25
        
    return max(0, min(100, score))

def determine_health_status(score: int, complaints: int) -> str:
    if complaints >= 3:
        return "Spam Reported"
    if score >= 80:
        return "Healthy"
    if score >= 60:
        return "Warning"
    if score >= 40:
        return "High Risk"
    return "Spam Reported"

def rotate_phone_number_if_needed(db: Session, number_id: int, min_threshold: int = 40) -> dict:
    """
    Evaluates number health score. If below threshold or Spam Reported, rotates the number automatically.
    """
    db_num = db.query(TwilioPhoneNumber).filter(TwilioPhoneNumber.id == number_id).first()
    if not db_num or db_num.status == "retired":
        return {"status": "ignored", "reason": "Number invalid or already retired"}
        
    score = calculate_health_score(db_num)
    db_num.health_score = score
    db_num.health_status = determine_health_status(score, db_num.spam_complaints or 0)
    db.commit()
    
    if score >= min_threshold and db_num.health_status != "Spam Reported":
        return {"status": "healthy", "score": score, "health_status": db_num.health_status}
        
    logger.warning(f"Number {db_num.phone_number} health degraded to {score} ({db_num.health_status}). Initiating auto-rotation.")
    
    # 1. Mark current number for retirement
    agent_id = db_num.assigned_to
    assignment_type = db_num.assignment_type or "primary"
    old_phone = db_num.phone_number
    
    db_num.status = "retired"
    db_num.assigned_to = None
    db_num.health_status = "Retired"
    db_num.last_rotated_at = datetime.utcnow()
    
    provider = db_num.provider or "twilio"
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    
    # 1. Release the phone number programmatically
    if provider == "signalwire":
        try:
            import signalwire_service as sw

            if sw.release_number_sync(old_phone):
                logger.info("Released SignalWire phone number %s", old_phone)
        except Exception as e:
            logger.error("Failed to release retired number %s from SignalWire: %s", old_phone, e)
    elif provider == "telnyx":
        telnyx_key = TELNYX_API_KEY
        if telnyx_key:
            try:
                headers = {"Authorization": f"Bearer {telnyx_key}"}
                with httpx.Client() as client:
                    # Find UUID ID of the number in Telnyx
                    res = client.get(
                        "https://api.telnyx.com/v2/phone_numbers",
                        headers=headers,
                        params={"filter[phone_number]": old_phone}
                    )
                    if res.status_code == 200 and res.json().get("data"):
                        phone_id = res.json()["data"][0]["id"]
                        # Delete/Release it
                        del_res = client.delete(
                            f"https://api.telnyx.com/v2/phone_numbers/{phone_id}",
                            headers=headers
                        )
                        if del_res.status_code < 400:
                            logger.info(f"Released Telnyx phone number {old_phone} (ID: {phone_id})")
                        else:
                            logger.error(f"Telnyx delete returned code {del_res.status_code}: {del_res.text}")
            except Exception as e:
                logger.error(f"Failed to release retired number {old_phone} from Telnyx: {e}")
    else:
        if account_sid and auth_token:
            try:
                client = Client(account_sid, auth_token)
                incoming_list = client.incoming_phone_numbers.list(phone_number=old_phone)
                for incoming in incoming_list:
                    incoming.delete()
                    logger.info(f"Released phone number {old_phone} (SID: {incoming.sid}) from Twilio console.")
            except Exception as e:
                logger.error(f"Failed to release retired number {old_phone} from Twilio: {e}")
            
    replacement_number = None
    
    # 2. Check spare inventory pool first
    spare_num = db.query(TwilioPhoneNumber).filter(
        TwilioPhoneNumber.is_spare == True,
        TwilioPhoneNumber.status == "active",
        TwilioPhoneNumber.assigned_to == None,
        TwilioPhoneNumber.provider == provider,
    ).first()
    
    if spare_num:
        spare_num.assigned_to = agent_id
        spare_num.assignment_type = assignment_type
        spare_num.is_spare = False
        spare_num.health_score = 100
        spare_num.health_status = "Healthy"
        replacement_number = spare_num.phone_number
        logger.info(f"Reassigned spare number {replacement_number} to agent {agent_id}.")
    else:
        # 3. Auto-purchase replacement number via Provider API
        if provider == "signalwire":
            try:
                import signalwire_service as sw
                from signalwire_client import iso_country_from_e164, require_credentials

                require_credentials()
                country = iso_country_from_e164(old_phone)
                available = sw.search_local_numbers_sync(country)
                if available:
                    purchased = sw.purchase_number_sync(available[0]["phone_number"])
                    new_db_num = TwilioPhoneNumber(
                        phone_number=purchased.get("phone_number") or available[0]["phone_number"],
                        friendly_name=purchased.get("friendly_name") or purchased.get("phone_number"),
                        assigned_to=agent_id,
                        assignment_type=assignment_type,
                        status="active",
                        health_score=100,
                        health_status="Healthy",
                        provider="signalwire",
                        stir_shaken_status="A (Full)",
                    )
                    db.add(new_db_num)
                    db.commit()
                    db.refresh(new_db_num)
                    replacement_number = new_db_num.phone_number
                    logger.info(
                        "Auto-purchased & assigned replacement SignalWire number %s (%s) to agent %s.",
                        replacement_number,
                        country,
                        agent_id,
                    )
            except Exception as e:
                logger.error("Failed to auto-purchase SignalWire replacement number: %s", e)
        elif provider == "telnyx":
            telnyx_key = TELNYX_API_KEY
            if telnyx_key:
                try:
                    headers = {
                        "Authorization": f"Bearer {telnyx_key}",
                        "Content-Type": "application/json"
                    }
                    country = "US"
                    if old_phone.startswith("+61"):
                        country = "AU"
                    elif old_phone.startswith("+44"):
                        country = "GB"
                    elif old_phone.startswith("+64"):
                        country = "NZ"
                        
                    with httpx.Client() as client:
                        # Search available
                        search_res = client.get(
                            "https://api.telnyx.com/v2/available_phone_numbers",
                            headers=headers,
                            params={"filter[country_code]": country, "filter[limit]": 1}
                        )
                        if search_res.status_code == 200 and search_res.json().get("data"):
                            new_num = search_res.json()["data"][0]["phone_number"]
                            # Purchase it
                            order_res = client.post(
                                "https://api.telnyx.com/v2/number_orders",
                                headers=headers,
                                json={"phone_numbers": [{"phone_number": new_num}]}
                            )
                            if order_res.status_code < 400:
                                new_db_num = TwilioPhoneNumber(
                                    phone_number=new_num,
                                    friendly_name=new_num,
                                    assigned_to=agent_id,
                                    assignment_type=assignment_type,
                                    status="active",
                                    health_score=100,
                                    health_status="Healthy",
                                    provider="telnyx",
                                    stir_shaken_status="A (Full)"
                                )
                                db.add(new_db_num)
                                db.commit()
                                db.refresh(new_db_num)
                                replacement_number = new_db_num.phone_number
                                logger.info(f"Auto-purchased & assigned replacement Telnyx number {replacement_number} ({country}) to agent {agent_id}.")
                except Exception as e:
                    logger.error(f"Failed to auto-purchase Telnyx replacement number: {e}")
        else:
            if account_sid and auth_token:
                try:
                    client = Client(account_sid, auth_token)
                    
                    # Auto-detect country code from old phone number
                    country = "US"
                    if old_phone.startswith("+61"):
                        country = "AU"
                    elif old_phone.startswith("+44"):
                        country = "GB"
                    elif old_phone.startswith("+64"):
                        country = "NZ"
                    
                    available = client.available_phone_numbers(country).local.list(limit=1)
                    if available:
                        new_twilio_num = available[0].phone_number
                        purchased = client.incoming_phone_numbers.create(phone_number=new_twilio_num)
                        
                        new_db_num = TwilioPhoneNumber(
                            phone_number=purchased.phone_number,
                            friendly_name=purchased.friendly_name,
                            assigned_to=agent_id,
                            assignment_type=assignment_type,
                            status="active",
                            health_score=100,
                            health_status="Healthy",
                            provider="twilio",
                            stir_shaken_status="A (Full)"
                        )
                        db.add(new_db_num)
                        db.commit()
                        db.refresh(new_db_num)
                        replacement_number = new_db_num.phone_number
                        logger.info(f"Auto-purchased & assigned replacement Twilio number {replacement_number} ({country}) to agent {agent_id}.")
                except Exception as e:
                    logger.error(f"Failed to auto-purchase Twilio replacement number: {e}")
                
    # Update agent's primary/secondary number link if applicable
    if agent_id:
        agent = db.query(User).filter(User.id == agent_id).first()
        if agent:
            if assignment_type == "primary":
                agent.primary_number_id = spare_num.id if spare_num else (new_db_num.id if 'new_db_num' in locals() else None)
            else:
                agent.secondary_number_id = spare_num.id if spare_num else (new_db_num.id if 'new_db_num' in locals() else None)
                
    # 4. Write Audit Log
    audit = AuditLog(
        user_id=agent_id,
        action="NUMBER_AUTO_ROTATION",
        details={
            "retired_number": old_phone,
            "replacement_number": replacement_number,
            "reason": f"Health score {score} fell below threshold {min_threshold}",
            "assignment_type": assignment_type
        }
    )
    db.add(audit)
    db.commit()
    
    return {
        "status": "rotated",
        "retired_number": old_phone,
        "replacement_number": replacement_number,
        "score": score
    }
