$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

$env:PYTHONPATH = "$projectRoot\backend"
Write-Host "Starting Usually FastAPI backend on http://127.0.0.1:8000..." -ForegroundColor Green
& "$projectRoot\backend\venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
