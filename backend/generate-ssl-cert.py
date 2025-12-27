#!/usr/bin/env python3
"""
Generate self-signed SSL certificate for development
For production, use proper certificates from a CA
"""

import os
import subprocess
from pathlib import Path

def generate_ssl_cert():
    ssl_dir = Path(__file__).parent / "ssl"
    ssl_dir.mkdir(exist_ok=True)
    
    cert_path = ssl_dir / "cert.pem"
    key_path = ssl_dir / "key.pem"
    
    print("Generating self-signed SSL certificate for development...")
    
    # Check if OpenSSL is available
    try:
        subprocess.run(["openssl", "--version"], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Error: OpenSSL is not installed or not in PATH")
        print("Please install OpenSSL or use the PowerShell script (generate-ssl-cert.ps1) on Windows")
        return False
    
    # Generate certificate
    cmd = [
        "openssl", "req", "-x509", "-newkey", "rsa:4096", "-nodes",
        "-keyout", str(key_path),
        "-out", str(cert_path),
        "-days", "365",
        "-subj", "/C=US/ST=State/L=City/O=Organization/CN=localhost"
    ]
    
    try:
        subprocess.run(cmd, check=True)
        print("SSL certificate generated successfully!")
        print(f"Certificate: {cert_path}")
        print(f"Private Key: {key_path}")
        print("\nNote: Browsers will show a security warning for self-signed certificates.")
        print("This is normal for development. Click 'Advanced' and 'Proceed to localhost'.")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error generating certificate: {e}")
        return False

if __name__ == "__main__":
    generate_ssl_cert()

