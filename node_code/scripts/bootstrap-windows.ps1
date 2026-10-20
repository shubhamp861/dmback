#requires -Version 5.1

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ComposeFile = Join-Path $ProjectRoot 'docker-compose.yml'
$EnvFile = Join-Path $ProjectRoot '.env'

function Write-Step {
    param([string]$Message)
    Write-Host "`n[bootstrap-windows] $Message" -ForegroundColor Cyan
}

function Fail {
    param([string]$Message)
    throw "[bootstrap-windows] ERROR: $Message"
}

function Refresh-Path {
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machinePath;$userPath"
}

function Invoke-WingetInstall {
    param([string]$Id)

    $installed = (& winget list --id $Id --exact --accept-source-agreements 2>$null | Out-String)
    if ($installed -match [regex]::Escape($Id)) {
        Write-Host "Already installed: $Id"
        return
    }

    Write-Step "Installing $Id with winget"
    & winget install --id $Id --exact `
        --accept-source-agreements `
        --accept-package-agreements `
        --silent
    if ($LASTEXITCODE -ne 0) {
        Fail "winget could not install $Id. Install it manually and rerun this script."
    }
    Refresh-Path
}

function Ensure-Command {
    param(
        [string]$Name,
        [string]$PackageId
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Invoke-WingetInstall $PackageId
    }
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Fail "$Name is still unavailable. Close and reopen PowerShell, then rerun this script."
    }
}

function Invoke-Npm {
    param([string[]]$Arguments)

    & npm @Arguments
    if ($LASTEXITCODE -ne 0) {
        Fail "npm command failed: npm $($Arguments -join ' ')"
    }
}

function New-LocalEnv {
    if (Test-Path $EnvFile) {
        Write-Step 'Preserving existing .env'
        return
    }

    Write-Step 'Creating local development .env'
    $tokenBytes = New-Object byte[] 32
    $verifyBytes = New-Object byte[] 32
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $random.GetBytes($tokenBytes)
        $random.GetBytes($verifyBytes)
    }
    finally {
        $random.Dispose()
    }

    $tokenKey = [Convert]::ToBase64String($tokenBytes)
    $verifyToken = ([BitConverter]::ToString($verifyBytes)).Replace('-', '').ToLowerInvariant()
    $content = @"
NODE_ENV=development
PORT=3000
HOST=127.0.0.1
DATABASE_URL=postgres://instagram:instagram@127.0.0.1:5432/instagram_automation
REDIS_URL=redis://127.0.0.1:6379
META_APP_ID=development-app-id
META_APP_SECRET=development-app-secret
META_REDIRECT_URI=http://127.0.0.1:3000/v1/auth/instagram/callback
META_API_VERSION=v23.0
META_GRAPH_BASE_URL=https://graph.instagram.com
META_OAUTH_BASE_URL=https://api.instagram.com
META_INSTAGRAM_SCOPES=instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages
META_WEBHOOK_VERIFY_TOKEN=$verifyToken
TOKEN_ENCRYPTION_KEY=$tokenKey
WEB_ORIGIN=http://127.0.0.1:3001
LOG_LEVEL=info
"@
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($EnvFile, $content.TrimStart(), $utf8NoBom)
}

if ($env:OS -ne 'Windows_NT') {
    Fail 'This script is for Windows PowerShell. Use scripts/bootstrap.sh on Ubuntu/Debian/WSL.'
}

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Fail 'winget is required. Install or update App Installer from the Microsoft Store, then rerun this script.'
}

if (-not (Test-Path $ComposeFile)) {
    Fail "docker-compose.yml was not found at $ComposeFile"
}

Set-Location $ProjectRoot

Write-Step 'Checking Windows development tools'
Ensure-Command 'git' 'Git.Git'
Ensure-Command 'python' 'Python.Python.3.12'
Ensure-Command 'node' 'OpenJS.NodeJS.LTS'
Ensure-Command 'npm' 'OpenJS.NodeJS.LTS'
Ensure-Command 'docker' 'Docker.DockerDesktop'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail 'Docker CLI is unavailable after installation.'
}

$dockerDesktop = Join-Path ${env:ProgramFiles} 'Docker\Docker\Docker Desktop.exe'
if (Test-Path $dockerDesktop) {
    Write-Step 'Starting Docker Desktop'
    Start-Process -FilePath $dockerDesktop | Out-Null
}

Write-Step 'Waiting for Docker Desktop'
$dockerReady = $false
for ($attempt = 1; $attempt -le 60; $attempt++) {
    & docker info *> $null
    if ($LASTEXITCODE -eq 0) {
        $dockerReady = $true
        break
    }
    Start-Sleep -Seconds 2
}
if (-not $dockerReady) {
    Fail 'Docker Desktop is not ready. Start Docker Desktop, wait until it is running, and rerun this script.'
}

New-LocalEnv

Write-Step 'Installing locked npm dependencies'
Invoke-Npm @('ci')

Write-Step 'Starting PostgreSQL and Redis containers'
& docker compose --file $ComposeFile up -d --wait
if ($LASTEXITCODE -ne 0) {
    Fail 'Docker Compose could not start PostgreSQL and Redis.'
}

Write-Step 'Applying migrations and seed data'
Invoke-Npm @('run', 'db:migrate')
Invoke-Npm @('run', 'db:migrate:status')
Invoke-Npm @('run', 'db:seed')

Write-Step 'Running typecheck, tests, and build'
Invoke-Npm @('run', 'typecheck')
Invoke-Npm @('test')
Invoke-Npm @('run', 'build')

Write-Host @"

Windows onboarding is complete.

Start the API in this PowerShell window:
  npm run dev

Start the worker in a second PowerShell window:
  npm run dev:worker

API health check:
  Invoke-WebRequest http://127.0.0.1:3000/health

This is a local development setup. Do not use the generated local secrets or
seed credentials in production.
"@
