# CRM Verification System API Documentation

## Base URL
```
http://localhost:8000/api/v1
```

## Authentication

Most endpoints require API key authentication. Include your API key in the Authorization header:

```
Authorization: Bearer <your-api-key>
```

### Getting Your API Key

1. Create a `.env` file in the `backend` directory (copy from `.env.example`)
2. Set the `API_KEYS` environment variable:
   ```
   API_KEYS=your-api-key-1,your-api-key-2
   ```
   Multiple API keys can be comma-separated.

3. Or use the default key shown in the backend startup logs (for development only)
   - **Note**: The default key is auto-generated and should NOT be used in production

## Endpoints

### Health Check
```http
GET /api/v1/health
```
No authentication required.

**Response:**
```json
{
  "status": "healthy",
  "service": "CRM Verification System API",
  "version": "1.0.0",
  "timestamp": "2025-12-23T23:50:09.220384"
}
```

### Create Customer
```http
POST /api/v1/customers
Authorization: Bearer <api-key>
Content-Type: application/json
```

**Request Body:**
```json
{
  "customerId": "CUST-12345",
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+1-555-0101",
  "email": "john.smith@email.com",
  "address": "123 Main St, New York, NY 10001",
  "dateOfBirth": "1985-03-15",
  "lastFourSSN": "1234",
  "securityAnswer": "fluffy",
  "status": "ready_for_auditing",
  "metadata": {}
}
```

**Response:**
```json
{
  "success": true,
  "message": "Customer created successfully",
  "customer": { ... },
  "id": 1
}
```

### List Customers
```http
GET /api/v1/customers?status=ready_for_auditing&limit=100&offset=0
Authorization: Bearer <api-key>
```

**Query Parameters:**
- `status` (optional): Filter by status
- `limit` (optional): Max results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

### Get Customer
```http
GET /api/v1/customers/{customer_id}
Authorization: Bearer <api-key>
```

### Schedule Calls
```http
POST /api/v1/calls/schedule
Authorization: Bearer <api-key>
Content-Type: application/json
```

**Request Body:**
```json
{
  "customerIds": ["CUST-12345", "CUST-67890"],
  "scheduledDate": "2025-12-25",
  "scheduledTime": "10:00",
  "timezone": "America/New_York",
  "maxRetries": 2,
  "vapiApiKey": "optional-override",
  "vapiPhoneNumberId": "optional-override",
  "vapiAssistantId": "optional-override"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully scheduled 2 calls",
  "batchId": "batch_1734998400.123",
  "scheduledCalls": [ ... ],
  "count": 2
}
```

### List Calls
```http
GET /api/v1/calls?status=scheduled&batchId=batch_123&limit=100&offset=0
Authorization: Bearer <api-key>
```

### Get Call
```http
GET /api/v1/calls/{call_id}
Authorization: Bearer <api-key>
```

### Get Completed Call Results
```http
GET /api/v1/calls/results/completed?batchId=batch_123&outcome=fully_verified
Authorization: Bearer <api-key>
```

### Get Statistics
```http
GET /api/v1/stats
Authorization: Bearer <api-key>
```

**Response:**
```json
{
  "success": true,
  "statistics": {
    "totalCustomers": 150,
    "scheduledCalls": 25,
    "completedCalls": 125,
    "fullyVerified": 80,
    "partiallyVerified": 30,
    "notVerified": 10,
    "noAnswer": 5
  }
}
```

### Webhook Endpoints

#### Vapi Webhook
```http
POST /api/v1/webhooks/vapi
Content-Type: application/json
```

Configure this URL in your Vapi dashboard to receive call status updates.

**Payload:** Vapi webhook format

#### Custom Webhook
```http
POST /api/v1/webhooks/custom
Content-Type: application/json
```

Accepts any JSON payload for custom integrations.

## Integration Examples

### n8n Workflow

#### Creating a Customer
1. Add an **HTTP Request** node
2. Configure:
   - **Method**: POST
   - **URL**: `http://your-server:8000/api/v1/customers`
   - **Authentication**: Generic Credential Type
   - **Header Name**: `Authorization`
   - **Header Value**: `Bearer <your-api-key>`
   - **Body Content Type**: JSON
   - **Body**: 
     ```json
     {
       "customerId": "{{ $json.customerId }}",
       "firstName": "{{ $json.firstName }}",
       "lastName": "{{ $json.lastName }}",
       "phone": "{{ $json.phone }}",
       "email": "{{ $json.email }}"
     }
     ```

#### Scheduling Calls
1. Add an **HTTP Request** node
2. Configure:
   - **Method**: POST
   - **URL**: `http://your-server:8000/api/v1/calls/schedule`
   - **Authentication**: Header
   - **Header Name**: `Authorization`
   - **Header Value**: `Bearer <your-api-key>`
   - **Body**:
     ```json
     {
       "customerIds": ["CUST-12345", "CUST-67890"],
       "scheduledDate": "2025-12-25",
       "scheduledTime": "10:00",
       "timezone": "America/New_York",
       "maxRetries": 2
     }
     ```

#### Receiving Webhooks
1. Add a **Webhook** node
2. Configure:
   - **Path**: `/api/v1/webhooks/custom`
   - **Method**: POST
3. Use the webhook URL in your external systems

### Zapier Integration

#### Creating a Customer
1. Create a new Zap
2. **Trigger**: Choose your trigger (e.g., Google Sheets, Airtable)
3. **Action**: Choose "Webhooks by Zapier"
4. **Event**: "POST"
5. Configure:
   - **URL**: `http://your-server:8000/api/v1/customers`
   - **Method**: POST
   - **Headers**: 
     - Key: `Authorization`
     - Value: `Bearer <your-api-key>`
   - **Data**: Map fields from trigger
     ```json
     {
       "customerId": "{{trigger_field_1}}",
       "firstName": "{{trigger_field_2}}",
       "lastName": "{{trigger_field_3}}",
       "phone": "{{trigger_field_4}}"
     }
     ```

#### Getting Call Results
1. **Action**: "Webhooks by Zapier"
2. **Event**: "GET"
3. Configure:
   - **URL**: `http://your-server:8000/api/v1/calls/results/completed?outcome=fully_verified`
   - **Headers**: `Authorization: Bearer <your-api-key>`

### Make.com (Integromat) Integration

1. Add **HTTP** module
2. Configure:
   - **Method**: POST
   - **URL**: `http://your-server:8000/api/v1/customers`
   - **Headers**:
     ```
     Authorization: Bearer <your-api-key>
     Content-Type: application/json
     ```
   - **Body**: Map your data fields

### Postman Collection

Import this collection for testing:

```json
{
  "info": {
    "name": "CRM Verification API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "auth": {
    "type": "bearer",
    "bearer": [{
      "key": "token",
      "value": "{{api_key}}",
      "type": "string"
    }]
  },
  "item": [
    {
      "name": "Create Customer",
      "request": {
        "method": "POST",
        "header": [],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"customerId\": \"CUST-12345\",\n  \"firstName\": \"John\",\n  \"lastName\": \"Smith\",\n  \"phone\": \"+1-555-0101\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/api/v1/customers",
          "host": ["{{base_url}}"],
          "path": ["api", "v1", "customers"]
        }
      }
    }
  ]
}
```

### cURL Examples

#### Create Customer
```bash
curl -X POST "http://localhost:8000/api/v1/customers" \
  -H "Authorization: Bearer <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "CUST-12345",
    "firstName": "John",
    "lastName": "Smith",
    "phone": "+1-555-0101",
    "email": "john@example.com"
  }'
```

#### List Customers
```bash
curl -X GET "http://localhost:8000/api/v1/customers?status=ready_for_auditing&limit=10" \
  -H "Authorization: Bearer <your-api-key>"
```

#### Schedule Calls
```bash
curl -X POST "http://localhost:8000/api/v1/calls/schedule" \
  -H "Authorization: Bearer <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "customerIds": ["CUST-12345"],
    "scheduledDate": "2025-12-25",
    "scheduledTime": "10:00",
    "timezone": "America/New_York"
  }'
```

#### Get Statistics
```bash
curl -X GET "http://localhost:8000/api/v1/stats" \
  -H "Authorization: Bearer <your-api-key>"
```

## Error Responses

All errors follow this format:
```json
{
  "detail": "Error message here"
}
```

Common status codes:
- `200`: Success
- `400`: Bad Request (missing/invalid parameters)
- `401`: Unauthorized (invalid/missing API key)
- `404`: Not Found
- `500`: Internal Server Error

## Rate Limiting

Currently no rate limiting is implemented. For production, consider adding rate limiting middleware.

## API Documentation

Interactive API documentation available at:
- Swagger UI: `http://localhost:8000/api/docs`
- ReDoc: `http://localhost:8000/api/redoc`

