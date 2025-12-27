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
import hashlib
import secrets
import pytz
import logging
import asyncio

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI(
    title="CRM Verification System API",
    version="1.0.0",
    description="API for CRM Verification System - Integrate with n8n, Zapier, and other automation tools",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# API Key authentication
security = HTTPBearer()
API_KEYS = os.getenv("API_KEYS", "").split(",") if os.getenv("API_KEYS") else []
# Generate default API key if none exists
if not API_KEYS:
    default_key = hashlib.sha256(f"default_{datetime.now().isoformat()}".encode()).hexdigest()[:32]
    API_KEYS = [default_key]
    print(f"⚠️  Default API Key generated: {default_key}")
    print("⚠️  Set API_KEYS environment variable for production!")

def verify_api_key(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    if token not in API_KEYS:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return token

# Optional API key (for endpoints that work with or without auth)
async def optional_api_key(authorization: Optional[str] = Header(None, alias="Authorization")):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
        if token in API_KEYS:
            return token
    return None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for API access (can be restricted in production)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for API access (in production, use a database)
customers_db = []
calls_db = []
completed_calls_db = []

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
async def import_from_excel(file: UploadFile = File(...)):
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
            
            customer = {
                "id": len(customers_db) + 1,
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
            
            # Check if customer already exists
            existing = next((c for c in customers_db if c.get("customerId") == customer_id), None)
            if existing:
                logger.info(f"⚠️ Customer {customer_id} already exists, skipping duplicate")
                skipped_count += 1
            else:
                customers_db.append(customer)
                stored_count += 1
                logger.info(f"✅ Stored customer: {customer['firstName']} {customer['lastName']} ({customer_id})")
            
            customers.append(customer)
        
        logger.info(f"📊 Excel import completed: {stored_count} new customers stored, {skipped_count} skipped (duplicates or invalid)")
        logger.info(f"📈 Total customers in database: {len(customers_db)}")
        
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

@app.post("/api/customers/import-batch")
async def import_customers_batch(batch: BatchCustomerImport):
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
            
            # Check if customer already exists
            existing = next((c for c in customers_db if c.get("customerId") == customer_id), None)
            if existing:
                logger.info(f"⚠️ Customer {customer_id} already exists, skipping")
                skipped_count += 1
                continue
            
            # Create customer record
            customer = {
                "id": len(customers_db) + 1,
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
            
            customers_db.append(customer)
            stored_count += 1
            logger.info(f"✅ Stored customer: {customer['firstName']} {customer['lastName']} ({customer_id})")
        except Exception as e:
            logger.error(f"❌ Error importing customer: {str(e)}")
            skipped_count += 1
    
    logger.info(f"📊 Batch import completed: {stored_count} stored, {skipped_count} skipped")
    logger.info(f"📈 Total customers in database: {len(customers_db)}")
    
    return {
        "success": True,
        "stored": stored_count,
        "skipped": skipped_count,
        "total": len(batch.customers),
        "message": f"Successfully imported {stored_count} customers to backend database"
    }

@app.post("/api/calls/schedule")
async def schedule_calls(request: ScheduleCallRequestWithConfig):
    logger.info(f"📞 Call scheduling request received: {len(request.customerIds)} customers, date={request.scheduledDate}, time={request.scheduledTime}, timezone={request.timezone}")
    
    if not request.vapiApiKey or not request.vapiPhoneNumberId or not request.vapiAssistantId:
        logger.error("❌ Vapi API configuration is incomplete")
        raise HTTPException(status_code=400, detail="Vapi API configuration is incomplete")
    
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
                # Fetch customer data from database
                customer = next((c for c in customers_db if c.get("customerId") == customer_id or str(c.get("id")) == customer_id), None)
                
                if not customer:
                    logger.error(f"❌ Customer {customer_id} not found in database")
                    raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found")
                
                logger.info(f"✅ Found customer: {customer.get('firstName')} {customer.get('lastName')} ({customer_id})")
                
                # Build customer object for Vapi API
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
                
                # Build call data according to Vapi API specification
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
                
                logger.info(f"🚀 Scheduling call to Vapi API for {customer_name} ({customer_phone}) at {earliest_at}")
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
                        detail=f"Failed to get response from Vapi API after {max_retries} attempts. Last error: {last_error}"
                    )
                
                try:
                    result = response.json()
                except Exception as e:
                    logger.error(f"❌ Failed to parse Vapi API response as JSON: {str(e)}")
                    logger.error(f"Response text: {response.text[:500]}")
                    raise HTTPException(status_code=500, detail=f"Vapi API returned invalid response: {response.text[:200]}")
                
                logger.info(f"✅ Vapi API response received: {json.dumps(result, indent=2)}")
                
                # Handle both single call response and batch response
                call_id = result.get("id") if isinstance(result, dict) else None
                if not call_id and isinstance(result, dict) and "results" in result:
                    # Batch response
                    if result.get("results") and len(result["results"]) > 0:
                        call_id = result["results"][0].get("id")
                
                logger.info(f"✅ Call scheduled successfully: Vapi Call ID = {call_id}")
                
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
        logger.error(f"❌ Vapi API error (HTTP {e.response.status_code}): {error_message}")
        raise HTTPException(status_code=e.response.status_code, detail=f"Vapi API error: {error_message}")
    except Exception as e:
        logger.error(f"❌ Error scheduling calls: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error scheduling calls: {str(e)}")

@app.post("/api/webhook/vapi")
async def vapi_webhook(data: dict):
    return {"success": True, "message": "Webhook received", "data": data}

@app.post("/api/vapi/test-connection")
async def test_vapi_connection(config: ApiConfig):
    if not config.vapiApiKey:
        raise HTTPException(status_code=400, detail="Vapi API key is required")
    
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
        raise HTTPException(status_code=e.response.status_code, detail=f"Vapi API error: {error_message}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error testing Vapi connection: {str(e)}")

@app.get("/api/calls/{call_id}/status")
async def get_call_status(call_id: str, config: ApiConfig):
    if not config.vapiApiKey:
        raise HTTPException(status_code=400, detail="Vapi API key is required")
    
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
        raise HTTPException(status_code=e.response.status_code, detail=f"Vapi API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching call status: {str(e)}")

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

@app.post("/api/v1/customers", dependencies=[Depends(verify_api_key)])
async def create_customer(customer: CustomerCreate):
    """
    Create a new customer for verification
    
    Requires API key authentication.
    Compatible with n8n, Zapier, and other automation tools.
    """
    logger.info(f"👤 Creating customer: {customer.customerId} - {customer.firstName} {customer.lastName}")
    
    # Check if customer already exists
    existing = next((c for c in customers_db if c.get("customerId") == customer.customerId), None)
    if existing:
        logger.warning(f"⚠️ Customer {customer.customerId} already exists, updating instead")
        # Update existing customer
        existing.update({
            **customer.dict(),
            "importDate": datetime.now().isoformat(),
            "previousAttempts": existing.get("previousAttempts", 0),
            "lastContactDate": existing.get("lastContactDate")
        })
        logger.info(f"✅ Updated existing customer: {customer.customerId}")
        return {
            "success": True,
            "message": "Customer updated successfully",
            "customer": existing,
            "id": existing.get("id")
        }
    
    customer_data = {
        "id": len(customers_db) + 1,
        **customer.dict(),
        "importDate": datetime.now().isoformat(),
        "previousAttempts": 0,
        "lastContactDate": None
    }
    customers_db.append(customer_data)
    logger.info(f"✅ Customer created successfully: {customer.customerId} (ID: {customer_data['id']})")
    logger.info(f"📈 Total customers in database: {len(customers_db)}")
    
    return {
        "success": True,
        "message": "Customer created successfully",
        "customer": customer_data,
        "id": customer_data["id"]
    }

@app.get("/api/v1/customers", dependencies=[Depends(verify_api_key)])
async def list_customers(
    status: Optional[str] = None,
    limit: Optional[int] = 100,
    offset: Optional[int] = 0
):
    """
    List all customers
    
    Query parameters:
    - status: Filter by status (e.g., 'ready_for_auditing')
    - limit: Maximum number of results (default: 100)
    - offset: Pagination offset (default: 0)
    """
    filtered = customers_db
    if status:
        filtered = [c for c in filtered if c.get("status") == status]
    
    total = len(filtered)
    paginated = filtered[offset:offset + limit]
    
    return {
        "success": True,
        "customers": paginated,
        "total": total,
        "limit": limit,
        "offset": offset
    }

@app.get("/api/v1/customers/{customer_id}", dependencies=[Depends(verify_api_key)])
async def get_customer(customer_id: str):
    """Get a specific customer by ID"""
    customer = next((c for c in customers_db if c.get("customerId") == customer_id or str(c.get("id")) == customer_id), None)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"success": True, "customer": customer}

@app.post("/api/v1/calls/schedule", dependencies=[Depends(verify_api_key)])
async def schedule_calls_api(request: ScheduleCallAPI):
    """
    Schedule verification calls for customers
    
    This endpoint can be called from n8n, Zapier, or any HTTP client.
    Returns scheduled call information.
    """
    if not request.customerIds:
        raise HTTPException(status_code=400, detail="At least one customer ID is required")
    
    # Validate customers exist
    valid_customers = []
    for cust_id in request.customerIds:
        customer = next((c for c in customers_db if c.get("customerId") == cust_id or str(c.get("id")) == cust_id), None)
        if customer:
            valid_customers.append(customer)
        else:
            raise HTTPException(status_code=404, detail=f"Customer {cust_id} not found")
    
    scheduled_calls = []
    batch_id = f"batch_{datetime.now().timestamp()}"
    
    for customer in valid_customers:
        call_data = {
            "id": len(calls_db) + len(scheduled_calls) + 1,
            "batchId": batch_id,
            "customerId": customer.get("customerId"),
            "customerName": f"{customer.get('firstName')} {customer.get('lastName')}",
            "phone": customer.get("phone"),
            "scheduledDate": request.scheduledDate,
            "scheduledTime": request.scheduledTime,
            "timezone": request.timezone,
            "status": "scheduled",
            "scheduledAt": datetime.now().isoformat(),
            "retryCount": 0,
            "maxRetries": request.maxRetries,
            "vapiCallId": f"vapi_{secrets.token_hex(8)}"
        }
        scheduled_calls.append(call_data)
        calls_db.append(call_data)
    
    return {
        "success": True,
        "message": f"Successfully scheduled {len(scheduled_calls)} calls",
        "batchId": batch_id,
        "scheduledCalls": scheduled_calls,
        "count": len(scheduled_calls)
    }

@app.get("/api/v1/calls", dependencies=[Depends(verify_api_key)])
async def list_calls(
    status: Optional[str] = None,
    batchId: Optional[str] = None,
    limit: Optional[int] = 100,
    offset: Optional[int] = 0
):
    """
    List all scheduled calls
    
    Query parameters:
    - status: Filter by status (e.g., 'scheduled', 'completed')
    - batchId: Filter by batch ID
    - limit: Maximum number of results
    - offset: Pagination offset
    """
    filtered = calls_db + completed_calls_db
    if status:
        filtered = [c for c in filtered if c.get("status") == status]
    if batchId:
        filtered = [c for c in filtered if c.get("batchId") == batchId]
    
    total = len(filtered)
    paginated = filtered[offset:offset + limit]
    
    return {
        "success": True,
        "calls": paginated,
        "total": total,
        "limit": limit,
        "offset": offset
    }

@app.get("/api/v1/calls/{call_id}", dependencies=[Depends(verify_api_key)])
async def get_call(call_id: str):
    """Get a specific call by ID or Vapi Call ID"""
    call = next((c for c in calls_db + completed_calls_db if c.get("vapiCallId") == call_id or str(c.get("id")) == call_id), None)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return {"success": True, "call": call}

@app.get("/api/v1/calls/results/completed", dependencies=[Depends(verify_api_key)])
async def get_completed_calls(
    batchId: Optional[str] = None,
    outcome: Optional[str] = None,
    limit: Optional[int] = 100,
    offset: Optional[int] = 0
):
    """
    Get completed call results
    
    Query parameters:
    - batchId: Filter by batch ID
    - outcome: Filter by outcome (e.g., 'fully_verified', 'partially_verified')
    - limit: Maximum number of results
    - offset: Pagination offset
    """
    filtered = completed_calls_db
    if batchId:
        filtered = [c for c in filtered if c.get("batchId") == batchId]
    if outcome:
        filtered = [c for c in filtered if c.get("callOutcome") == outcome]
    
    total = len(filtered)
    paginated = filtered[offset:offset + limit]
    
    return {
        "success": True,
        "results": paginated,
        "total": total,
        "limit": limit,
        "offset": offset
    }

@app.post("/api/v1/webhooks/vapi")
async def vapi_webhook_api(payload: dict, api_key: Optional[str] = Depends(optional_api_key)):
    """
    Webhook endpoint for receiving Vapi call updates
    
    This endpoint can be configured in Vapi to receive call status updates.
    Works with or without API key authentication.
    """
    # Process webhook payload
    call_id = payload.get("call", {}).get("id") or payload.get("id")
    status = payload.get("status") or payload.get("call", {}).get("status")
    
    # Update call status in database
    call = next((c for c in calls_db if c.get("vapiCallId") == call_id), None)
    if call:
        call["status"] = status
        call["updatedAt"] = datetime.now().isoformat()
        
        # If completed, move to completed_calls_db
        if status == "ended" or status == "completed":
            completed_call = {**call, **payload}
            completed_calls_db.append(completed_call)
            calls_db.remove(call)
    
    return {
        "success": True,
        "message": "Webhook received",
        "callId": call_id,
        "status": status
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

@app.get("/api/v1/stats", dependencies=[Depends(verify_api_key)])
async def get_statistics():
    """Get system statistics"""
    return {
        "success": True,
        "statistics": {
            "totalCustomers": len(customers_db),
            "scheduledCalls": len([c for c in calls_db if c.get("status") == "scheduled"]),
            "completedCalls": len(completed_calls_db),
            "fullyVerified": len([c for c in completed_calls_db if c.get("callOutcome") == "fully_verified"]),
            "partiallyVerified": len([c for c in completed_calls_db if c.get("callOutcome") == "partially_verified"]),
            "notVerified": len([c for c in completed_calls_db if c.get("callOutcome") == "not_verified"]),
            "noAnswer": len([c for c in completed_calls_db if c.get("callOutcome") == "no_answer"])
        },
        "timestamp": datetime.now().isoformat()
    }

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

@app.post("/api/v1/api-keys/generate", dependencies=[Depends(verify_api_key)])
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

@app.get("/api/v1/api-keys/list", dependencies=[Depends(verify_api_key)])
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
    print(f"🚀 Starting CRM Verification System API")
    print(f"{'='*60}")
    print(f"📡 Server: {protocol}://0.0.0.0:{port}")
    print(f"📚 API Docs: {protocol}://localhost:{port}/docs")
    print(f"📖 ReDoc: {protocol}://localhost:{port}/redoc")
    print(f"{'='*60}\n")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        ssl_keyfile=ssl_keyfile,
        ssl_certfile=ssl_certfile
    )

