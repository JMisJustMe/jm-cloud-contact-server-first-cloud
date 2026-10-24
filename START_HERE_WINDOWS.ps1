# JM CP-C17 — Owner-hosted first-run. Windows PowerShell 5.1+ / Docker Desktop WSL2.
# Run inside the unzipped kit folder: .\START_HERE_WINDOWS.ps1 setup
# Never invoke this against a production Render/Market database.
param([ValidateSet('setup','start','status','probe','stop','backup')][string]$Action='setup')
$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
function Docker {
  & docker @args
  if ($LASTEXITCODE -ne 0) { throw "Docker operation failed ($LASTEXITCODE). STOP; do not reset any database." }
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker Desktop is missing. Install it from https://docs.docker.com/desktop/setup/install/windows-install/ and start it."
}
Docker version
Docker compose version
switch ($Action) {
 'setup' {
   if (Test-Path '.env') { throw '.env already exists. Use start/status; never overwrite owner keys or initialise the database again.' }
   $root=(Get-Location).Path
   Docker run --rm --mount "type=bind,source=$root,target=/work" -w /work node:22-alpine node host/generate-owner-config.mjs
   Docker compose build cloud
   Docker compose up -d contact-db fence-db
   try {
     $env:JM_OWNER_BOOTSTRAP_ACK='I_AM_INITIALIZING_NEW_LOCAL_STORES'
     Docker compose --profile setup run --rm operator node host/init-custody.mjs
   } finally { Remove-Item Env:JM_OWNER_BOOTSTRAP_ACK -ErrorAction SilentlyContinue }
   Docker compose up -d cloud
   Docker compose --profile setup run --rm operator node host/enroll-probe.mjs
   Docker compose --profile runner up -d rd
   Write-Host 'JM owner-local infrastructure initialised; sending a probe for independent signed proof.'
   Docker compose --profile reconcile run --rm reconcile node host/send-probe.mjs
   Start-Sleep -Seconds 12
   Docker compose --profile reconcile run --rm reconcile node host/reconcile.mjs
   Write-Host 'Owner-local signed probe verification complete. No Fold contact claimed.'
 }
 'start' {
   if (-not (Test-Path '.env')) { throw 'Run setup first.' }
   Docker compose --profile runner up -d cloud rd
   Write-Host 'JM owner cloud and bounded RD runner started on laptop loopback.'
 }
 'status' {
   Docker compose --profile runner ps
   try { $r=Invoke-RestMethod -Uri 'http://127.0.0.1:8791/ready' -TimeoutSec 5; $r | ConvertTo-Json -Depth 6 } catch { throw 'Readiness HOLD: check docker compose logs cloud' }
 }
 'probe' {
   Docker compose --profile reconcile run --rm reconcile node host/send-probe.mjs
   Start-Sleep -Seconds 12
   Docker compose --profile reconcile run --rm reconcile node host/reconcile.mjs
 }
 'stop' {
   Docker compose --profile runner stop rd cloud
   Write-Host 'JM contact writers stopped; persistent PostgreSQL volumes retained. No volumes deleted.'
 }
 'backup' {
   & "$PSScriptRoot\BACKUP_OWNER_WINDOWS.ps1"
   if ($LASTEXITCODE -ne 0) { throw 'Backup HOLD' }
 }
}
