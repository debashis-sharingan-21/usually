$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location "$projectRoot\frontend"

Write-Host "Starting Usually Frontend (Next.js App Router) on http://localhost:3000..." -ForegroundColor Green
npm run dev
