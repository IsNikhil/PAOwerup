# Windows setup (PowerShell). Requires Python 3.11 (py launcher), Node 20+, FFmpeg on PATH.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { Write-Warning "FFmpeg not found - run: winget install Gyan.FFmpeg" }
py -3.11 -m venv backend\.venv
backend\.venv\Scripts\python -m pip install --upgrade pip
backend\.venv\Scripts\python -m pip install -r backend\requirements.txt
Push-Location frontend; npm install; Pop-Location
if (-not (Test-Path backend\.env)) { Copy-Item backend\.env.example backend\.env }
Write-Host "Setup done. Optional: add GEMINI_API_KEY to backend\.env, then run scripts\dev.ps1"
