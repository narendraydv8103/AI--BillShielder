# Run Pytest Test Suite
Write-Host "Running Hospital Bill Auditor Test Suite..." -ForegroundColor Cyan

$env:PYTHONPATH = "."
& ".\backend\.venv\Scripts\pytest.exe" -v
