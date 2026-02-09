param(
    [string]$OutputPathOverride = $null,
    [string]$SolutionNameOverride = $null
)

# PowerShell Script: Build PCF and Pack Solution using PAC CLI (no MSBuild)
# This script does NOT require NuGet packages or .NET Framework build tools

# ============================================
# CONFIGURATION - Modify these paths as needed
# ============================================
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PcfPath = Join-Path $RepoRoot "MultiSelectLookup"
$SolutionPath = Join-Path $RepoRoot "LookupMultiSelectSolution"
$OutputPath = Join-Path $RepoRoot "bin"
$SolutionName = "LookupMultiSelectSolution"
# ============================================

# Use override parameters if provided
if ($OutputPathOverride) { $OutputPath = $OutputPathOverride }
if ($SolutionNameOverride) { $SolutionName = $SolutionNameOverride }

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PCF Build & PAC Solution Pack" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Repo Root:     $RepoRoot" -ForegroundColor Gray
Write-Host "PCF Path:      $PcfPath" -ForegroundColor Gray
Write-Host "Solution Path: $SolutionPath" -ForegroundColor Gray
Write-Host "Output Path:   $OutputPath" -ForegroundColor Gray
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
if (-not (Test-Path $PcfPath)) {
    Write-Host "ERROR: PCF project path not found: $PcfPath" -ForegroundColor Red
    exit 1
}

Push-Location $PcfPath
Write-Host "Running: npm run build" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: npm build failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "PCF bundle built successfully" -ForegroundColor Green

# Step 1.5: Copy built PCF control into solution src so PAC pack includes it
Write-Host "`n[Step 1.5] Copy built PCF control into solution src (CustomControls)" -ForegroundColor Yellow
$controlOut = Join-Path $PcfPath "out\controls\LookupMultiSelect"
$destControls = Join-Path $SolutionPath "src\CustomControls\MultiSelectLookup.LookupMultiSelect"
if (Test-Path $controlOut) {
    if (Test-Path $destControls) { Remove-Item $destControls -Recurse -Force }
    New-Item -ItemType Directory -Path $destControls -Force | Out-Null
    Copy-Item -Path (Join-Path $controlOut "*") -Destination $destControls -Recurse -Force
    Write-Host "Copied built PCF control from $controlOut to $destControls" -ForegroundColor Green
} else {
    Write-Host "Warning: built PCF control folder not found: $controlOut" -ForegroundColor Yellow
}

# Step 2: Ensure output directory exists
Write-Host "`n[Step 2] Preparing output directory..." -ForegroundColor Yellow
if (-not (Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
    Write-Host "Created output directory: $OutputPath" -ForegroundColor Green
}

# Step 3: Pack solution using PAC CLI
Write-Host "`n[Step 3] Packing solution with PAC CLI..." -ForegroundColor Yellow
$zipPath = Join-Path $OutputPath "$SolutionName.zip"

Push-Location $SolutionPath
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
