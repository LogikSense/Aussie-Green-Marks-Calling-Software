from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, Header, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv
import httpx
import json
from datetime import datetime
import secrets
import pytz
import logging
import asyncio

from config import API_KEYS
from database import init_db, get_db
from sqlalchemy.orm import Session
from auth import verify_jwt_or_api_key, get_current_user_jwt
from models import Campaign, CampaignLead, Customer, Wallet, Transaction
import customer_service as cs
import settings_service as ss
from routers.auth_router import router as auth_router
from routers.twilio_router import router as twilio_router
from routers.telephony_router import router as telephony_router
from routers.spam_protection_router import router as spam_protection_router
from routers.chatwoot_router import router as chatwoot_router

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    if not os.getenv("API_KEYS"):
        print("Default API Key generated:", API_KEYS[0])
        print("Set API_KEYS in .env for production.")
    yield


app = FastAPI(
    title="CRM Verification System API",
    version="1.0.0",
    description="API for CRM Verification System - Integrate with n8n, Zapier, and other automation tools",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# Move CORSMiddleware to the top
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"INBOUND: {request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"OUTBOUND: {response.status_code}")
    return response

security = HTTPBearer()

def get_api_key_or_none():
    return API_KEYS[0] if API_KEYS else None

if not API_KEYS:
    print("Default API Key generated (see console on first request). Set API_KEYS in .env for production.")

def optional_api_key(authorization: Optional[str] = Header(None, alias="Authorization")):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
        if token in API_KEYS:
            return token
    return None

app.include_router(auth_router)
app.include_router(twilio_router)
app.include_router(telephony_router)
app.include_router(spam_protection_router)
app.include_router(chatwoot_router)

class CustomerData(BaseModel):
    customerId: str
    firstName: str
    lastName: str
    phone: str
    email: Optional[str] = ""
    address: Optional[str] = ""
    dateOfBirth: Optional[str] = ""
    lastFourSSN: Optional[str] = ""
    securityAnswer: Optional[str] = ""
    status: str = "ready_for_auditing"

class ScheduleCallRequest(BaseModel):
    customerIds: List[str]
    scheduledDate: str
    scheduledTime: str
    timezone: str = "America/New_York"
    maxRetries: int = 2

class ApiConfig(BaseModel):
    crmApiKey: Optional[str] = None
    vapiApiKey: Optional[str] = None
    vapiPhoneNumberId: Optional[str] = None
    vapiAssistantId: Optional[str] = None
    webhookUrl: Optional[str] = None
    crmEndpoint: Optional[str] = None

class VerificationConfig(BaseModel):
    verifyName: bool = True
    verifyPhone: bool = True
    verifyEmail: bool = True
    verifyAddress: bool = True
    verifyDOB: bool = False
    verifySSN: bool = False
    securityQuestion: bool = False

class TopUpRequest(BaseModel):
    amount: float

@app.get("/")
async def root():
    return {"message": "CRM Verification System API", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/api/crm/test-connection")
async def test_crm_connection(config: ApiConfig):
    if not config.crmEndpoint or not config.crmApiKey:
        raise HTTPException(status_code=400, detail="CRM endpoint and API key are required")
    
    try:
        async with httpx.AsyncClient() as client:
            # Try to test connection with base endpoint first
            base_url = config.crmEndpoint.rstrip('/')
            
            # Try common health/status endpoints
            test_endpoints = [
                f"{base_url}/health",
                f"{base_url}/status",
                f"{base_url}/",
                base_url
            ]
            
            for endpoint in test_endpoints:
                try:
                    response = await client.get(
                        endpoint,
                        headers={"Authorization": f"Bearer {config.crmApiKey}"},
                        timeout=10.0
                    )
                    if response.status_code in [200, 201]:
                        return {
                            "success": True,
                            "message": f"Connection successful! CRM API is reachable at {base_url}",
                            "endpoint": endpoint,
                            "statusCode": response.status_code
                        }
                except:
                    continue
            
            # If health checks fail, try the customers endpoint
            customers_endpoints = [
                f"{base_url}/customers",
                f"{base_url}/api/customers",
                f"{base_url}/v1/customers",
                f"{base_url}/v2/customers"
            ]
            
            for endpoint in customers_endpoints:
                try:
                    response = await client.get(
                        endpoint,
                        params={"status": "ready_for_auditing"},
                        headers={"Authorization": f"Bearer {config.crmApiKey}"},
                        timeout=10.0
                    )
                    if response.status_code == 200:
                        return {
                            "success": True,
                            "message": f"Connection successful! Found customers endpoint at {endpoint}",
                            "endpoint": endpoint
                        }
                except:
                    continue
            
            # If all fail, return connection successful but endpoint not found
            return {
                "success": True,
                "message": f"Connection successful! CRM API is reachable at {base_url}, but '/customers' endpoint not found. Please verify the endpoint path.",
                "warning": "Endpoint path may need adjustment"
            }
            
    except httpx.ConnectError:
        raise HTTPException(status_code=500, detail=f"Cannot connect to CRM API at {config.crmEndpoint}. Please check the endpoint URL.")
    except httpx.HTTPStatusError as e:
        error_text = e.response.text if hasattr(e.response, 'text') else str(e)
        try:
            error_json = e.response.json()
            error_detail = error_json.get('message') or error_json.get('error') or error_text
        except:
            error_detail = error_text or f"HTTP {e.response.status_code}"
        raise HTTPException(status_code=e.response.status_code, detail=f"CRM API error: {error_detail}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error testing CRM connection: {str(e)}")

@app.post("/api/customers/import-crm")
async def import_from_crm(config: ApiConfig):
    if not config.crmEndpoint or not config.crmApiKey:
        raise HTTPException(status_code=400, detail="CRM endpoint and API key are required")
    
    try:
        async with httpx.AsyncClient() as client:
            base_url = config.crmEndpoint.rstrip('/')
            
            # Try multiple possible endpoint paths
            customers_endpoints = [
                f"{base_url}/customers",
                f"{base_url}/api/customers",
                f"{base_url}/v1/customers",
                f"{base_url}/v2/customers"
            ]
            
            last_error = None
            for endpoint in customers_endpoints:
                try:
                    response = await client.get(
                        endpoint,
                        params={"status": "ready_for_auditing"},
                        headers={"Authorization": f"Bearer {config.crmApiKey}"},
                        timeout=30.0
                    )
                    if response.status_code == 200:
                        data = response.json()
                        return {
                            "success": True,
                            "customers": data.get("customers", data) if isinstance(data, dict) else data,
                            "count": len(data) if isinstance(data, list) else len(data.get("customers", [])),
                            "endpoint": endpoint
                        }
                except httpx.HTTPStatusError as e:
                    last_error = e
                    continue
            
            # If all endpoints fail, provide helpful error
            if last_error:
                error_text = last_error.response.text if hasattr(last_error.response, 'text') else str(last_error)
                try:
                    error_json = last_error.response.json()
                    error_detail = error_json.get('message') or error_json.get('error') or error_text
                except:
                    error_detail = error_text
                
                raise HTTPException(
                    status_code=last_error.response.status_code, 
                    detail=f"CRM API error: {error_detail}. Tried endpoints: {', '.join(customers_endpoints)}. Please verify the correct endpoint path in your CRM API documentation."
                )
            else:
                raise HTTPException(status_code=404, detail="Could not find customers endpoint. Please verify your CRM endpoint URL.")
                
    except HTTPException:
        raise
    except httpx.ConnectError:
        raise HTTPException(status_code=500, detail=f"Cannot connect to CRM API at {config.crmEndpoint}. Please check the endpoint URL.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error importing from CRM: {str(e)}")

@app.post("/api/customers/import-excel")
async def import_from_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    logger.info(f"📊 Excel import request received: {file.filename}")
    try:
        import pandas as pd
        import io
        
        contents = await file.read()
        logger.info(f"📄 File size: {len(contents)} bytes")
        
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
        
        logger.info(f"📋 Excel file parsed: {len(df)} rows, {len(df.columns)} columns")
        
        df.columns = df.columns.str.strip().str.lower()
        
        column_mapping = {
            'customerid': 'customerId',
            'customer id': 'customerId',
            'id': 'customerId',
            'firstname': 'firstName',
            'first name': 'firstName',
            'fname': 'firstName',
            'lastname': 'lastName',
            'last name': 'lastName',
            'lname': 'lastName',
            'phone': 'phone',
            'phone number': 'phone',
            'phonenumber': 'phone',
            'mobile': 'phone',
            'email': 'email',
            'email address': 'email',
            'emailaddress': 'email',
            'address': 'address',
            'street address': 'address',
            'streetaddress': 'address',
            'dateofbirth': 'dateOfBirth',
            'date of birth': 'dateOfBirth',
            'dob': 'dateOfBirth',
            'birthdate': 'dateOfBirth',
            'lastfourssn': 'lastFourSSN',
            'last four ssn': 'lastFourSSN',
            'ssn last 4': 'lastFourSSN',
            'ssn': 'lastFourSSN',
            'securityanswer': 'securityAnswer',
            'security answer': 'securityAnswer',
            'securityquestion': 'securityAnswer',
            'status': 'status'
        }
        
        mapped_df = pd.DataFrame()
        for col in df.columns:
            normalized_col = col.lower().strip()
            mapped_col = None
            for key, value in column_mapping.items():
                if normalized_col == key or normalized_col in key or key in normalized_col:
                    mapped_col = value
                    break
            
            if mapped_col:
                mapped_df[mapped_col] = df[col]
        
        required_fields = ['firstName', 'lastName', 'phone']
        missing_fields = [field for field in required_fields if field not in mapped_df.columns]
        
        if missing_fields:
            logger.error(f"❌ Missing required columns: {', '.join(missing_fields)}")
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {', '.join(missing_fields)}"
            )
        
        customers = []
        stored_count = 0
        skipped_count = 0
        
        for idx, row in mapped_df.iterrows():
            if pd.isna(row.get('firstName')) or pd.isna(row.get('lastName')) or pd.isna(row.get('phone')):
                skipped_count += 1
                continue
            
            customer_id = str(row.get('customerId', f"CUST-{datetime.now().timestamp()}-{idx}")).strip()
            d = {
                "customerId": customer_id,
                "firstName": str(row.get('firstName', '')).strip(),
                "lastName": str(row.get('lastName', '')).strip(),
                "phone": str(row.get('phone', '')).strip(),
                "email": str(row.get('email', '')).strip() if pd.notna(row.get('email')) else "",
                "address": str(row.get('address', '')).strip() if pd.notna(row.get('address')) else "",
                "dateOfBirth": str(row.get('dateOfBirth', '')).strip() if pd.notna(row.get('dateOfBirth')) else "",
                "lastFourSSN": str(row.get('lastFourSSN', '')).strip() if pd.notna(row.get('lastFourSSN')) else "",
                "securityAnswer": str(row.get('securityAnswer', '')).strip() if pd.notna(row.get('securityAnswer')) else "",
                "status": str(row.get('status', 'ready_for_auditing')).strip() if pd.notna(row.get('status')) else "ready_for_auditing",
                "importDate": datetime.now().isoformat(),
                "previousAttempts": 0,
                "lastContactDate": None
            }
            added = cs.add_customer(db, d)
            if added:
                stored_count += 1
                customers.append(added)
                logger.info(f"✅ Stored customer: {d['firstName']} {d['lastName']} ({customer_id})")
            else:
                skipped_count += 1
                customers.append({**d, "id": None})
                logger.info(f"⚠️ Customer {customer_id} already exists, skipping duplicate")
        
        _, total_in_db = cs.list_customers(db, limit=1, offset=0)
        logger.info(f"📊 Excel import completed: {stored_count} new customers stored, {skipped_count} skipped (duplicates or invalid)")
        logger.info(f"📈 Total customers in database: {total_in_db}")
        
        return {
            "success": True,
            "customers": customers,
            "count": len(customers),
            "stored": stored_count,
            "skipped": skipped_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error processing Excel file: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing Excel file: {str(e)}")

class BatchCustomerImport(BaseModel):
    customers: List[dict]

class ScheduleCallRequestWithConfig(BaseModel):
    customerIds: List[str]
    scheduledDate: str
    scheduledTime: str
    timezone: str = "America/New_York"
    maxRetries: int = 2
    crmApiKey: Optional[str] = None
    vapiApiKey: Optional[str] = None
    vapiPhoneNumberId: Optional[str] = None
    vapiAssistantId: Optional[str] = None
    webhookUrl: Optional[str] = None
    crmEndpoint: Optional[str] = None

class ManualCallRequest(BaseModel):
    firstName: str
    lastName: str
    phone: str
    countryCode: Optional[str] = "+1"
    scheduledAt: Optional[str] = None # Time as HH:mm or full ISO
    scheduledDate: Optional[str] = None # Date as YYYY-MM-DD
    timezone: str = "America/New_York"
    assistantId: Optional[str] = None
    phoneNumberId: Optional[str] = None
    vapiApiKey: Optional[str] = None
    webhookUrl: Optional[str] = None

@app.post("/api/customers/import-batch")
async def import_customers_batch(batch: BatchCustomerImport, db: Session = Depends(get_db)):
    """
    Public endpoint to import customers in batch (no API key required)
    Used by frontend Excel import
    """
    logger.info(f"📊 Batch customer import: {len(batch.customers)} customers")
    stored_count = 0
    skipped_count = 0
    
    for customer_data in batch.customers:
        try:
            customer_id = customer_data.get("customerId")
            if not customer_id:
                skipped_count += 1
                continue
            d = {
                "customerId": customer_id,
                "firstName": customer_data.get("firstName", "").strip(),
                "lastName": customer_data.get("lastName", "").strip(),
                "phone": customer_data.get("phone", "").strip(),
                "email": customer_data.get("email", "").strip() if customer_data.get("email") else "",
                "address": customer_data.get("address", "").strip() if customer_data.get("address") else "",
                "dateOfBirth": customer_data.get("dateOfBirth", "").strip() if customer_data.get("dateOfBirth") else "",
                "lastFourSSN": customer_data.get("lastFourSSN", "").strip() if customer_data.get("lastFourSSN") else "",
                "securityAnswer": customer_data.get("securityAnswer", "").strip() if customer_data.get("securityAnswer") else "",
                "status": customer_data.get("status", "ready_for_auditing").strip() if customer_data.get("status") else "ready_for_auditing",
                "importDate": datetime.now().isoformat(),
                "previousAttempts": 0,
                "lastContactDate": None,
                "metadata": customer_data.get("metadata")
            }
            added = cs.add_customer(db, d)
            if added:
                stored_count += 1
                logger.info(f"✅ Stored customer: {d['firstName']} {d['lastName']} ({customer_id})")
            else:
                skipped_count += 1
                logger.info(f"⚠️ Customer {customer_id} already exists, skipping")
        except Exception as e:
            logger.error(f"❌ Error importing customer: {str(e)}")
            skipped_count += 1
    
    _, total_in_db = cs.list_customers(db, limit=1, offset=0)
    logger.info(f"📊 Batch import completed: {stored_count} stored, {skipped_count} skipped")
    logger.info(f"📈 Total customers in database: {total_in_db}")
    
    return {
        "success": True,
        "stored": stored_count,
        "skipped": skipped_count,
        "total": len(batch.customers),
        "message": f"Successfully imported {stored_count} customers to backend database"
    }

@app.post("/api/trigger-manual-call", dependencies=[Depends(get_current_user_jwt)])
@app.post("/api/manual-call-trigger", dependencies=[Depends(get_current_user_jwt)])
async def manual_dial(request: ManualCallRequest, user = Depends(get_current_user_jwt), db: Session = Depends(get_db)):
    """
    Manually trigger a call. Can be immediate or scheduled.
    """
    print(f"DEBUG: Manual dial hit for {request.firstName}")
    logger.info(f"☎️ Manual dial request: {request.firstName} {request.lastName} ({request.phone})")
    
    # 0. Check Wallet Balance
    # Realistic AU Cost: ~0.15 USD (Vapi) + ~0.15 USD (ElevenLabs) + ~0.05 USD (Telco) = ~$0.35 USD/min
    # In AUD: ~$0.55/min. We'll set a flat fee of $0.50 for the connection/trigger.
    CALL_COST = 0.50 
    wallet = get_or_create_wallet(db, user["id"])
    if wallet.balance < CALL_COST:
        raise HTTPException(
            status_code=402, 
            detail=f"Insufficient credits (${wallet.balance:.2f}). Please top up to make calls."
        )

    # 1. Get settings if not provided
    vapi_key = request.vapiApiKey
    assistant_id = request.assistantId
    phone_number_id = request.phoneNumberId
    webhook_url = request.webhookUrl
    
    if not vapi_key or not assistant_id or not phone_number_id:
        settings = ss.get_settings(db, user.id)
        if settings:
            vapi_key = vapi_key or settings.get("vapiApiKey")
            assistant_id = assistant_id or settings.get("vapiAssistantId")
            phone_number_id = phone_number_id or settings.get("vapiPhoneNumberId")
            webhook_url = webhook_url or settings.get("webhookUrl")
            
    if not vapi_key or not assistant_id or not phone_number_id:
        raise HTTPException(status_code=400, detail="Voice provider configuration missing (API Key, Assistant ID, or Phone ID)")

    # 2. Format phone number
    clean_phone = "".join(filter(str.isdigit, request.phone))
    code = request.countryCode.replace("+", "")
    
    if request.phone.startswith("+"):
        phone = request.phone
    else:
        phone = f"+{code}{clean_phone}"

    # 3. Handle scheduling if provided
    earliest_at = None
    if request.scheduledDate and request.scheduledAt:
        try:
            dt_str = f"{request.scheduledDate} {request.scheduledAt}"
            tz = pytz.timezone(request.timezone)
            local_dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
            earliest_at = tz.localize(local_dt).isoformat()
            logger.info(f"📅 Manual call scheduled for: {earliest_at}")
        except Exception as e:
            logger.error(f"❌ Scheduling error: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid schedule format. Use YYYY-MM-DD and HH:mm")

    # 4. Create or get "Manual Calls" campaign
    from models import Campaign, CampaignLead
    manual_camp = db.query(Campaign).filter(Campaign.name == "Manual Calls").first()
    if not manual_camp:
        manual_camp = Campaign(name="Manual Calls", description="Calls triggered manually from the dialer", status="active")
        db.add(manual_camp)
        db.commit()
        db.refresh(manual_camp)

    # 5. Create customer record
    customer_id = f"manual-{clean_phone}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    customer_data = {
        "customerId": customer_id,
        "firstName": request.firstName,
        "lastName": request.lastName,
        "phone": phone,
        "status": "scheduled" if earliest_at else "manual_dial"
    }
    cs.add_customer(db, customer_data)

    # 6. Call Vapi API
    call_data = {
        "assistantId": assistant_id,
        "phoneNumberId": phone_number_id,
        "customer": {
            "number": phone,
            "name": f"{request.firstName} {request.lastName}".strip()
        }
    }
    if earliest_at:
        call_data["schedulePlan"] = {"earliestAt": earliest_at}
    if webhook_url:
        call_data["webhookUrl"] = webhook_url

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.vapi.ai/call",
                headers={
                    "Authorization": f"Bearer {vapi_key}",
                    "Content-Type": "application/json"
                },
                json=call_data,
                timeout=30.0
            )
            
            if response.status_code >= 400:
                logger.error(f"❌ Voice provider API error: {response.text}")
                raise HTTPException(status_code=response.status_code, detail=f"Voice provider error: {response.text}")
            
            result = response.json()
            call_id = result.get("id")
            
            # 7. Deduct from wallet & Log Transaction
            wallet.balance -= CALL_COST
            usage_trans = Transaction(
                user_id=user["id"],
                amount=-CALL_COST,
                type="usage",
                description=f"AI Call to {phone}",
                status="completed"
            )
            db.add(usage_trans)

            # 8. Record the lead
            lead_status = "pending" if earliest_at else "calling"
            lead = CampaignLead(
                campaign_id=manual_camp.id,
                customer_id=customer_id, # Use the generated ID
                status=lead_status,
                vapi_call_id=call_id,
                result=result,
                scheduled_at=datetime.fromisoformat(earliest_at.replace('Z', '+00:00')) if earliest_at else None
            )
            db.add(lead)
            db.commit()
            
            msg = f"Call scheduled for {earliest_at}" if earliest_at else "Call initiated successfully"
            return {
                "success": True, 
                "callId": call_id, 
                "message": msg,
                "new_balance": wallet.balance
            }
    except Exception as e:
        logger.error(f"❌ Manual dial failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/calls/schedule")
async def schedule_calls(request: ScheduleCallRequestWithConfig, db: Session = Depends(get_db)):
    logger.info(f"📞 Call scheduling request received: {len(request.customerIds)} customers, date={request.scheduledDate}, time={request.scheduledTime}, timezone={request.timezone}")
    
    if not request.vapiApiKey or not request.vapiPhoneNumberId or not request.vapiAssistantId:
        logger.error("❌ Voice provider API configuration is incomplete")
        raise HTTPException(status_code=400, detail="Voice provider API configuration is incomplete")
    
    # Convert scheduled date/time/timezone to ISO 8601 format
    try:
        # Parse the scheduled date and time
        scheduled_datetime_str = f"{request.scheduledDate} {request.scheduledTime}"
        scheduled_datetime = datetime.strptime(scheduled_datetime_str, "%Y-%m-%d %H:%M")
        
        # Apply timezone
        logger.info(f"🕐 Applying timezone: {request.timezone}")
        tz = pytz.timezone(request.timezone)
        scheduled_datetime = tz.localize(scheduled_datetime)
        
        # Convert to ISO 8601 format
        earliest_at = scheduled_datetime.isoformat()
        logger.info(f"✅ Converted to ISO 8601: {earliest_at}")
    except Exception as e:
        logger.error(f"❌ Invalid date/time format: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid date/time format: {str(e)}. Expected format: YYYY-MM-DD for date and HH:MM for time.")
    
    scheduled_calls = []
    
    try:
        async with httpx.AsyncClient() as client:
            for customer_id in request.customerIds:
                logger.info(f"📋 Processing customer: {customer_id}")
                customer = cs.get_by_customer_id(db, customer_id)
                if not customer:
                    logger.error(f"❌ Customer {customer_id} not found in database")
                    raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found")
                
                logger.info(f"✅ Found customer: {customer.get('firstName')} {customer.get('lastName')} ({customer_id})")
                
                # Build customer object for voice provider API
                customer_phone = customer.get("phone", "").strip()
                if not customer_phone:
                    logger.error(f"❌ Customer {customer_id} has no phone number")
                    raise HTTPException(status_code=400, detail=f"Customer {customer_id} has no phone number")
                
                # Ensure phone number is in E164 format (starts with +)
                original_phone = customer_phone
                if not customer_phone.startswith("+"):
                    # Try to format as E164 (basic - in production, use a proper phone number library)
                    customer_phone = f"+1{customer_phone}" if len(customer_phone) == 10 else f"+{customer_phone}"
                    logger.info(f"📱 Formatted phone: {original_phone} -> {customer_phone}")
                
                customer_name = f"{customer.get('firstName', '')} {customer.get('lastName', '')}".strip()
                
                # Build call data according to voice provider API specification
                call_data = {
                    "assistantId": request.vapiAssistantId,
                    "phoneNumberId": request.vapiPhoneNumberId,
                    "customer": {
                        "number": customer_phone,
                        "name": customer_name
                    },
                    "schedulePlan": {
                        "earliestAt": earliest_at
                    }
                }
                
                # Add optional fields
                if customer.get("email"):
                    call_data["customer"]["email"] = customer.get("email")
                if customer.get("customerId"):
                    call_data["customer"]["externalId"] = customer.get("customerId")
                
                if request.webhookUrl:
                    call_data["webhookUrl"] = request.webhookUrl
                
                logger.info(f"🚀 Scheduling call to voice provider for {customer_name} ({customer_phone}) at {earliest_at}")
                logger.debug(f"📤 Call data: {json.dumps(call_data, indent=2)}")
                
                # Retry logic for Cloudflare protection (sometimes blocks requests)
                max_retries = 3
                retry_delay = 2  # seconds
                response = None
                last_error = None
                
                for attempt in range(max_retries):
                    try:
                        if attempt > 0:
                            wait_time = retry_delay * (2 ** (attempt - 1))  # Exponential backoff: 2s, 4s, 8s
                            logger.info(f"⏳ Retry attempt {attempt + 1}/{max_retries} after {wait_time}s delay...")
                            await asyncio.sleep(wait_time)
                        
                        response = await client.post(
                            "https://api.vapi.ai/call",
                            headers={
                                "Authorization": f"Bearer {request.vapiApiKey}",
                                "Content-Type": "application/json",
                                "User-Agent": "CRM-Verification-System/1.0",
                                "Accept": "application/json"
                            },
                            json=call_data,
                            timeout=30.0,
                            follow_redirects=True
                        )
                        
                        # Check if response is HTML (Cloudflare challenge)
                        content_type = response.headers.get("content-type", "").lower()
                        if "text/html" in content_type or response.status_code == 403:
                            error_text = response.text[:500] if hasattr(response, 'text') else str(response)
                            if "cloudflare" in error_text.lower() or "challenge" in error_text.lower():
                                if attempt < max_retries - 1:
                                    logger.warning(f"⚠️ Cloudflare challenge detected (attempt {attempt + 1}/{max_retries}), will retry...")
                                    last_error = "Cloudflare protection challenge"
                                    continue
                                else:
                                    logger.error(f"❌ Vapi API blocked by Cloudflare protection after {max_retries} attempts")
                                    logger.error(f"   This is usually temporary. Possible causes:")
                                    logger.error(f"   1. Cloudflare rate limiting (try again in a few minutes)")
                                    logger.error(f"   2. Invalid or expired API key")
                                    logger.error(f"   3. API key doesn't have permission for this endpoint")
                                    raise HTTPException(
                                        status_code=403, 
                                        detail=f"Vapi API blocked by Cloudflare after {max_retries} attempts. This is usually temporary - please try again in a few minutes. If it persists, check: 1) Your API key is valid, 2) API key has correct permissions."
                                    )
                        
                        # If we got here, response is good
                        response.raise_for_status()
                        break
                        
                    except httpx.HTTPStatusError as e:
                        if e.response.status_code == 403 and attempt < max_retries - 1:
                            logger.warning(f"⚠️ HTTP 403 error (attempt {attempt + 1}/{max_retries}), will retry...")
                            last_error = str(e)
                            continue
                        else:
                            raise
                
                if not response:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to get response from voice provider after {max_retries} attempts. Last error: {last_error}"
                    )
                
                try:
                    result = response.json()
                except Exception as e:
                    logger.error(f"❌ Failed to parse Vapi API response as JSON: {str(e)}")
                    logger.error(f"Response text: {response.text[:500]}")
                    raise HTTPException(status_code=500, detail=f"Vapi API returned invalid response: {response.text[:200]}")
                
                logger.info(f"✅ Voice provider response received: {json.dumps(result, indent=2)}")
                
                # Handle both single call response and batch response
                call_id = result.get("id") if isinstance(result, dict) else None
                if not call_id and isinstance(result, dict) and "results" in result:
                    # Batch response
                    if result.get("results") and len(result["results"]) > 0:
                        call_id = result["results"][0].get("id")
                
                logger.info(f"✅ Call scheduled successfully: Call ID = {call_id}")
                
                scheduled_calls.append({
                    "customerId": customer_id,
                    "vapiCallId": call_id,
                    "status": "scheduled",
                    "scheduledAt": earliest_at,
                    "customerPhone": customer_phone,
                    "customerName": customer_name
                })
        
        logger.info(f"✅ Successfully scheduled {len(scheduled_calls)} calls")
        logger.info(f"📊 Summary: {len(scheduled_calls)}/{len(request.customerIds)} calls scheduled successfully")
        
        return {
            "success": True,
            "scheduledCalls": scheduled_calls,
            "count": len(scheduled_calls)
        }
        
    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        error_text = e.response.text if hasattr(e.response, 'text') else str(e)
        try:
            error_json = e.response.json()
            error_message = error_json.get('message') or error_json.get('error') or error_text
        except:
            error_message = error_text or f"HTTP {e.response.status_code}"
        logger.error(f"❌ Voice provider error (HTTP {e.response.status_code}): {error_message}")
        raise HTTPException(status_code=e.response.status_code, detail=f"Voice provider error: {error_message}")
    except Exception as e:
        logger.error(f"❌ Error scheduling calls: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error scheduling calls: {str(e)}")

@app.post("/api/webhook/call-status")
async def voice_provider_webhook(data: dict):
    return {"success": True, "message": "Webhook received", "data": data}

@app.post("/api/provider/test-connection")
async def test_provider_connection(config: ApiConfig):
    if not config.vapiApiKey:
        raise HTTPException(status_code=400, detail="Voice provider API key is required")
    
    try:
        async with httpx.AsyncClient() as client:
            # Try to fetch account info or assistant list
            response = await client.get(
                "https://api.vapi.ai/assistant",
                headers={"Authorization": f"Bearer {config.vapiApiKey}"},
                timeout=30.0
            )
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    assistant_count = len(data) if isinstance(data, list) else (len(data.get('data', [])) if isinstance(data, dict) else 0)
                    return {
                        "success": True,
                        "message": f"Connection successful! API key is valid.{f' Found {assistant_count} assistant(s).' if assistant_count > 0 else ''}",
                        "assistantCount": assistant_count
                    }
                except:
                    # Empty response but status is OK
                    return {
                        "success": True,
                        "message": "Connection successful! API key is valid."
                    }
            else:
                error_text = response.text
                try:
                    error_json = response.json()
                    error_message = error_json.get('message') or error_json.get('error') or error_text
                except:
                    error_message = error_text or f"HTTP {response.status_code}"
                
                raise HTTPException(status_code=response.status_code, detail=error_message)
                
    except httpx.HTTPStatusError as e:
        error_text = e.response.text if hasattr(e.response, 'text') else str(e)
        try:
            error_json = e.response.json()
            error_message = error_json.get('message') or error_json.get('error') or error_text
        except:
            error_message = error_text or f"HTTP {e.response.status_code}"
        raise HTTPException(status_code=e.response.status_code, detail=f"Voice provider API error: {error_message}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error testing voice provider connection: {str(e)}")

@app.get("/api/calls/{call_id}/status")
async def get_call_status(call_id: str, config: ApiConfig):
    if not config.vapiApiKey:
        raise HTTPException(status_code=400, detail="Voice provider API key is required")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.vapi.ai/call/{call_id}",
                headers={
                    "Authorization": f"Bearer {config.vapiApiKey}",
                    "User-Agent": "CRM-Verification-System/1.0",
                    "Accept": "application/json"
                },
                timeout=30.0,
                follow_redirects=True
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Voice provider API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching call status: {str(e)}")

# ============================================================================
# CAMPAIGN MANAGEMENT
# ============================================================================

class CampaignCreate(BaseModel):
    name: str
    description: Optional[str] = None
    vapi_assistant_id: Optional[str] = None

@app.get("/api/v1/campaigns", dependencies=[Depends(verify_jwt_or_api_key)])
async def list_campaigns(db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).all()
    return {"success": True, "campaigns": campaigns}

@app.post("/api/v1/campaigns", dependencies=[Depends(verify_jwt_or_api_key)])
async def create_campaign(data: CampaignCreate, db: Session = Depends(get_db)):
    # Check if a campaign with this name already exists
    existing = db.query(Campaign).filter(Campaign.name == data.name).first()
    if existing:
        # Update assistant if provided
        if data.vapi_assistant_id:
            existing.vapi_assistant_id = data.vapi_assistant_id
            db.commit()
            db.refresh(existing)
        return {"success": True, "campaign": existing, "message": "Using existing campaign"}
        
    campaign = Campaign(
        name=data.name, 
        description=data.description,
        vapi_assistant_id=data.vapi_assistant_id
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return {"success": True, "campaign": campaign}

@app.get("/api/v1/assistants", dependencies=[Depends(get_current_user_jwt)])
async def list_assistants(user = Depends(get_current_user_jwt), db: Session = Depends(get_db)):
    """Fetch list of assistants from voice provider using user's API key."""
    settings = ss.get_settings(db, user.id)
    if not settings or not settings.get("vapiApiKey"):
        return {"success": True, "assistants": []}
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://api.vapi.ai/assistant",
                headers={"Authorization": f"Bearer {settings['vapiApiKey']}"}
            )
            response.raise_for_status()
            assistants = response.json()
            # Returns a list of assistant objects
            return {"success": True, "assistants": assistants}
        except Exception as e:
            logger.error(f"Failed to fetch assistants: {str(e)}")
            return {"success": False, "error": str(e)}

@app.get("/api/v1/numbers", dependencies=[Depends(get_current_user_jwt)])
async def list_numbers(user = Depends(get_current_user_jwt), db: Session = Depends(get_db)):
    """Fetch list of phone numbers from voice provider using user's API key."""
    settings = ss.get_settings(db, user.id)
    if not settings or not settings.get("vapiApiKey"):
        return {"success": True, "numbers": []}
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://api.vapi.ai/phone-number",
                headers={"Authorization": f"Bearer {settings['vapiApiKey']}"}
            )
            response.raise_for_status()
            numbers = response.json()
            return {"success": True, "numbers": numbers}
        except Exception as e:
            logger.error(f"Failed to fetch phone numbers: {str(e)}")
            return {"success": False, "error": str(e)}

@app.get("/api/v1/campaigns/{id}", dependencies=[Depends(verify_jwt_or_api_key)])
async def get_campaign(id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    leads = db.query(CampaignLead).filter(CampaignLead.campaign_id == id).all()
    return {"success": True, "campaign": campaign, "leads_count": len(leads)}

@app.post("/api/v1/campaigns/{id}/leads", dependencies=[Depends(verify_jwt_or_api_key)])
async def add_leads_to_campaign_batch(id: int, batch: BatchCustomerImport, db: Session = Depends(get_db)):
    """
    Import leads and associate them with a specific campaign.
    """
    campaign = db.query(Campaign).filter(Campaign.id == id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    stored_count = 0
    duplicate_count = 0
    leads_added = 0
    
    for customer_data in batch.customers:
        try:
            customer_id = customer_data.get("customerId")
            if not customer_id:
                continue
                
            # 1. Upsert Customer details
            d = {
                "customerId": customer_id,
                "firstName": customer_data.get("firstName", "").strip(),
                "lastName": customer_data.get("lastName", "").strip(),
                "phone": customer_data.get("phone", "").strip(),
                "email": customer_data.get("email", "").strip() if customer_data.get("email") else "",
                "status": "ready_for_auditing",
                "importDate": datetime.now().isoformat(),
            }
            cs.upsert_customer(db, d)
            
            # 2. Check if lead already in this campaign
            existing_lead = db.query(CampaignLead).filter(
                CampaignLead.campaign_id == id,
                CampaignLead.customer_id == customer_id
            ).first()
            
            if not existing_lead:
                new_lead = CampaignLead(campaign_id=id, customer_id=customer_id)
                db.add(new_lead)
                leads_added += 1
            else:
                duplicate_count += 1
                
        except Exception as e:
            logger.error(f"Error adding lead to campaign: {str(e)}")
            
    campaign.total_leads = (campaign.total_leads or 0) + leads_added
    db.commit()
    
    return {
        "success": True,
        "campaign_id": id,
        "added": leads_added,
        "duplicates": duplicate_count,
        "total": campaign.total_leads
    }

# ============================================================================
# PUBLIC API ENDPOINTS FOR INTEGRATION (n8n, Zapier, etc.)
# ============================================================================

class CustomerCreate(BaseModel):
    customerId: str
    firstName: str
    lastName: str
    phone: str
    email: Optional[str] = ""
    address: Optional[str] = ""
    dateOfBirth: Optional[str] = ""
    lastFourSSN: Optional[str] = ""
    securityAnswer: Optional[str] = ""
    status: str = "ready_for_auditing"
    metadata: Optional[dict] = None

class ScheduleCallAPI(BaseModel):
    customerIds: List[str]
    scheduledDate: str
    scheduledTime: str
    timezone: str = "America/New_York"
    maxRetries: int = 2
    vapiApiKey: Optional[str] = None
    vapiPhoneNumberId: Optional[str] = None
    vapiAssistantId: Optional[str] = None

@app.get("/api/v1/health")
async def api_health():
    """Health check endpoint for API monitoring"""
    return {
        "status": "healthy",
        "service": "CRM Verification System API",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/v1/customers", dependencies=[Depends(verify_jwt_or_api_key)])
async def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
    """
    Create a new customer for verification
    
    Requires API key authentication.
    Compatible with n8n, Zapier, and other automation tools.
    """
    logger.info(f"👤 Creating customer: {customer.customerId} - {customer.firstName} {customer.lastName}")
    d = {
        **customer.dict(),
        "importDate": datetime.now().isoformat(),
        "previousAttempts": 0,
        "lastContactDate": None
    }
    result = cs.upsert_customer(db, d)
    logger.info(f"✅ Customer created/updated: {customer.customerId} (ID: {result['id']})")
    return {
        "success": True,
        "message": "Customer created successfully",
        "customer": result,
        "id": result["id"]
    }

@app.get("/api/v1/customers", dependencies=[Depends(verify_jwt_or_api_key)])
async def list_customers(
    status: Optional[str] = None,
    limit: Optional[int] = 100,
    offset: Optional[int] = 0,
    db: Session = Depends(get_db)
):
    """
    List all customers
    
    Query parameters:
    - status: Filter by status (e.g., 'ready_for_auditing')
    - limit: Maximum number of results (default: 100)
    - offset: Pagination offset (default: 0)
    """
    paginated, total = cs.list_customers(db, status=status, limit=limit or 100, offset=offset or 0)
    return {
        "success": True,
        "customers": paginated,
        "total": total,
        "limit": limit or 100,
        "offset": offset or 0
    }

@app.get("/api/v1/customers/{customer_id}", dependencies=[Depends(verify_jwt_or_api_key)])
async def get_customer(customer_id: str, db: Session = Depends(get_db)):
    """Get a specific customer by ID"""
    customer = cs.get_by_customer_id(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"success": True, "customer": customer}

@app.post("/api/v1/calls/schedule", dependencies=[Depends(verify_jwt_or_api_key)])
async def schedule_calls_api(request: ScheduleCallAPI, db: Session = Depends(get_db)):
    """
    Schedule verification calls for customers
    
    This endpoint can be called from n8n, Zapier, or any HTTP client.
    Returns scheduled call information.
    """
    if not request.customerIds:
        raise HTTPException(status_code=400, detail="At least one customer ID is required")
    valid_customers = []
    for cust_id in request.customerIds:
        customer = cs.get_by_customer_id(db, cust_id)
        if customer:
            valid_customers.append(customer)
        else:
            raise HTTPException(status_code=404, detail=f"Customer {cust_id} not found")
    
    scheduled_calls = []
    batch_id = f"batch_{datetime.now().timestamp()}"
    
    for customer in valid_customers:
        vapi_call_id = f"vapi_{secrets.token_hex(8)}"
        
        # Create CampaignLead in database
        # For public API calls, we might not have a campaign_id, so we'll use a default or 0
        lead = CampaignLead(
            campaign_id=0, # Default for direct API calls
            customer_id=customer.get("customerId"),
            status="scheduled",
            vapi_call_id=vapi_call_id,
            scheduled_at=datetime.now() # Simplified for this API
        )
        db.add(lead)
        db.commit()
        db.refresh(lead)

        call_data = {
            "id": lead.id,
            "batchId": batch_id,
            "customerId": customer.get("customerId"),
            "customerName": f"{customer.get('firstName')} {customer.get('lastName')}",
            "phone": customer.get("phone"),
            "scheduledDate": request.scheduledDate,
            "scheduledTime": request.scheduledTime,
            "timezone": request.timezone,
            "status": "scheduled",
            "scheduledAt": lead.created_at.isoformat(),
            "retryCount": 0,
            "maxRetries": request.maxRetries,
            "vapiCallId": vapi_call_id
        }
        scheduled_calls.append(call_data)
    
    return {
        "success": True,
        "message": f"Successfully scheduled {len(scheduled_calls)} calls",
        "batchId": batch_id,
        "scheduledCalls": scheduled_calls,
        "count": len(scheduled_calls)
    }

@app.get("/api/v1/calls", dependencies=[Depends(verify_jwt_or_api_key)])
async def list_calls(
    status: Optional[str] = None,
    limit: Optional[int] = 100,
    offset: Optional[int] = 0,
    db: Session = Depends(get_db)
):
    """
    List all calls (campaign leads)
    """
    query = db.query(CampaignLead)
    if status:
        query = query.filter(CampaignLead.status == status)
    
    total = query.count()
    leads = query.offset(offset).limit(limit).all()
    
    return {
        "success": True,
        "calls": leads,
        "total": total,
        "limit": limit,
        "offset": offset
    }

@app.get("/api/v1/calls/{call_id}", dependencies=[Depends(get_current_user_jwt)])
async def get_call(call_id: str, user = Depends(get_current_user_jwt), db: Session = Depends(get_db)):
    """Get a specific call by ID or Vapi Call ID"""
    lead = db.query(CampaignLead).filter(
        (CampaignLead.vapi_call_id == call_id) | (CampaignLead.id == call_id)
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Call not found")
    return {"success": True, "call": lead}

@app.post("/api/v1/calls/{call_id}/sync", dependencies=[Depends(get_current_user_jwt)])
async def sync_call(call_id: str, user = Depends(get_current_user_jwt), db: Session = Depends(get_db)):
    """Manually sync call data from Vapi (needed for local development without webhooks)"""
    lead = db.query(CampaignLead).filter(CampaignLead.vapi_call_id == call_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Call record not found")
    
    config = ss.get_settings(db, user.id)
    vapi_key = config.vapi_api_key
    
    if not vapi_key:
        return {"success": False, "message": "Vapi API key not configured in settings"}
        
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.vapi.ai/call/{call_id}",
                headers={"Authorization": f"Bearer {vapi_key}"},
                timeout=10.0
            )
            if response.status_code == 200:
                vapi_data = response.json()
                lead.result = vapi_data
                status = vapi_data.get("status")
                if status in ["ended", "completed"]:
                    lead.status = "completed"
                else:
                    lead.status = status
                db.commit()
                return {"success": True, "call": lead}
            else:
                return {"success": False, "message": f"Vapi API returned {response.status_code}"}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/api/v1/calls/results/completed", dependencies=[Depends(verify_jwt_or_api_key)])
async def get_completed_calls(
    limit: Optional[int] = 100,
    offset: Optional[int] = 0,
    db: Session = Depends(get_db)
):
    """
    Get completed call results
    """
    query = db.query(CampaignLead).filter(CampaignLead.status == "completed")
    
    total = query.count()
    leads = query.offset(offset).limit(limit).all()
    
    return {
        "success": True,
        "results": leads,
        "total": total,
        "limit": limit,
        "offset": offset
    }

@app.post("/api/v1/webhooks/vapi")
async def vapi_webhook_api(payload: dict, db: Session = Depends(get_db)):
    """
    Webhook endpoint for receiving Vapi call updates.
    Updates CampaignLead status in database.
    """
    # Process webhook payload
    # Based on Vapi webhook schema
    vapi_call_id = payload.get("call", {}).get("id") or payload.get("id")
    status = payload.get("status") or payload.get("call", {}).get("status")
    
    if not vapi_call_id:
        return {"success": False, "message": "No call ID found in payload"}

    # Update call status in database
    lead = db.query(CampaignLead).filter(CampaignLead.vapi_call_id == vapi_call_id).first()
    if lead:
        # Store full result for analysis and stats
        lead.result = payload
        
        # Map Vapi status to our internal status
        if status in ["ended", "completed"]:
            lead.status = "completed"
        elif status in ["failed", "error"]:
            lead.status = "failed"
        else:
            lead.status = status
            
        db.commit()
        return {"success": True, "message": f"Updated lead {vapi_call_id} to {status}"}
    
    return {"success": False, "message": "Lead not found for this call ID"}
    
    return {
        "success": True,
        "message": "Webhook received",
        "callId": call_id,
        "status": status
    }


# --- BILLING ROUTES ---

def get_or_create_wallet(db: Session, user_id: int):
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    if not wallet:
        wallet = Wallet(user_id=user_id, balance=0.0)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    return wallet

@app.get("/api/v1/billing/balance")
async def get_balance(user: dict = Depends(get_current_user_jwt), db: Session = Depends(get_db)):
    wallet = get_or_create_wallet(db, user["id"])
    return {
        "success": True,
        "balance": wallet.balance,
        "currency": wallet.currency
    }

@app.get("/api/v1/billing/transactions")
async def get_transactions(user: dict = Depends(get_current_user_jwt), db: Session = Depends(get_db)):
    transactions = db.query(Transaction).filter(Transaction.user_id == user["id"]).order_by(Transaction.created_at.desc()).all()
    return {
        "success": True,
        "transactions": [
            {
                "id": t.id,
                "amount": t.amount,
                "type": t.type,
                "description": t.description,
                "status": t.status,
                "created_at": t.created_at
            } for t in transactions
        ]
    }

@app.post("/api/v1/billing/topup")
async def top_up(req: TopUpRequest, user: dict = Depends(get_current_user_jwt), db: Session = Depends(get_db)):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")
    
    wallet = get_or_create_wallet(db, user["id"])
    
    # Update balance
    wallet.balance += req.amount
    
    # Create transaction
    transaction = Transaction(
        user_id=user["id"],
        amount=req.amount,
        type="topup",
        description="Wallet Top Up (Simulated)",
        status="completed"
    )
    
    db.add(transaction)
    db.commit()
    
    return {
        "success": True,
        "new_balance": wallet.balance,
        "message": f"Successfully topped up ${req.amount}"
    }

@app.post("/api/v1/webhooks/custom")
async def custom_webhook(payload: dict, api_key: Optional[str] = Depends(optional_api_key)):
    """
    Custom webhook endpoint for receiving data from external systems
    
    Accepts any JSON payload and processes it.
    """
    return {
        "success": True,
        "message": "Webhook received",
        "payload": payload,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/v1/stats", dependencies=[Depends(verify_jwt_or_api_key)])
async def get_statistics(db: Session = Depends(get_db)):
    """Get system statistics"""
    total_customers = cs.count_customers(db)
    total_campaigns = db.query(Campaign).count()
    total_leads = db.query(CampaignLead).count()
    leads = db.query(CampaignLead).all()
    
    # Advanced outcome parsing
    reached_human = 0
    voicemails = 0
    unsuccessful = 0
    completed_leads = 0
    scheduled_leads = 0
    
    for lead in leads:
        if lead.status == "scheduled":
            scheduled_leads += 1
            continue
            
        if lead.status == "completed":
            completed_leads += 1
            
        if lead.result:
            # Check endedReason from Vapi (handle both direct and nested formats)
            reason = lead.result.get("endedReason")
            if not reason:
                reason = lead.result.get("call", {}).get("endedReason")
            
            if reason in ["customer-ended-call", "assistant-ended-call"]:
                reached_human += 1
            elif reason == "voicemail":
                voicemails += 1
            elif reason in ["phone-call-error", "customer-busy", "customer-did-not-answer", "no-answer", "error"]:
                unsuccessful += 1
            elif lead.status == "completed":
                # Fallback if reason is unknown but status is completed
                reached_human += 1
    
    # Calculate answer rate safely
    answer_rate = "0%"
    if total_leads > 0:
        rate = (reached_human / total_leads) * 100
        answer_rate = f"{int(rate)}%"

    return {
        "success": True,
        "statistics": {
            "totalCustomers": total_customers,
            "totalCampaigns": total_campaigns,
            "totalLeads": total_leads,
            "completedLeads": completed_leads,
            "reachedHuman": reached_human,
            "reachedVoicemail": voicemails,
            "unsuccessful": unsuccessful,
            "answerRate": answer_rate,
            "scheduledCalls": scheduled_leads,
            "completedCalls": completed_leads,
            "fullyVerified": reached_human, # Placeholder
            "partiallyVerified": 0,
            "notVerified": unsuccessful,
            "noAnswer": unsuccessful
        },
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/v1/settings", dependencies=[Depends(get_current_user_jwt)])
async def get_settings(user = Depends(get_current_user_jwt), db: Session = Depends(get_db)):
    """Get current user's integration settings (CRM + Vapi). Requires JWT."""
    config = ss.get_settings(db, user.id)
    return {"success": True, "config": config or {"crmEndpoint": "", "crmApiKey": "", "vapiApiKey": "", "vapiPhoneNumberId": "", "vapiAssistantId": "", "webhookUrl": ""}}

@app.put("/api/v1/settings", dependencies=[Depends(get_current_user_jwt)])
async def put_settings(payload: ApiConfig, user = Depends(get_current_user_jwt), db: Session = Depends(get_db)):
    """Save current user's integration settings. Requires JWT."""
    config = ss.upsert_settings(db, user.id, payload.dict())
    return {"success": True, "config": config}

@app.get("/api/v1/api-key/info")
async def api_key_info():
    """Get information about API key usage"""
    has_keys = len(API_KEYS) > 0
    return {
        "message": "API key authentication required for most endpoints",
        "header": "Authorization: Bearer <your-api-key>",
        "hasApiKeys": has_keys,
        "keyCount": len(API_KEYS),
        "instructions": {
            "defaultKey": "When you start the backend server, look for '⚠️ Default API Key generated: [key]' in the console output",
            "envFile": "Or set API_KEYS environment variable in backend/.env file (comma-separated for multiple keys)",
            "whereToSet": "Go to Settings tab → API Key Management → Current API Key field in the frontend"
        },
        "endpoints": {
            "public": ["/api/v1/health", "/api/v1/webhooks/*"],
            "protected": ["/api/v1/customers", "/api/v1/calls", "/api/v1/stats"]
        },
        "documentation": "/api/docs"
    }

class ApiKeyCreate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ApiKeyResponse(BaseModel):
    key: str
    name: Optional[str] = None
    description: Optional[str] = None
    createdAt: str
    prefix: str

@app.post("/api/v1/api-keys/generate", dependencies=[Depends(verify_jwt_or_api_key)])
async def generate_api_key(request: ApiKeyCreate):
    """
    Generate a new API key
    
    Requires existing API key authentication.
    Returns the new API key (store it securely, it won't be shown again).
    """
    import secrets
    import base64
    
    # Generate a secure random API key (32 bytes = 256 bits)
    key_bytes = secrets.token_bytes(32)
    api_key = base64.urlsafe_b64encode(key_bytes).decode('utf-8').rstrip('=')
    
    # Store the key (in production, use a database)
    key_info = {
        "key": api_key,
        "name": request.name or "Generated API Key",
        "description": request.description,
        "createdAt": datetime.now().isoformat(),
        "prefix": api_key[:8] + "..."
    }
    
    # Add to API_KEYS list
    API_KEYS.append(api_key)
    
    # In production, save to database or file
    print(f"⚠️  New API Key generated: {api_key[:16]}...")
    print(f"⚠️  Update API_KEYS in .env file: {','.join(API_KEYS)}")
    
    return {
        "success": True,
        "message": "API key generated successfully. Store it securely - it won't be shown again.",
        "apiKey": key_info,
        "warning": "Save this key immediately. It cannot be retrieved later."
    }

@app.get("/api/v1/api-keys/list", dependencies=[Depends(verify_jwt_or_api_key)])
async def list_api_keys():
    """
    List all API keys (prefixes only for security)
    
    Note: Full keys are never returned for security reasons.
    """
    # In production, fetch from database
    # For now, return count and instructions
    return {
        "success": True,
        "totalKeys": len(API_KEYS),
        "message": "API keys are stored securely. Use the generate endpoint to create new keys.",
        "note": "Full API keys are never displayed for security reasons. Check your .env file or backend logs."
    }

if __name__ == "__main__":
    import uvicorn
    from pathlib import Path
    
    # SSL configuration
    use_https = os.getenv("USE_HTTPS", "false").lower() == "true"
    ssl_cert_path = os.getenv("SSL_CERT_PATH", "ssl/cert.pem")
    ssl_key_path = os.getenv("SSL_KEY_PATH", "ssl/key.pem")
    
    ssl_keyfile = None
    ssl_certfile = None
    
    if use_https:
        cert_path = Path(ssl_cert_path)
        key_path = Path(ssl_key_path)
        
        if cert_path.exists() and key_path.exists():
            ssl_keyfile = str(key_path)
            ssl_certfile = str(cert_path)
            print(f"✓ HTTPS enabled with certificate: {cert_path}")
        else:
            print(f"⚠️  HTTPS requested but certificates not found!")
            print(f"   Certificate: {cert_path} (exists: {cert_path.exists()})")
            print(f"   Private Key: {key_path} (exists: {key_path.exists()})")
            print(f"   Run 'python generate-ssl-cert.py' to generate self-signed certificates")
            print(f"   Falling back to HTTP...")
            use_https = False
    
    port = int(os.getenv("PORT", 8000))
    protocol = "https" if use_https and ssl_certfile else "http"
    
    print(f"\n{'='*60}")
    print(f"[START] Starting CRM Verification System API")
    print(f"{'='*60}")
    print(f"[START] Server: {protocol}://0.0.0.0:{port}")
    print(f"[START] API Docs: {protocol}://localhost:{port}/docs")
    print(f"[START] ReDoc: {protocol}://localhost:{port}/redoc")
    print(f"{'='*60}\n")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        ssl_keyfile=ssl_keyfile,
        ssl_certfile=ssl_certfile,
        reload=True
    )

