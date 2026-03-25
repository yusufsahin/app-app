# Deploy ALM app locally with Docker. Run from alm-app directory.
# Requires: build context contains alm-manifest-app (MPC under manifest-platform-core-suite).
$ErrorActionPreference = "Stop"
$almAppDir = $PSScriptRoot
$almManifestAppDir = (Resolve-Path (Join-Path $almAppDir "..")).Path
$contextDir = (Resolve-Path (Join-Path $almAppDir "..\..")).Path
if (-not (Test-Path (Join-Path $almManifestAppDir "manifest-platform-core-suite"))) {
    Write-Warning "manifest-platform-core-suite not found at $almManifestAppDir\manifest-platform-core-suite."
}
$env:ALM_DOCKER_CONTEXT = $contextDir
Set-Location $almAppDir
docker compose up --build -d
Write-Host "Frontend (UI + /api proxy): http://localhost:9001"
Write-Host "API docs (via frontend):      http://localhost:9001/api/v1/docs"
Write-Host "API direct:                   http://localhost:9000"
Write-Host "MailHog:                      http://localhost:8025"
