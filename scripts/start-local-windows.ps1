#requires -Version 5.1

[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$SkipDbSetup,
    [switch]$RunTests
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$BackendRoot = Join-Path $RepoRoot 'node_code'
$FrontendRoot = Join-Path $RepoRoot 'react-code'
$BackendEnv = Join-Path $BackendRoot '.env'
$BackendEnvExample = Join-Path $BackendRoot '.env.example'
$P0Script = Join-Path $BackendRoot 'scripts\start-p0-windows.ps1'

function Fail {
    param([string]$Message)
    throw "[start-local-windows] ERROR: $Message"
}

function Write-Step {
    param([string]$Message)
    Write-Host "`n[start-local-windows] $Message" -ForegroundColor Cyan
}

function Invoke-External {
    param(
        [string]$Command,
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )

    Push-Location $WorkingDirectory
    try {
        & $Command @Arguments
        if ($LASTEXITCODE -ne 0) {
            Fail "$Command $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
        }
    } finally {
        Pop-Location
    }
}

function Test-HttpReady {
    param([string]$Url)

    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Wait-HttpReady {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 30
    )

    for ($attempt = 1; $attempt -le $TimeoutSeconds; $attempt++) {
        if (Test-HttpReady $Url) { return $true }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Start-FrontendWindow {
    $escapedRoot = $FrontendRoot.Replace("'", "''")
    $command = "`$Host.UI.RawUI.WindowTitle = 'DMlinl Frontend'; Set-Location -LiteralPath '$escapedRoot'; npm run dev"
    Start-Process -FilePath 'powershell.exe' -WorkingDirectory $FrontendRoot -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $command
    ) | Out-Null
}

if (-not (Test-Path $BackendRoot -PathType Container)) { Fail "Backend directory not found: $BackendRoot" }
if (-not (Test-Path $FrontendRoot -PathType Container)) { Fail "Frontend directory not found: $FrontendRoot" }
if (-not (Test-Path $P0Script -PathType Leaf)) { Fail "P0 startup script not found: $P0Script" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail 'Node.js is unavailable.' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Fail 'npm is unavailable.' }

Set-Location $RepoRoot

if (-not (Test-Path $BackendEnv -PathType Leaf)) {
    if (-not (Test-Path $BackendEnvExample -PathType Leaf)) { Fail "Backend environment template not found: $BackendEnvExample" }
    Write-Step 'Creating node_code/.env from the safe development template'
    Copy-Item $BackendEnvExample $BackendEnv
    Write-Host 'Review node_code/.env before using real integrations. It is ignored and must not be committed.' -ForegroundColor Yellow
}

if (-not $SkipInstall) {
    Write-Step 'Installing backend dependencies from package-lock.json'
    Invoke-External 'npm' @('ci') $BackendRoot

    Write-Step 'Installing frontend dependencies from package-lock.json'
    Invoke-External 'npm' @('ci', '--legacy-peer-deps') $FrontendRoot
}

$p0Arguments = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $P0Script
)
if ($SkipDbSetup) { $p0Arguments += '-SkipDbSetup' }
if ($RunTests) { $p0Arguments += '-RunTests' }

Write-Step 'Starting migrations, API, and worker'
& powershell.exe @p0Arguments
if ($LASTEXITCODE -ne 0) {
    Fail "P0 backend startup failed with exit code $LASTEXITCODE. Inspect the API and worker PowerShell windows."
}

if (Test-HttpReady 'http://localhost:3001') {
    Write-Host 'Frontend already responds at http://localhost:3001; not starting a second frontend process.' -ForegroundColor Yellow
} else {
    Write-Step 'Starting the Vite frontend in a new PowerShell window'
    Start-FrontendWindow
    if (-not (Wait-HttpReady 'http://localhost:3001' 30)) {
        Write-Warning 'Frontend did not respond within 30 seconds. Inspect the DMlinl Frontend PowerShell window.'
    }
}

Write-Host @"

DMlinl local stack is ready.

Frontend: http://localhost:3001
API:     http://localhost:3000
Health:  http://localhost:3000/health
Ready:   http://localhost:3000/ready

The API, worker, and frontend run in separate PowerShell windows.
Stop each development process with Ctrl+C when finished.
PostgreSQL and Redis run as native Windows services; stop them from the
Services console when you no longer need them.

"@ -ForegroundColor Green
