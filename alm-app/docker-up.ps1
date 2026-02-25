# Deploy ALM app locally with Docker. Run from alm-app directory.
# Requires: parent directory contains manifest-platform-core-suite (for backend build).
Set-Location $PSScriptRoot
docker compose up --build -d
Write-Host "Frontend: http://localhost:3000"
Write-Host "API docs: http://localhost:3000/api/v1/docs"
Write-Host "Mailhog:  http://localhost:8025"
