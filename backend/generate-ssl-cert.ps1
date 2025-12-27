# PowerShell script to generate self-signed SSL certificate for development
# For production, use proper certificates from a CA

Write-Host "Generating self-signed SSL certificate for development..." -ForegroundColor Cyan

# Create ssl directory if it doesn't exist
if (-not (Test-Path "ssl")) {
    New-Item -ItemType Directory -Path "ssl" | Out-Null
}

# Generate self-signed certificate
$cert = New-SelfSignedCertificate `
    -DnsName "localhost" `
    -CertStoreLocation "cert:\CurrentUser\My" `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider" `
    -KeyExportPolicy Exportable `
    -NotAfter (Get-Date).AddYears(1)

# Export certificate to PEM format
$certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
$certPem = [System.Convert]::ToBase64String($certBytes, [System.Base64FormattingOptions]::InsertLineBreaks)

# Export private key
$keyBytes = $cert.PrivateKey.Key.Export([System.Security.Cryptography.CngKeyBlobFormat]::Pkcs8PrivateBlob)
$keyPem = [System.Convert]::ToBase64String($keyBytes, [System.Base64FormattingOptions]::InsertLineBreaks)

# Save certificate
@"
-----BEGIN CERTIFICATE-----
$certPem
-----END CERTIFICATE-----
"@ | Out-File -FilePath "ssl\cert.pem" -Encoding ASCII -NoNewline

# Save private key
@"
-----BEGIN PRIVATE KEY-----
$keyPem
-----END PRIVATE KEY-----
"@ | Out-File -FilePath "ssl\key.pem" -Encoding ASCII -NoNewline

# Clean up certificate from store
Remove-Item "cert:\CurrentUser\My\$($cert.Thumbprint)" -Force

Write-Host "SSL certificate generated successfully!" -ForegroundColor Green
Write-Host "Certificate: ssl\cert.pem" -ForegroundColor Yellow
Write-Host "Private Key: ssl\key.pem" -ForegroundColor Yellow
Write-Host ""
Write-Host "Note: Browsers will show a security warning for self-signed certificates." -ForegroundColor Yellow
Write-Host "This is normal for development. Click 'Advanced' and 'Proceed to localhost'." -ForegroundColor Yellow

