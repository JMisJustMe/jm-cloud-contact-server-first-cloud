# JM owner custody — bounded, offline first: stop writers before two separate native pg_dump exports.
$ErrorActionPreference='Stop';Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path '.env')) { throw 'No owner setup found.' }
function Docker { & docker @args; if ($LASTEXITCODE -ne 0) { throw "BACKUP_HOLD Docker failed ($LASTEXITCODE)" } }
Docker compose --profile runner stop rd cloud
$dest=Join-Path $PSScriptRoot ("PRIVATE_BACKUP_"+(Get-Date -Format 'yyyyMMdd_HHmmss'))
New-Item -ItemType Directory -Path $dest | Out-Null
try {
 Docker compose exec -T contact-db pg_dump -Fc -U jm_contact -d jm_contact -f /tmp/jm_cp17_contact.dump
 Docker compose cp contact-db:/tmp/jm_cp17_contact.dump (Join-Path $dest 'CONTACT.pg_dump')
 Docker compose exec -T fence-db pg_dump -Fc -U jm_fence -d jm_fence -f /tmp/jm_cp17_fence.dump
 Docker compose cp fence-db:/tmp/jm_cp17_fence.dump (Join-Path $dest 'FENCE.pg_dump')
 Docker compose exec -T contact-db rm -f /tmp/jm_cp17_contact.dump
 Docker compose exec -T fence-db rm -f /tmp/jm_cp17_fence.dump
 Write-Host 'BACKUP CREATED with applications stopped:' $dest
 Write-Host 'IMPORTANT: separately preserve .env encrypted OFFLINE — it holds private signer and passwords.'
 Write-Host 'A backup is not a restore PASS. Test restore into a disposable isolated environment before use.'
 Write-Host 'Applications remain STOPPED until you explicitly run START_HERE_WINDOWS.ps1 start.'
} catch { Write-Host 'BACKUP_HOLD: preserve partial files and inspect; do not treat as complete.'; throw }
