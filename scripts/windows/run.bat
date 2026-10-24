@echo off
setlocal
title DMlinl Run
set "ROOT=%~dp0..\.."
pushd "%ROOT%" >nul

if not exist "node_code\.env" goto :need_setup
if not exist "node_code\node_modules" goto :need_setup
if not exist "react-code\node_modules" goto :need_setup

echo Starting DMlinl (dependencies, migrations, and seed data are assumed ready)...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\start-local-windows.ps1" -SkipInstall -SkipDbSetup
if errorlevel 1 goto :fail

call :read_frontend_url

echo.
echo DMlinl is starting in separate windows.
echo   Frontend: %FRONTEND_URL%
echo   API:      http://localhost:3000
echo.
popd
if /i not "%~1"=="/nopause" pause
exit /b 0

:need_setup
echo.
echo [ERROR] Setup is incomplete.
echo Run firstboot.bat once before using run.bat.
echo.
popd
if /i not "%~1"=="/nopause" pause
exit /b 1

:fail
echo.
echo [ERROR] Startup failed. Read the message above.
popd
if /i not "%~1"=="/nopause" pause
exit /b 1

:read_frontend_url
set "FRONTEND_URL=http://localhost:3001"
if exist "node_code\.env" for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b /c:"WEB_ORIGIN=" "node_code\.env" 2^>nul`) do set "FRONTEND_URL=%%B"
exit /b 0
