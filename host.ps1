# Meowvie PowerShell Local Host Launcher
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host "=============================================================" -ForegroundColor Yellow
Write-Host "   🐝 Meowvie Local Host Launcher (PowerShell)" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Yellow

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not found in PATH." -ForegroundColor Red
    Write-Host "Please install Node.js (v18+) from https://nodejs.org/"
    pause
    exit 1
}

node host.js @args
