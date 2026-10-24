#requires -Version 5.1

[CmdletBinding()]
param(
    [switch]$SkipDbSetup
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

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
    Fail 'PostgreSQL and/or Redis did not become reachable on 127.0.0.1:5432 and 127.0.0.1:6379.'
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Fail 'npm is unavailable. Run scripts/bootstrap-windows.ps1 first.'
}
if (-not (Test-Path (Join-Path $ProjectRoot '.env') -PathType Leaf)) {
    Fail '.env is missing. Run scripts/bootstrap-windows.ps1 first; its existing .env is preserved.'
}
if (-not (Test-Path (Join-Path $ProjectRoot 'node_modules\.bin\tsx') -PathType Leaf)) {
    Fail 'npm dependencies are missing. Run npm ci first.'
}

Set-Location $ProjectRoot

Wait-NativeInfrastructure

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