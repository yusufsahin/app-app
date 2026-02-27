# Build and run ALM stack locally with Docker.
# Ensures backend build context is the parent of alm-manifest-app (so statelesspy + alm-manifest-app are available).
# Run from alm-app: .\docker-build-local.ps1

$ErrorActionPreference = "Stop"
$almAppDir = $PSScriptRoot
$almManifestAppDir = (Resolve-Path (Join-Path $almAppDir "..")).Path
# Parent of alm-manifest-app (must contain statelesspy and alm-manifest-app)
$contextDir = (Resolve-Path (Join-Path $almAppDir "..\..")).Path

if (-not (Test-Path (Join-Path $contextDir "statelesspy"))) {
    Write-Warning "statelesspy not found at $contextDir\statelesspy. Backend build expects it as a sibling of alm-manifest-app."
}
if (-not (Test-Path (Join-Path $almManifestAppDir "manifest-platform-core-suite"))) {
    Write-Warning "manifest-platform-core-suite not found at $almManifestAppDir\manifest-platform-core-suite."
}

$env:ALM_DOCKER_CONTEXT = $contextDir
Set-Location $almAppDir
docker compose up --build -d
