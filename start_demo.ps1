# One-Command Startup Script for Intelligent Timetable Generator Demo
Write-Host "Starting Intelligent Timetable Generation Engine (Backend + Frontend)..." -ForegroundColor Cyan

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RepoRoot "backend"
$FrontendDir = Join-Path $RepoRoot "frontend"

# Start Backend on port 8000
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendDir'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

# Start Frontend on port 3000
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendDir'; npm run dev"

Write-Host "Backend API & Swagger Docs: http://127.0.0.1:8000/docs" -ForegroundColor Green
Write-Host "Frontend Web Application:   http://localhost:3000" -ForegroundColor Green
