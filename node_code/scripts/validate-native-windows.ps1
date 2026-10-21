#requires -Version 5.1

[CmdletBinding()]
param(
    [string]$TestDatabaseUrl = $env:TEST_DATABASE_URL,
    [string]$TestRedisUrl = $env:TEST_REDIS_URL,
    [switch]$SkipProjectChecks
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Fail {
    param([string]$Message)
    throw "[validate-native-windows] ERROR: $Message"
}

function Write-Step {
    param([string]$Message)
    Write-Host "`n[validate-native-windows] $Message" -ForegroundColor Cyan
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

function Find-CommandPath {
    param([string[]]$Candidates)

    foreach ($candidate in $Candidates) {
        if ($candidate -and (Test-Path $candidate -PathType Leaf)) { return $candidate }
    }
    return $null
}

function Get-UriPort {
    param([Uri]$Uri)
    if ($Uri.Port -lt 1) { return 6379 }
    return $Uri.Port
}

function Invoke-Postgres {
    param([string[]]$Arguments)

    $previousPassword = $env:PGPASSWORD
    try {
        $env:PGPASSWORD = [Uri]::UnescapeDataString($databaseUri.UserInfo.Split(':', 2)[1])
        Invoke-External $psql $Arguments
    } finally {
        $env:PGPASSWORD = $previousPassword
    }
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Fail 'npm is unavailable.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail 'node is unavailable.' }

$pgIsReady = Find-CommandPath @(
    (Join-Path ${env:ProgramFiles} 'PostgreSQL\16\bin\pg_isready.exe'),
    (Join-Path ${env:ProgramFiles} 'PostgreSQL\15\bin\pg_isready.exe'),
    (Join-Path ${env:ProgramFiles} 'PostgreSQL\14\bin\pg_isready.exe')
)
$psql = Find-CommandPath @(
    (Join-Path ${env:ProgramFiles} 'PostgreSQL\16\bin\psql.exe'),
    (Join-Path ${env:ProgramFiles} 'PostgreSQL\15\bin\psql.exe'),
    (Join-Path ${env:ProgramFiles} 'PostgreSQL\14\bin\psql.exe')
)
$pgCommand = Get-Command pg_isready -ErrorAction SilentlyContinue
$psqlCommand = Get-Command psql -ErrorAction SilentlyContinue
if (-not $pgIsReady -and $pgCommand) { $pgIsReady = $pgCommand.Source }
if (-not $psql -and $psqlCommand) { $psql = $psqlCommand.Source }
if (-not $pgIsReady -or -not $psql) {
    Fail 'PostgreSQL pg_isready/psql was not found. Add the PostgreSQL bin folder to PATH or install PostgreSQL 16.'
}

$memuraiCommand = Get-Command memurai-cli -ErrorAction SilentlyContinue
$redisCommand = Get-Command redis-cli -ErrorAction SilentlyContinue
$redisCli = if ($memuraiCommand) { $memuraiCommand.Source } else { $null }
if (-not $redisCli -and $redisCommand) { $redisCli = $redisCommand.Source }
if (-not $redisCli) {
    $redisCli = Find-CommandPath @(
        (Join-Path ${env:ProgramFiles} 'Memurai\memurai-cli.exe'),
        (Join-Path ${env:ProgramFiles} 'Memurai\bin\memurai-cli.exe')
    )
}
if (-not $redisCli) { Fail 'memurai-cli or redis-cli was not found. Add the Memurai bin folder to PATH.' }

if ([string]::IsNullOrWhiteSpace($TestDatabaseUrl)) {
    Fail 'TEST_DATABASE_URL is required. Example: postgres://integration:PASSWORD@127.0.0.1:5432/instagram_automation_test'
}
if ([string]::IsNullOrWhiteSpace($TestRedisUrl)) {
    Fail 'TEST_REDIS_URL is required. Example: redis://127.0.0.1:6379/15'
}

try { $databaseUri = [Uri]$TestDatabaseUrl } catch { Fail 'TEST_DATABASE_URL is not a valid URL.' }
try { $redisUri = [Uri]$TestRedisUrl } catch { Fail 'TEST_REDIS_URL is not a valid URL.' }
if ($databaseUri.Scheme -notin @('postgres', 'postgresql')) { Fail 'TEST_DATABASE_URL must use postgres:// or postgresql://.' }
if ($databaseUri.AbsolutePath -notmatch '^/[A-Za-z0-9_]+_test$') { Fail 'TEST_DATABASE_URL database name must end in _test.' }
if ($redisUri.Scheme -ne 'redis' -or $redisUri.AbsolutePath -ne '/15') { Fail 'TEST_REDIS_URL must be redis:// with database /15.' }

Set-Location $ProjectRoot

Write-Step 'Checking native PostgreSQL TCP/service availability'
Invoke-External $pgIsReady @('-h', $databaseUri.Host, '-p', (Get-UriPort $databaseUri).ToString(), '-d', $databaseUri.AbsolutePath.TrimStart('/'))

Write-Step 'Checking native Redis/Memurai TCP/service availability'
Invoke-External $redisCli @('-h', $redisUri.Host, '-p', (Get-UriPort $redisUri).ToString(), '-n', '15', 'PING')

Write-Step 'Checking PostgreSQL integration permissions and pgcrypto'
$postgresArguments = @('-h', $databaseUri.Host, '-p', (Get-UriPort $databaseUri).ToString(), '-U', $databaseUri.UserInfo.Split(':', 2)[0], '-d', $databaseUri.AbsolutePath.TrimStart('/'), '-v', 'ON_ERROR_STOP=1')
Invoke-Postgres ($postgresArguments + @('-tAc', 'CREATE EXTENSION IF NOT EXISTS pgcrypto; SELECT current_database();'))
$schemaName = "native_validation_$([Guid]::NewGuid().ToString('N'))"
$schemaSql = 'CREATE SCHEMA "' + $schemaName + '"; DROP SCHEMA "' + $schemaName + '" CASCADE;'
Invoke-Postgres ($postgresArguments + @('-c', $schemaSql))

Write-Step 'Checking Redis/Memurai read/write, logical database 15, and Lua support'
$key = "native-validation-$([Guid]::NewGuid().ToString('N'))"
Invoke-External $redisCli @('-h', $redisUri.Host, '-p', (Get-UriPort $redisUri).ToString(), '-n', '15', 'SET', $key, 'ok', 'EX', '60')
$value = (& $redisCli -h $redisUri.Host -p (Get-UriPort $redisUri).ToString() -n 15 GET $key).Trim()
if ($LASTEXITCODE -ne 0 -or $value -ne 'ok') { Fail 'Redis/Memurai read-back validation failed.' }
$luaResult = (& $redisCli --raw -h $redisUri.Host -p (Get-UriPort $redisUri).ToString() -n 15 EVAL "return redis.call('PING')" 0 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $luaResult -ne 'PONG') {
    Fail "Redis/Memurai Lua validation failed. Server response: $luaResult"
}
Invoke-External $redisCli @('-h', $redisUri.Host, '-p', (Get-UriPort $redisUri).ToString(), '-n', '15', 'DEL', $key)

if (-not $SkipProjectChecks) {
    $env:TEST_DATABASE_URL = $TestDatabaseUrl
    $env:TEST_REDIS_URL = $TestRedisUrl

    Write-Step 'Applying and checking development migrations from .env'
    Invoke-External 'npm' @('run', 'db:migrate')
    Invoke-External 'npm' @('run', 'db:migrate:status')

    Write-Step 'Running typecheck, build, unit tests, and native integration tests'
    Invoke-External 'npm' @('run', 'typecheck')
    Invoke-External 'npm' @('run', 'build')
    Invoke-External 'npm' @('test')
    Invoke-External 'npm' @('run', 'test:integration')
}

Write-Host "`n[validate-native-windows] Native PostgreSQL and Redis validation passed." -ForegroundColor Green
