#requires -Version 5.1

[CmdletBinding()]
param(
    [string]$DatabaseUrl = $env:TEST_DATABASE_URL,
    [string]$RedisUrl = $env:TEST_REDIS_URL
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$EnvFile = Join-Path $ProjectRoot '.env'
$testExitCode = 0

function Fail {
    param([string]$Message)
    throw "[test-integration-windows] ERROR: $Message"
}

function Write-Step {
    param([string]$Message)
    Write-Host "`n[test-integration-windows] $Message" -ForegroundColor Cyan
}

function Invoke-External {
    param(
        [string]$Command,
        [string[]]$Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
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

function Get-DerivedDatabaseUrl {
    # Derive the dedicated *_test database URL from DATABASE_URL without ever
    # printing credentials. The harness requires a database ending in _test.
    if (-not (Test-Path $EnvFile -PathType Leaf)) {
        return $null
    }
    $line = Get-Content -Path $EnvFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
    if (-not $line) {
        return $null
    }
    $value = ($line -replace '^DATABASE_URL=', '').Trim()
    if ($value -match '^(.+/)[A-Za-z0-9_]+$') {
        return "$($Matches[1])instagram_automation_test"
    }
    return $null
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Fail 'npm is unavailable.'
}

if (-not $DatabaseUrl) {
    $DatabaseUrl = Get-DerivedDatabaseUrl
}
if (-not $DatabaseUrl) {
    Fail 'TEST_DATABASE_URL is not set and could not be derived from DATABASE_URL in .env. Set TEST_DATABASE_URL to a dedicated database ending in _test.'
}
if ($DatabaseUrl -notmatch '/[A-Za-z0-9_]+_test(\?|$)') {
    Fail 'TEST_DATABASE_URL must name a dedicated database ending in _test.'
}
if (-not $RedisUrl) {
    $RedisUrl = 'redis://127.0.0.1:6379/15'
}
if ($RedisUrl -notmatch '^redis://.+/15$') {
    Fail 'TEST_REDIS_URL must use redis:// and the dedicated test database /15.'
}

Set-Location $ProjectRoot

$env:TEST_DATABASE_URL = $DatabaseUrl
$env:TEST_REDIS_URL = $RedisUrl

Write-Step 'Waiting for native PostgreSQL on 127.0.0.1:5432 and Redis on 127.0.0.1:6379'
for ($attempt = 1; $attempt -le 30; $attempt++) {
    if ((Test-TcpPort -Port 5432) -and (Test-TcpPort -Port 6379)) {
        break
    }
    Start-Sleep -Seconds 1
    if ($attempt -eq 30) {
        Fail 'PostgreSQL and/or Redis are not reachable. Start the native services, then rerun this script.'
    }
}

try {
    Write-Step 'Running the real integration suite against the dedicated test database and Redis /15'
    try {
        Invoke-External 'npm' @('run', 'test:integration')
    } catch {
        $testExitCode = 1
        Write-Host "[test-integration-windows] Integration suite failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} finally {
    if ($env:TEST_DATABASE_URL -eq $DatabaseUrl) {
        Remove-Item -Path Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue
    }
    if ($env:TEST_REDIS_URL -eq $RedisUrl) {
        Remove-Item -Path Env:TEST_REDIS_URL -ErrorAction SilentlyContinue
    }
}

if ($testExitCode -ne 0) {
    exit $testExitCode
}

Write-Host "`n[test-integration-windows] Integration verification passed." -ForegroundColor Green