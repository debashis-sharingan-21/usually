$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

Write-Host "Running Usually Performance and Load Benchmark..." -ForegroundColor Green
& "$projectRoot\backend\venv\Scripts\python.exe" "$projectRoot\scripts\benchmark_performance.py"
