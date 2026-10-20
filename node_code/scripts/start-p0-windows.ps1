#requires -Version 5.1

[CmdletBinding()]
param(
    [switch]$SkipDbSetup,
    [switch]$RunTests
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ComposeFile = Join-Path $ProjectRoot 'docker-compose.yml'
$ApiUrl = 'http://127.0.0.1:3000'

function Fail {
    param([string]$Message)
    throw "[start-p0-windows] ERROR: $Message"
}

function Write-Step {
    param([string]$Message)
    Write-Host "`n[start-p0-windows] $Message" -ForegroundColor Cyan
}

function Invoke-External {
    param(
        [string]$Command,
        [string[]]$Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        Fail "$Command $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

function Start-DockerDesktop {
    if (Test-DockerReady) { return }

    $running = Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue
    if ($running) { return }

    $candidates = @(
        (Join-Path ${env:ProgramFiles} 'Docker\Docker\Docker Desktop.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Docker\Docker\Docker Desktop.exe'),
        (Join-Path ${env:LOCALAPPDATA} 'Docker\Docker Desktop.exe'),
        (Join-Path ${env:LOCALAPPDATA} 'Docker\Docker\Docker Desktop.exe')
    ) | Where-Object { $_ -and (Test-Path $_ -PathType Leaf) } | Select-Object -Unique

    if ($candidates.Count -gt 0) {
        Write-Step 'Starting Docker Desktop'
        try {
            Start-Process -FilePath $candidates[0] | Out-Null
        } catch {
            Write-Warning "Docker Desktop could not be started automatically from '$($candidates[0])'. Start it manually."
        }
    } else {
        Write-Warning 'Docker Desktop executable was not found in standard paths. Start Docker Desktop manually, then this script will continue waiting for its engine.'
    }
}

function Test-DockerReady {
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        # docker.exe writes the expected "daemon is not running" message to
        # stderr while Docker Desktop is starting. It is a readiness result,
        # not a PowerShell script failure.
        $ErrorActionPreference = 'Continue'
        & docker info 1>$null 2>$null
        return ($LASTEXITCODE -eq 0)
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

function Wait-ApiReady {
    param([int]$TimeoutSeconds = 30)

    for ($attempt = 1; $attempt -le $TimeoutSeconds; $attempt++) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri "$ApiUrl/ready" -TimeoutSec 3
            if ($response.StatusCode -eq 200) {
                $body = $response.Content | ConvertFrom-Json
                if ($body.dependencies.database -eq 'ok' -and $body.dependencies.queue -eq 'ok') {
                    return
                }
            }
        } catch {
            # API may still be starting or dependencies may still be initializing.
        }
        Start-Sleep -Seconds 1
    }
    Fail "API readiness did not become healthy at $ApiUrl/ready. Inspect the API PowerShell window."
}

if (-not (Test-Path $ComposeFile -PathType Leaf)) {
    Fail "docker-compose.yml was not found at $ComposeFile"
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Fail 'npm is unavailable. Run scripts/bootstrap-windows.ps1 first.'
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail 'Docker CLI is unavailable. Start/install Docker Desktop first.'
}
if (-not (Test-Path (Join-Path $ProjectRoot '.env') -PathType Leaf)) {
    Fail '.env is missing. Run scripts/bootstrap-windows.ps1 first.'
}
if (-not (Test-Path (Join-Path $ProjectRoot 'node_modules\.bin\tsx') -PathType Leaf)) {
    Fail 'npm dependencies are missing. Run npm ci first.'
}

Set-Location $ProjectRoot
New-Item -ItemType Directory -Force -Path (Join-Path $ProjectRoot '.docker-data\postgres') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $ProjectRoot '.docker-data\redis') | Out-Null

Start-DockerDesktop
Write-Step 'Waiting for Docker Desktop'
$dockerReady = $false
for ($attempt = 1; $attempt -le 60; $attempt++) {
    if (Test-DockerReady) {
        $dockerReady = $true
        break
    }
    Start-Sleep -Seconds 2
}
if (-not $dockerReady) {
    Fail 'Docker Desktop is not ready. Start it, wait for the Linux engine, and rerun this script.'
}

Write-Step 'Starting PostgreSQL and Redis'
Invoke-External 'docker' @('compose', '--file', $ComposeFile, 'up', '-d', '--wait')
Invoke-External 'docker' @('compose', '--file', $ComposeFile, 'exec', '-T', 'postgres', 'pg_isready', '-U', 'instagram', '-d', 'instagram_automation')
Invoke-External 'docker' @('compose', '--file', $ComposeFile, 'exec', '-T', 'redis', 'redis-cli', 'ping')

if (-not $SkipDbSetup) {
    Write-Step 'Applying migrations and seed data'
    Invoke-External 'npm' @('run', 'db:migrate')
    Invoke-External 'npm' @('run', 'db:migrate:status')
    Invoke-External 'npm' @('run', 'db:seed')
}

function Start-ModuleWindow {
    param(
        [string]$Title,
        [string]$NpmScript
    )

    $escapedRoot = $ProjectRoot.Replace("'", "''")
    $command = "`$Host.UI.RawUI.WindowTitle = '$Title'; Set-Location -LiteralPath '$escapedRoot'; npm run $NpmScript"
    return Start-Process -FilePath 'powershell.exe' -WorkingDirectory $ProjectRoot -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $command
    ) -PassThru
}

try {
    $health = Invoke-WebRequest -UseBasicParsing -Uri "$ApiUrl/health" -TimeoutSec 2
    if ($health.StatusCode -eq 200) {
        Write-Host 'API already responds at http://127.0.0.1:3000; not starting a second API process.' -ForegroundColor Yellow
        $apiProcess = $null
    }
} catch {
    Write-Step 'Starting API and worker PowerShell windows'
    $apiProcess = Start-ModuleWindow -Title 'DMlinl API' -NpmScript 'dev'
}

$workerProcess = Start-ModuleWindow -Title 'DMlinl Worker' -NpmScript 'dev:worker'

Write-Step 'Waiting for API/PostgreSQL/Redis readiness'
Wait-ApiReady

if ($RunTests) {
    Write-Step 'Running typecheck, unit tests, and build'
    Invoke-External 'npm' @('run', 'typecheck')
    Invoke-External 'npm' @('test')
    Invoke-External 'npm' @('run', 'build')
}

Write-Host @"

P0 development stack is ready.

API:    http://127.0.0.1:3000
Health: $ApiUrl/health
Ready:  $ApiUrl/ready

Docker services:
  PostgreSQL: 127.0.0.1:5432
  Redis:      127.0.0.1:6379

API and worker were started in separate PowerShell windows.
Close those windows with Ctrl+C when finished. To stop infrastructure later:
  docker compose down

Replay endpoint:
  POST /v1/webhook-events/:id/replay
"@
