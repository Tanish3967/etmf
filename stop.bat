@echo off
@chcp 65001 >nul
title eTMF Pro -- Stopping Services
cls
echo =====================================================================
echo   eTMF Pro -- Terminating Frontend and Backend Services
echo =====================================================================
echo.

echo Stopping services on Port 3000 (Frontend) and Port 3002 (Backend)...

:: Terminate processes listening on ports 3000 and 3002 via PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = @(3000, 3002); foreach ($port in $ports) { $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue; foreach ($c in $conns) { try { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host ('  [OK] Terminated process (PID ' + $c.OwningProcess + ') on Port ' + $port) } catch {} } }"

:: Also close command prompt windows created by start.bat
taskkill /FI "WINDOWTITLE eq eTMF Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq eTMF Frontend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq eTMF Pro Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq eTMF Pro Frontend*" /T /F >nul 2>&1

echo.
echo =====================================================================
echo   eTMF Pro services have been stopped.
echo =====================================================================
echo.
