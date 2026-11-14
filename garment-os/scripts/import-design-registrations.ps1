# Default: validate and preview. Pass -Apply to create only missing pending candidates.
param([switch]$Apply, [string[]]$Package)
$ErrorActionPreference = 'Stop'
$candidateArgs = @((Join-Path $PSScriptRoot 'import-design-registrations.py'))
foreach ($candidatePath in $Package) { $candidateArgs += @('--file', $candidatePath) }
if ($Apply) { $candidateArgs += '--apply' }
& python @candidateArgs
exit $LASTEXITCODE
