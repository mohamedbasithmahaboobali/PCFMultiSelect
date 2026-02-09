param(
    [string[]]$packages = @('Microsoft.PowerApps.MSBuild.Solution','Microsoft.PowerApps.MSBuild.Pcf','Microsoft.NETFramework.ReferenceAssemblies')
)

$feed = 'C:\LocalNuGetFeed'
New-Item -ItemType Directory -Path $feed -Force | Out-Null

Add-Type -AssemblyName System.IO.Compression.FileSystem

$downloaded = @{}

function Get-LatestVersion([string]$id) {
    $url = "https://api.nuget.org/v3-flatcontainer/$($id.ToLower())/index.json"
    try {
        $json = Invoke-RestMethod -Uri $url -UseBasicParsing -ErrorAction Stop
        return $json.versions[-1]
    } catch {
        $err = $_.Exception.Message
        Write-Host ("Failed to get versions for {0}: {1}" -f $id, $err) -ForegroundColor Yellow
        return $null
    }
}

function Download-Package([string]$id, [string]$version) {
    $key = "$id|$version"
    if ($downloaded.ContainsKey($key)) { return }
    $downloaded[$key] = $true

    if (-not $version -or $version -eq 'latest') { $version = Get-LatestVersion $id }
    if (-not $version) { Write-Host "No version found for $id" -ForegroundColor Red; return }

    $nupkgName = "$id.$version.nupkg"
    $dest = Join-Path $feed $nupkgName
    if (-not (Test-Path $dest)) {
        $url = "https://api.nuget.org/v3-flatcontainer/$($id.ToLower())/$version/$nupkgName"
        Write-Host "Downloading $id $version..."
        try {
            Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -ErrorAction Stop
        } catch {
            $err = $_.Exception.Message
            Write-Host ("Failed to download {0} : {1}" -f $url, $err) -ForegroundColor Red
            return
        }
    } else {
        Write-Host "$nupkgName already exists, skipping download."
    }

    # extract nuspec and parse dependencies
    try {
        $tempFolder = Join-Path $env:TEMP ([System.Guid]::NewGuid().ToString())
        New-Item -ItemType Directory -Path $tempFolder | Out-Null
        [System.IO.Compression.ZipFile]::ExtractToDirectory($dest, $tempFolder)
        $nuspec = Get-ChildItem -Path $tempFolder -Filter '*.nuspec' -Recurse | Select-Object -First 1
        if ($nuspec) {
            [xml]$nuspecXml = Get-Content $nuspec.FullName -Raw
            $depNodes = $nuspecXml.package.metadata.dependencies.SelectNodes('//dependency')
            if ($depNodes) {
                foreach ($d in $depNodes) {
                    $depId = $d.id
                    $depVersion = $d.version
                    if (-not $depVersion) { $depVersion = 'latest' }
                    Download-Package $depId $depVersion
                }
            }
        }
    } catch {
        $err = $_.Exception.Message
        Write-Host ("Warning: failed to parse nuspec for {0}: {1}" -f $id, $err) -ForegroundColor Yellow
    } finally {
        if (Test-Path $tempFolder) { Remove-Item -Path $tempFolder -Recurse -Force }
    }
}

# Start downloading
foreach ($p in $packages) { Download-Package $p 'latest' }

# create nuget.config in repo root
$repoRoot = 'C:\Basith\MultiSelectPCF'
$nugetConfigPath = Join-Path $repoRoot 'nuget.config'
$nugetXml = @"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="Local" value="$feed" />
  </packageSources>
</configuration>
"@
Set-Content -Path $nugetConfigPath -Value $nugetXml -Encoding UTF8
Write-Host "Wrote nuget.config to $nugetConfigPath"

# Run dotnet restore and build using this config
Push-Location 'C:\Basith\MultiSelectPCF\LookupMultiSelectSolution'
Write-Host 'Running dotnet restore --configfile ..\nuget.config' -ForegroundColor Cyan
dotnet restore --configfile ..\nuget.config
Write-Host 'Running dotnet build' -ForegroundColor Cyan
dotnet build
Pop-Location

Write-Host 'Done.'
