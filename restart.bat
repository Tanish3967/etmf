@echo off
@chcp 65001 >nul
title eTMF Pro -- Restarting Services
cls
echo Restarting eTMF Pro frontend and backend services...
call "%~dp0stop.bat"
powershell -NoProfile -Command "Start-Sleep -Seconds 2" >nul 2>&1
call "%~dp0start.bat"
