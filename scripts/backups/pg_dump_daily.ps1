param(
  [string]$DatabaseUrl = $env:SUPABASE_DB_URL,
  [string]$BackupDir = "$PSScriptRoot\output",
  [int]$RetentionDays = 14
)

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  throw "SUPABASE_DB_URL is required (set env var or pass -DatabaseUrl)."
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dumpFile = Join-Path $BackupDir "truckinfox_$timestamp.dump"

pg_dump --format=custom --no-owner --no-privileges --file "$dumpFile" "$DatabaseUrl"
if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed with exit code $LASTEXITCODE"
}

Get-ChildItem -Path $BackupDir -Filter "truckinfox_*.dump" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } |
  Remove-Item -Force

Write-Host "Backup created: $dumpFile"
Write-Host "Retention cleanup done: files older than $RetentionDays days removed"
