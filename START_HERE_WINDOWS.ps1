# JM CP-C17 — Owner-hosted first-run. Windows PowerShell 5.1+ / Docker Desktop WSL2.
# Run inside the unzipped kit folder: .\START_HERE_WINDOWS.ps1 setup
# Never invoke this against a production Render/Market database.
param([ValidateSet('setup','start','status','probe','stop','backup')][string]$Action='setup')
$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
# PowerShell command names are case-insensitive. A function named Docker recursively
# calls itself instead of the external docker executable. Resolve the executable first.
$script:JMOwnerDockerCommand = (Get-Command docker -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1).Source
if (-not $script:JMOwnerDockerCommand) {
  throw "Docker Desktop is missing. Install it from https://docs.docker.com/desktop/setup/install/windows-install/ and start it."
}
function Invoke-JMOwnerDocker {
  & $script:JMOwnerDockerCommand @args
  if ($LASTEXITCODE -ne 0) { throw "Docker operation failed ($LASTEXITCODE). STOP; do not reset any database." }
}
function Test-JMOwnerRunnerCloudReady {
  $probe = "fetch('http://127.0.0.1:8791/ready').then(async r=>{const j=await r.json();process.exit(r.ok&&j.ready===true?0:2)}).catch(()=>process.exit(2))"
  try {
    & $script:JMOwnerDockerCommand compose --profile runner exec -T rd node -e $probe *> $null
    return ($LASTEXITCODE -eq 0)
  } catch { return $false }
}
Invoke-JMOwnerDocker version
Invoke-JMOwnerDocker compose version
switch ($Action) {
 'setup' {
   if (Test-Path '.env') { throw '.env already exists. Use start/status; never overwrite owner keys or initialise the database again.' }
   $root=(Get-Location).Path
   Invoke-JMOwnerDocker run --rm --mount "type=bind,source=$root,target=/work" -w /work node:22-alpine node host/generate-owner-config.mjs
   Invoke-JMOwnerDocker compose build cloud
   Invoke-JMOwnerDocker compose up -d contact-db fence-db
   try {
     $env:JM_OWNER_BOOTSTRAP_ACK='I_AM_INITIALIZING_NEW_LOCAL_STORES'
     Invoke-JMOwnerDocker compose --profile setup run --rm operator node host/init-custody.mjs
   } finally { Remove-Item Env:JM_OWNER_BOOTSTRAP_ACK -ErrorAction SilentlyContinue }
   Invoke-JMOwnerDocker compose up -d cloud
   Invoke-JMOwnerDocker compose --profile setup run --rm operator node host/enroll-probe.mjs
   Invoke-JMOwnerDocker compose --profile runner up -d rd
   Write-Host 'JM owner-local infrastructure initialised; sending a probe for independent signed proof.'
   Invoke-JMOwnerDocker compose --profile reconcile run --rm reconcile node host/send-probe.mjs
   Start-Sleep -Seconds 12
   Invoke-JMOwnerDocker compose --profile reconcile run --rm reconcile node host/reconcile.mjs
   Write-Host 'Owner-local signed probe verification complete. No Fold contact claimed.'
 }
 'start' {
   if (-not (Test-Path '.env')) { throw 'Run setup first.' }
   Invoke-JMOwnerDocker compose --profile runner up -d --wait cloud rd
   # Docker daemon recovery can leave RD with a stale inherited Cloud network namespace.
   # Restart only the existing runner, never the stores, member keys or source bodies.
   if (-not (Test-JMOwnerRunnerCloudReady)) {
     Write-Host 'JM RD loopback HOLD: restarting existing RD process only.'
     Invoke-JMOwnerDocker compose --profile runner restart rd
     if (-not (Test-JMOwnerRunnerCloudReady)) {
       throw 'JM_OWNER_RD_CONTACT_HOLD: runner cannot reach ready Cloud; no signed mission claimed.'
     }
   }
   Write-Host 'JM local Cloud and RD-to-Cloud readiness PASS. Signed proof still requires reconciliation.'
 }
 'status' {
   Invoke-JMOwnerDocker compose --profile runner ps
   try { $r=Invoke-RestMethod -Uri 'http://127.0.0.1:8791/ready' -TimeoutSec 5; $r | ConvertTo-Json -Depth 6 } catch { throw 'Readiness HOLD: check docker compose logs cloud' }
   if (-not (Test-JMOwnerRunnerCloudReady)) { throw 'RD-to-Cloud HOLD despite Cloud readiness. Run start; no signed probe claimed.' }
 }
 'probe' {
   if (-not (Test-JMOwnerRunnerCloudReady)) { throw 'RD-to-Cloud HOLD. Run start before sending probe.' }
   Invoke-JMOwnerDocker compose --profile reconcile run --rm reconcile node host/send-probe.mjs
   Start-Sleep -Seconds 12
   Invoke-JMOwnerDocker compose --profile reconcile run --rm reconcile node host/reconcile.mjs
 }
 'stop' {
   Invoke-JMOwnerDocker compose --profile runner stop rd cloud
   Write-Host 'JM contact writers stopped; persistent PostgreSQL volumes retained. No volumes deleted.'
 }
 'backup' {
   & "$PSScriptRoot\BACKUP_OWNER_WINDOWS.ps1"
   if ($LASTEXITCODE -ne 0) { throw 'Backup HOLD' }
 }
}
