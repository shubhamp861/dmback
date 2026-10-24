#requires -Version 5.1

[CmdletBinding()]
param(
    [switch]$WhatIf,
    [switch]$IncludeServices
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$EnvFile = Join-Path $RepoRoot 'node_code\.env'

function Write-Step {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Cyan
}

function Get-ApiPort {
    $port = 3000
    if (Test-Path $EnvFile) {
        $line = Get-Content $EnvFile | Where-Object { $_ -match '^PORT=' } | Select-Object -Last 1
        if ($line) {
            $port = [int](($line -split '=', 2)[1].Trim())
        }
    }
    return $port
}

$apiPort = Get-ApiPort
$targets = @{}

foreach ($port in @($apiPort, 3001)) {
    Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | ForEach-Object {
        $process = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        if ($process -and $process.ProcessName -in @('node', 'npm')) {
            $targets[[int]$process.Id] = "port $port"
        }
    }
}

Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and
    $_.CommandLine -match 'dmlinkProject|node_code' -and
    $_.CommandLine -match 'src[\\/](server|worker)\.ts'
} | ForEach-Object {
    $targets[[int]$_.ProcessId] = 'API/worker process'
}

if ($targets.Count -eq 0) {
    Write-Host 'No running DMlinl API, worker, or frontend processes were found.'
} elseif ($WhatIf) {
    foreach ($id in $targets.Keys) {
        Write-Host "Would stop process $id ($($targets[$id]))."
    }
} else {
    foreach ($id in $targets.Keys) {
        if (-not (Get-Process -Id $id -ErrorAction SilentlyContinue)) { continue }
        Write-Step "Stopping process $id ($($targets[$id]))..."
        & taskkill.exe /PID $id /T /F 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Could not stop process $id."
        }
    }
}

if ($IncludeServices) {
    foreach ($name in @('Memurai', 'postgresql-x64-18', 'postgresql-x64-17', 'postgresql-x64-16', 'postgresql-x64-15', 'postgresql-x64-14', 'postgresql', 'pgsql')) {
        $service = Get-Service -Name $name -ErrorAction SilentlyContinue
        if ($service -and $service.Status -eq 'Running') {
            if ($WhatIf) {
                Write-Host "Would stop Windows service '$name'."
            } else {
                Write-Step "Stopping Windows service '$name'..."
                Stop-Service -Name $name -ErrorAction SilentlyContinue
            }
        }
    }
} elseif (-not $WhatIf) {
    Write-Host 'PostgreSQL and Memurai were left running.'
}
