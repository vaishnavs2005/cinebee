@echo off
setlocal EnableDelayedExpansion
title Meowvie — Local Host
cd /d "%~dp0"

:: ── Colour helpers (works on Win10+) ──────────────────────────────────────
for /f %%i in ('echo prompt $E^| cmd') do set "ESC=%%i"
set "RESET=%ESC%[0m"
set "BOLD=%ESC%[1m"
set "DIM=%ESC%[2m"
set "CYAN=%ESC%[96m"
set "YELLOW=%ESC%[93m"
set "GREEN=%ESC%[92m"
set "RED=%ESC%[91m"
set "WHITE=%ESC%[97m"
set "PURPLE=%ESC%[95m"

echo.
echo  %PURPLE%%BOLD%╔═══════════════════════════════════════════════════╗%RESET%
echo  %PURPLE%%BOLD%║%RESET%   %YELLOW%🐝  Meowvie  —  Local Host Launcher%RESET%              %PURPLE%%BOLD%║%RESET%
echo  %PURPLE%%BOLD%╚═══════════════════════════════════════════════════╝%RESET%
echo.

:: ── Node.js check ─────────────────────────────────────────────────────────
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  %RED%[✗] Node.js not found in PATH.%RESET%
    echo.
    echo  %DIM%Install Node.js from  https://nodejs.org/%RESET%
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v 2^>nul') do set NODE_VER=%%v
echo  %GREEN%[✓]%RESET% Node.js %CYAN%%NODE_VER%%RESET% detected
echo.

:: ── Launch host.js ─────────────────────────────────────────────────────────
echo  %WHITE%Starting server…%RESET%
echo.
node host.js %*

:: ── Exit handling ──────────────────────────────────────────────────────────
set EXIT_CODE=%errorlevel%
if %EXIT_CODE% neq 0 (
    echo.
    echo  %RED%[✗] Meowvie exited with error code %EXIT_CODE%.%RESET%
    echo.
    pause
)
