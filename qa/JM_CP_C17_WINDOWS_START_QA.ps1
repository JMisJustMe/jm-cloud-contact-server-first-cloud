# CP-C17 original Windows owner-launcher regression, NO Docker daemon, owner keys or data.
$ErrorActionPreference='Stop'
$source=(Resolve-Path (Join-Path $PSScriptRoot '..\START_HERE_WINDOWS.ps1')).Path
$tokens=$null; $errors=$null
[System.Management.Automation.Language.Parser]::ParseFile($source,[ref]$tokens,[ref]$errors) | Out-Null
if($errors.Count) { throw "PowerShell syntax errors: $($errors.Count)" }
$root=Join-Path ([IO.Path]::GetTempPath()) ('jm-c17-qa-'+[guid]::NewGuid().ToString('N'))
$bin=Join-Path $root 'bin'
New-Item -Path $bin -ItemType Directory -Force | Out-Null
$shim=Join-Path $bin 'docker.cmd'
@'
@echo off
echo %*>>"%JM_CP17_QA_LOG%"
if /I not "%~1"=="compose" goto :success
if /I not "%~4"=="exec" goto :success
if exist "%JM_CP17_QA_FAIL_FOREVER%" goto :fail
if exist "%JM_CP17_QA_FAIL_ONCE%" goto :fail_once
goto :success
:fail_once
del /q "%JM_CP17_QA_FAIL_ONCE%"
:fail
exit /b 2
:success
exit /b 0
'@ | Set-Content -LiteralPath $shim -Encoding Ascii
$oldPath=$env:PATH
try {
 $env:PATH="$bin;$oldPath"
 function Run-Case($label,$failOnce,$alwaysFail,$expectSuccess,$expectRestart) {
  $case=Join-Path $root $label
  New-Item -Path $case -ItemType Directory -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination (Join-Path $case 'START_HERE_WINDOWS.ps1')
  Set-Content -LiteralPath (Join-Path $case '.env') -Value 'JM_CP17_QA_DUMMY=1'
  $env:JM_CP17_QA_LOG=Join-Path $case 'docker.log'
  $env:JM_CP17_QA_FAIL_ONCE=Join-Path $case 'fail_once'
  $env:JM_CP17_QA_FAIL_FOREVER=Join-Path $case 'fail_forever'
  if($alwaysFail){ Set-Content -LiteralPath $env:JM_CP17_QA_FAIL_FOREVER -Value 'forever' }
  if($failOnce){ Set-Content -LiteralPath $env:JM_CP17_QA_FAIL_ONCE -Value 'once' }
  $out= & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $case 'START_HERE_WINDOWS.ps1') start 2>&1 | Out-String
  $code=$LASTEXITCODE
  $lines=Get-Content -LiteralPath $env:JM_CP17_QA_LOG
  if(($code -eq 0) -ne $expectSuccess){throw "$label unexpected exit=$code output=$out"}
  $restarts=@($lines | Where-Object {$_ -match '^compose --profile runner restart rd$'}).Count
  if($restarts -ne $expectRestart){throw "$label restart count $restarts expected $expectRestart"}
  if(-not (@($lines | Where-Object {$_ -match '^compose --profile runner up -d --wait cloud rd$'}).Count -eq 1)) { throw "$label missing original runner startup" }
  if(@($lines | Where-Object {$_ -match '(^| )down( |$)|volume rm|compose.*(setup|init-custody)|compose.*rm -f'}).Count) {throw "$label attempted a destructive or bootstrap operation"}
  if(!$expectSuccess -and $out -notmatch 'JM_OWNER_RD_CONTACT_HOLD') {throw "$label did not fail closed"}
  Write-Output "JM_C17_WINDOWS_$label=PASS"
 }
 Run-Case 'healthy-start' $false $false $true 0
 Run-Case 'stale-runner' $true $false $true 1
 Run-Case 'fail-closed' $false $true $false 1
 Write-Output 'JM_CP_C17_WINDOWS_START_3_CASES_PASS_NO_REAL_DOCKER_OR_DEVICE'
} finally {
 $env:PATH=$oldPath
 Remove-Item Env:JM_CP17_QA_LOG,Env:JM_CP17_QA_FAIL_ONCE,Env:JM_CP17_QA_FAIL_FOREVER -ErrorAction SilentlyContinue
 if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse -Force}
}
