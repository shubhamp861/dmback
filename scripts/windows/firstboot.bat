@echo off
setlocal
title DMlinl First Boot
set "ROOT=%~dp0..\.."
pushd "%ROOT%" >nul

echo.
echo ==========================================
echo  DMlinl first-time setup
echo ==========================================
echo  This will:
echo   1. check or install Git, Python, Node.js
echo   2. create node_code\.env if missing
echo   3. install backend dependencies
echo   4. apply migrations and seed data
echo   5. run typecheck, tests, and build
echo   6. install frontend dependencies
echo   7. start the API, worker, and frontend
echo.
echo  PostgreSQL and Memurai must already be
echo  installed as Windows services.
echo.

echo [1/3] Running first-time backend setup...
powershell -NoProfile -ExecutionPolicy Bypass -File "node_code\scripts\bootstrap-windows.ps1"
if errorlevel 1 goto :fail

echo.
echo [2/3] Installing frontend dependencies...
call npm --prefix "react-code" ci --legacy-peer-deps
if errorlevel 1 goto :fail

echo.
echo [3/3] Starting the local stack...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\start-local-windows.ps1" -SkipInstall -SkipDbSetup
if errorlevel 1 goto :fail

call :read_frontend_url

echo.
echo First boot complete.
echo   Frontend: %FRONTEND_URL%
echo   API:      http://localhost:3000
echo.
popd
if /i not "%~1"=="/nopause" pause
exit /b 0

:fail
echo.
echo [ERROR] First boot failed. Read the message above.
popd
if /i not "%~1"=="/nopause" pause
exit /b 1

:read_frontend_url
set "FRONTEND_URL=http://localhost:3001"
if exist "node_code\.env" for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b /c:"WEB_ORIGIN=" "node_code\.env" 2^>nul`) do set "FRONTEND_URL=%%B"
exit /b 0
