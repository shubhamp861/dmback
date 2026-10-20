#requires -Version 5.1

[CmdletBinding()]
param(
    [string]$PostgresPort = $env:TEST_POSTGRES_PORT
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ComposeFile = Join-Path $ProjectRoot 'docker-compose.test.yml'
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

if (-not (Test-Path $ComposeFile -PathType Leaf)) {
    Fail "docker-compose.test.yml was not found at $ComposeFile"
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Fail 'npm is unavailable.'
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail 'Docker CLI is unavailable. Start Docker Desktop and try again.'
}

Set-Location $ProjectRoot

if ($PostgresPort) {
    if ($PostgresPort -notmatch '^[1-9][0-9]{2,4}$') {
        Fail "TEST_POSTGRES_PORT must be a numeric TCP port; received '$PostgresPort'."
    }
    $env:TEST_POSTGRES_PORT = $PostgresPort
    Write-Step "Using PostgreSQL test port $PostgresPort"
}

try {
    Write-Step 'Removing any leftover disposable integration containers'
    Invoke-External 'npm' @('run', 'test:infra:down')

    Write-Step 'Starting disposable PostgreSQL and Redis services'
    Invoke-External 'npm' @('run', 'test:infra:up')

    Write-Step 'Running the real integration suite'
    try {
        Invoke-External 'npm' @('run', 'test:integration')
    } catch {
        $testExitCode = 1
        Write-Host "[test-integration-windows] Integration suite failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} finally {
    Write-Step 'Stopping disposable integration services'
    try {
        Invoke-External 'npm' @('run', 'test:infra:down')
    } catch {
        Write-Warning "Cleanup failed: $($_.Exception.Message)"
        if ($testExitCode -eq 0) { $testExitCode = 1 }
    }
}

if ($testExitCode -ne 0) {
    exit $testExitCode
}

Write-Host "`n[test-integration-windows] Integration verification passed." -ForegroundColor Green
