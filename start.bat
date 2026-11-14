@echo off
@chcp 65001 >nul
title eTMF Pro -- Clinical Trial Master File Launcher
cls
echo =====================================================================
echo   eTMF Pro -- Enterprise Clinical Trial Master File (21 CFR Part 11)
echo =====================================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed or not in PATH!
    pause
    exit /b 1
)

echo [2/3] Starting eTMF Backend API (Port 3002)...
start "eTMF Backend" cmd /k "title eTMF Backend && npm start"

echo [3/3] Starting Next.js Frontend (Port 3000)...
start "eTMF Frontend" cmd /k "title eTMF Frontend && npm --prefix frontend run dev"

echo.
echo =====================================================================
echo   Servers launched successfully!
echo =====================================================================
echo   - Frontend (Next.js):  http://localhost:3000
echo   - Backend API:         http://localhost:3002
echo   - API Health Check:    http://localhost:3002/health
echo.
echo   Seeded Credentials:
echo   - Email:     e.vasquez@pharma.com
echo   - Password:  Admin1234!
echo   - Role:      TMF Manager / Lead Auditor
echo.
echo   To stop all services, double-click: stop.bat
echo =====================================================================
echo.

powershell -NoProfile -Command "Start-Sleep -Seconds 2" >nul 2>&1
start http://localhost:3000

exit /b 0
