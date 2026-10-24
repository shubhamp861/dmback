#requires -Version 5.1

[CmdletBinding()]
param(
    [switch]$SkipDbSetup,
    [switch]$RunTests
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
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

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Fail 'npm is unavailable. Run scripts/bootstrap-windows.ps1 first.'
}
if (-not (Test-Path (Join-Path $ProjectRoot '.env') -PathType Leaf)) {
    Fail '.env is missing. Run scripts/bootstrap-windows.ps1 first.'
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

function Test-WorkerRunning {
    $workers = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -and
        $_.CommandLine -match 'worker\.(ts|js)' -and
        $_.CommandLine -match 'dmlinkProject|node_code'
    }
    return [bool]$workers
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

if (Test-WorkerRunning) {
    Write-Host 'Worker is already running; not starting a second worker.' -ForegroundColor Yellow
    $workerProcess = $null
} else {
    $workerProcess = Start-ModuleWindow -Title 'DMlinl Worker' -NpmScript 'dev:worker'
}

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

Native services:
  PostgreSQL: 127.0.0.1:5432
  Redis:      127.0.0.1:6379

API and worker were started in separate PowerShell windows.
Close those windows with Ctrl+C when finished.

Replay endpoint:
  POST /v1/webhook-events/:id/replay
"@