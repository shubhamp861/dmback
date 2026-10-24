#requires -Version 5.1

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
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

function Test-TcpPort {
    param(
        [string]$HostName = '127.0.0.1',
        [int]$Port
    )

    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $task = $client.ConnectAsync($HostName, $Port)
        if (-not $task.Wait(2000)) {
            $client.Close()
            return $false
        }
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

function Start-NativeService {
    param(
        [string[]]$CandidateNames,
        [string]$Label
    )

    foreach ($name in $CandidateNames) {
        $service = Get-Service -Name $name -ErrorAction SilentlyContinue
        if ($service) {
            if ($service.Status -ne 'Running') {
                Write-Step "Starting Windows service '$name' for $Label"
                try {
                    Start-Service -Name $name -ErrorAction Stop
                } catch {
                    Write-Warning "Could not start '$name'. Start it manually (administrator rights may be required): $($_.Exception.Message)"
                }
            }
            return
        }
    }
    Write-Warning "No installed Windows service found for $Label; assuming it is already listening."
}

function Wait-NativeInfrastructure {
    Start-NativeService -CandidateNames @('postgresql-x64-18', 'postgresql-x64-17', 'postgresql-x64-16', 'postgresql-x64-15', 'postgresql-x64-14', 'postgresql', 'pgsql') -Label 'PostgreSQL'
    Start-NativeService -CandidateNames @('Memurai', 'Redis', 'redis') -Label 'Redis'

    Write-Step 'Waiting for PostgreSQL on 127.0.0.1:5432 and Redis on 127.0.0.1:6379'
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        if ((Test-TcpPort -Port 5432) -and (Test-TcpPort -Port 6379)) {
            return
        }
        Start-Sleep -Seconds 1
    }
    Fail 'PostgreSQL and/or Redis did not become reachable on 127.0.0.1:5432 and 127.0.0.1:6379. Install PostgreSQL and Redis/Memurai, then rerun this script.'
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
WEB_ORIGIN=http://localhost:3001
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

Set-Location $ProjectRoot

Write-Step 'Checking Windows development tools'
Ensure-Command 'git' 'Git.Git'
Ensure-Command 'python' 'Python.Python.3.12'
Ensure-Command 'node' 'OpenJS.NodeJS.LTS'
Ensure-Command 'npm' 'OpenJS.NodeJS.LTS'

New-LocalEnv

Write-Step 'Installing locked npm dependencies'
Invoke-Npm @('ci')

Wait-NativeInfrastructure

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
