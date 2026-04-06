# Build and run ALM stack locally with Docker.
# Backend build context = parent of alm-manifest-app (docker-compose.yml).
# Run from alm-app: .\docker-build-local.ps1

$ErrorActionPreference = "Stop"
$almAppDir = $PSScriptRoot
$almManifestAppDir = (Resolve-Path (Join-Path $almAppDir "..")).Path
$contextDir = (Resolve-Path (Join-Path $almAppDir "..\..")).Path
if (-not (Test-Path (Join-Path $almManifestAppDir "manifest-platform-core-suite"))) {
    Write-Warning "manifest-platform-core-suite not found at $almManifestAppDir\manifest-platform-core-suite."
}

docker version *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker CLI failed or Docker Desktop is not running. Start Docker Desktop, then retry."
    exit 1
}

$env:ALM_DOCKER_CONTEXT = $contextDir
Set-Location $almAppDir
docker compose up --build -d
