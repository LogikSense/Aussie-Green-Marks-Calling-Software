#!/bin/bash

# Generate self-signed SSL certificate for development
# For production, use proper certificates from a CA

echo "Generating self-signed SSL certificate for development..."

openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout ssl/key.pem \
  -out ssl/cert.pem \
  -days 365 \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

echo "SSL certificate generated successfully!"
echo "Certificate: ssl/cert.pem"
echo "Private Key: ssl/key.pem"
echo ""
echo "Note: Browsers will show a security warning for self-signed certificates."
echo "This is normal for development. Click 'Advanced' and 'Proceed to localhost'."

