$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
Write-Host "Starting Prelegal..."
docker compose up --build -d
Write-Host "Prelegal is running at http://localhost:8000"
