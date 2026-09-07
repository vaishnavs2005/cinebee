@echo off
setlocal
title CineBee - Local Host
cd /d "%~dp0"

echo =============================================================
echo   🐝 CineBee Local Host Launcher
echo =============================================================

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Node.js is not found in your PATH!
    echo Please download and install Node.js from:
    echo   https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Run host.js passing any arguments forwarded
node host.js %*

if %errorlevel% neq 0 (
    echo.
    echo CineBee exited with error code %errorlevel%.
    pause
)
