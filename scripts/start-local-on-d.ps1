# Start the frontend with project caches and temporary files on D:.
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtimeRoot = Join-Path $projectRoot '.tmp'
$tempPath = Join-Path $runtimeRoot 'temp'
$cachePath = Join-Path $projectRoot '.npm-cache'

foreach ($path in @($tempPath, $cachePath)) {
  New-Item -ItemType Directory -Path $path -Force | Out-Null
}

$env:TEMP = $tempPath
$env:TMP = $tempPath
$env:TMPDIR = $tempPath
$env:XDG_CACHE_HOME = Join-Path $runtimeRoot 'cache'
$env:npm_config_cache = $cachePath
$env:NEXT_TELEMETRY_DISABLED = '1'

Push-Location $projectRoot
try {
  Write-Warning 'Docker Desktop is not started by this script. Research data needs an existing Supabase service; CI verifies the database without using this computer.'
  & npm.cmd run dev
  if ($LASTEXITCODE -ne 0) { throw 'The frontend did not start.' }
} finally {
  Pop-Location
}
