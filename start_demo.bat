@echo off
echo Starting Intelligent Timetable Generation Engine (Backend + Frontend)...
start "Timetable Backend (Port 8000)" cmd /k "cd /d "%~dp0backend" && .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
start "Timetable Frontend (Port 3000)" cmd /k "cd /d "%~dp0frontend" && npm run dev"
echo Backend API Docs: http://127.0.0.1:8000/docs
echo Frontend Web UI:  http://localhost:3000
