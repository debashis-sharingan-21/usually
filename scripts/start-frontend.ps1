$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location "$projectRoot\frontend"

Write-Host "Starting Usually Frontend (Vite) on http://localhost:5173..." -ForegroundColor Green
npm run dev
