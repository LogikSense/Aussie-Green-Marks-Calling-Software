# HTTPS Setup Guide

This guide explains how to enable HTTPS for the CRM Verification System API.

## Quick Start

### 1. Generate SSL Certificates

**For Windows (PowerShell):**
```powershell
cd backend
.\generate-ssl-cert.ps1
```

**For Linux/Mac:**
```bash
cd backend
chmod +x generate-ssl-cert.sh
./generate-ssl-cert.sh
```

**Or using Python:**
```bash
cd backend
python generate-ssl-cert.py
```

### 2. Enable HTTPS in Environment

Create or update `backend/.env` file:
```env
USE_HTTPS=true
SSL_CERT_PATH=ssl/cert.pem
SSL_KEY_PATH=ssl/key.pem
PORT=8000
```

### 3. Start the Backend

The server will automatically use HTTPS if certificates are found and `USE_HTTPS=true` is set.

```bash
npm start
# or
cd backend && python main.py
```

### 4. Access the API

- API Base URL: `https://localhost:8000/api/v1`
- Swagger UI: `https://localhost:8000/api/docs`
- ReDoc: `https://localhost:8000/api/redoc`

## Browser Security Warning

When using self-signed certificates (development), browsers will show a security warning. This is normal and expected.

**To proceed:**
1. Click "Advanced" or "Show Details"
2. Click "Proceed to localhost" or "Accept the Risk and Continue"
3. The certificate is safe for local development

## Production Setup

For production environments, use proper SSL certificates from a trusted Certificate Authority (CA):

1. **Obtain certificates** from:
   - Let's Encrypt (free)
   - Your hosting provider
   - A commercial CA

2. **Update `.env`:**
   ```env
   USE_HTTPS=true
   SSL_CERT_PATH=/path/to/your/cert.pem
   SSL_KEY_PATH=/path/to/your/key.pem
   ```

3. **Ensure certificates are secure:**
   - Set proper file permissions (600 for key file)
   - Store certificates outside the web root
   - Use environment variables for paths

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_HTTPS` | `false` | Enable HTTPS (true/false) |
| `SSL_CERT_PATH` | `ssl/cert.pem` | Path to SSL certificate file |
| `SSL_KEY_PATH` | `ssl/key.pem` | Path to SSL private key file |
| `PORT` | `8000` | Server port number |

## Troubleshooting

### Certificates not found
- Ensure certificates are generated in the `backend/ssl/` directory
- Check file paths in `.env` match actual certificate locations
- Verify file permissions allow reading

### Connection refused
- Ensure backend is running
- Check if port 8000 is available
- Verify firewall settings

### Certificate errors
- For self-signed certs: Accept browser warning (development only)
- For production: Verify certificate is valid and not expired
- Check certificate chain is complete

## Frontend Configuration

The frontend automatically detects HTTPS when accessing the API. If you enable HTTPS on the backend:

1. The frontend proxy will use HTTPS automatically
2. API documentation links will use HTTPS
3. All API calls will be encrypted

No additional frontend configuration is required.

