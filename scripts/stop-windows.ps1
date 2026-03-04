$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
Write-Host "Stopping Prelegal..."
docker compose down
Write-Host "Prelegal stopped."
