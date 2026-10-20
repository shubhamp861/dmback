#requires -Version 5.1

[CmdletBinding()]
param(
    [switch]$SkipDbSetup
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ComposeFile = Join-Path $ProjectRoot 'docker-compose.yml'

function Fail {
    param([string]$Message)
    throw "[start-dev-windows] ERROR: $Message"
}

function Write-Step {
    param([string]$Message)
    Write-Host "`n[start-dev-windows] $Message" -ForegroundColor Cyan
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
    if (Test-DockerReady) {
        return
    }

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
        $ErrorActionPreference = 'Continue'
        & docker info 1>$null 2>$null
        return ($LASTEXITCODE -eq 0)
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

if (-not (Test-Path $ComposeFile)) {
    Fail "docker-compose.yml was not found at $ComposeFile"
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Fail 'npm is unavailable. Run scripts/bootstrap-windows.ps1 first.'
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail 'Docker CLI is unavailable. Run scripts/bootstrap-windows.ps1 first.'
}
if (-not (Test-Path (Join-Path $ProjectRoot '.env') -PathType Leaf)) {
    Fail '.env is missing. Run scripts/bootstrap-windows.ps1 first; its existing .env is preserved.'
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
    Fail 'Docker Desktop is not ready. Start it, wait for the Linux engine, and rerun this command.'
}

Write-Step 'Starting PostgreSQL and Redis containers'
Invoke-External 'docker' @('compose', '--file', $ComposeFile, 'up', '-d', '--wait')

Write-Step 'Verifying PostgreSQL and Redis'
Invoke-External 'docker' @('compose', '--file', $ComposeFile, 'exec', '-T', 'postgres', 'pg_isready', '-U', 'instagram', '-d', 'instagram_automation')
Invoke-External 'docker' @('compose', '--file', $ComposeFile, 'exec', '-T', 'redis', 'redis-cli', 'ping')

if (-not $SkipDbSetup) {
    Write-Step 'Applying migrations and seed data'
    Invoke-External 'npm' @('run', 'db:migrate')
    Invoke-External 'npm' @('run', 'db:migrate:status')
    Invoke-External 'npm' @('run', 'db:seed')
}

Write-Host @"

Backend infrastructure is ready. The API will run in this window; stop it with Ctrl-C.
The worker is separate: run `npm run dev:worker` in another PowerShell window.

"@

& npm run dev
exit $LASTEXITCODE
