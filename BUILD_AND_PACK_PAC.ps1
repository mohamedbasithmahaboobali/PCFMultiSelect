# PowerShell Script: Build PCF and Pack Solution using PAC CLI (no MSBuild)
# This script does NOT require NuGet packages or .NET Framework build tools

param(
    [string]$OutputPath = "C:\Basith\MultiSelectPCF\bin",
    [string]$SolutionName = "LookupMultiSelectSolution"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PCF Build & PAC Solution Pack" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if PAC CLI is installed
Write-Host "`nChecking for PAC CLI..." -ForegroundColor Yellow
$pacCheck = pac solution help 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: PAC CLI not found or not accessible. Install it with:" -ForegroundColor Red
    Write-Host "  dotnet tool install -g Microsoft.PowerApps.CLI" -ForegroundColor Yellow
    exit 1
}
Write-Host "PAC CLI found and ready" -ForegroundColor Green

# Step 1: Build PCF bundle
Write-Host "`n[Step 1] Building PCF bundle with npm..." -ForegroundColor Yellow
$pcfPath = "C:\Basith\MultiSelectPCF\MultiSelectLookup"
if (-not (Test-Path $pcfPath)) {
    Write-Host "ERROR: PCF project path not found: $pcfPath" -ForegroundColor Red
    exit 1
}

Push-Location $pcfPath
Write-Host "Running: npm run build" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: npm build failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "PCF bundle built successfully" -ForegroundColor Green

# Step 2: Ensure output directory exists
Write-Host "`n[Step 2] Preparing output directory..." -ForegroundColor Yellow
if (-not (Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
    Write-Host "Created output directory: $OutputPath" -ForegroundColor Green
}

# Step 3: Pack solution using PAC CLI
Write-Host "`n[Step 3] Packing solution with PAC CLI..." -ForegroundColor Yellow
$solutionPath = "C:\Basith\MultiSelectPCF\LookupMultiSelectSolution"
$zipPath = "$OutputPath\$SolutionName.zip"

Push-Location $solutionPath
Write-Host "Running: pac solution pack --folder src --zipfile '$zipPath'" -ForegroundColor Cyan
pac solution pack --folder src --zipfile $zipPath
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: PAC solution pack failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "Solution packed successfully" -ForegroundColor Green

# Step 4: Verify output
if (Test-Path $zipPath) {
    $size = (Get-Item $zipPath).Length / 1MB
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Solution ZIP created:" -ForegroundColor Green
    Write-Host "  Path: $zipPath" -ForegroundColor Cyan
    Write-Host "  Size: $([math]::Round($size, 2)) MB" -ForegroundColor Cyan
    Write-Host "`nNext steps:" -ForegroundColor Yellow
    Write-Host "  1. Use PAC to import: pac solution import --path '$zipPath' --environment <env-id>" -ForegroundColor Cyan
    Write-Host "  2. Or upload manually via Power Platform admin center" -ForegroundColor Cyan
} else {
    Write-Host "ERROR: Solution ZIP not found at $zipPath" -ForegroundColor Red
    exit 1
}

Write-Host "`nDone!" -ForegroundColor Green
