$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

Write-Host "Running backend automated test suite..." -ForegroundColor Green
& "$projectRoot\backend\venv\Scripts\pytest.exe" "$projectRoot\backend\tests" -v
