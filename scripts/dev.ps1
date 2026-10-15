# Windows: start backend and frontend in two windows.
Set-Location (Join-Path $PSScriptRoot "..")
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --reload-dir app"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev -- --host 127.0.0.1"
Write-Host "PAOwerUp Careers -> http://localhost:5173"
