# Run FastAPI Backend Server
Write-Host "Starting Hospital Bill Auditor Backend on http://localhost:8000..." -ForegroundColor Cyan

$env:PYTHONPATH = "."
& ".\backend\.venv\Scripts\python.exe" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
