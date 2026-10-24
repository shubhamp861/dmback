@echo off
setlocal
title DMlinl Stop

echo Closing the DMlinl API, worker, and frontend processes...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1"
if errorlevel 1 echo [WARN] Some processes could not be stopped.

if /i not "%~1"=="/nopause" pause
exit /b 0
