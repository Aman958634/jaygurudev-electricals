param(
  [ValidateSet('status', 'stop')]
  [string]$Action = 'status'
)

$backendDirectory = Split-Path -Parent $PSScriptRoot
$expectedServerPath = [System.IO.Path]::GetFullPath((Join-Path $backendDirectory 'server.js'))
$pidFilePath = Join-Path $backendDirectory '.backend-5000.pid'
$port = 5000
$listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)

if ($listeners.Count -eq 0) {
  Write-Output "No process is listening on port $port."
  if (Test-Path $pidFilePath) {
    try {
      $staleMarker = Get-Content $pidFilePath -Raw | ConvertFrom-Json
      $markedProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($staleMarker.pid)" -ErrorAction SilentlyContinue
      if (-not $markedProcess) {
        Remove-Item -LiteralPath $pidFilePath -ErrorAction Stop
        Write-Output 'Removed the stale backend PID marker; no process was stopped.'
      }
    } catch {
      Write-Warning "Could not safely validate the backend PID marker: $($_.Exception.Message)"
    }
  }
  exit 0
}

$marker = $null
if (Test-Path $pidFilePath) {
  try {
    $marker = Get-Content $pidFilePath -Raw | ConvertFrom-Json
  } catch {
    Write-Warning 'The backend PID marker is invalid; no process will be stopped.'
  }
}

$listenerPids = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
$verifiedProcesses = @()
foreach ($listenerPid in $listenerPids) {
  $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $listenerPid" -ErrorAction SilentlyContinue
  $isProjectProcess = $false

  if (
    $marker -and
    [int]$marker.pid -eq [int]$listenerPid -and
    [System.IO.Path]::GetFullPath([string]$marker.serverPath) -eq $expectedServerPath -and
    $processInfo.Name -match '^node(\.exe)?$' -and
    $processInfo.CommandLine -match 'server\.js'
  ) {
    $creationTime = [datetime]$processInfo.CreationDate
    $markedStartTime = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$marker.startedAt).LocalDateTime
    $startDifference = [math]::Abs(($creationTime - $markedStartTime).TotalSeconds)
    $isProjectProcess = $startDifference -lt 15
  }

  $verifiedProcesses += [pscustomobject]@{
    PID = [int]$listenerPid
    Name = $processInfo.Name
    CommandLine = $processInfo.CommandLine
    IsThisProject = $isProjectProcess
  }
}

foreach ($processInfo in $verifiedProcesses) {
  $ownership = if ($processInfo.IsThisProject) { 'verified Jay GuruDev backend' } else { 'not verified as this project' }
  Write-Output "Port ${port}: PID $($processInfo.PID) ($ownership)."
  if ($processInfo.CommandLine) {
    Write-Output "Command: $($processInfo.CommandLine)"
  }
}

if ($Action -eq 'status') {
  if ($verifiedProcesses.IsThisProject -contains $true) {
    Write-Output "Reuse the running backend at http://localhost:$port."
  } else {
    Write-Warning 'A listener owns the expected port, but it is not verified as this project. No process was stopped.'
  }
  exit 0
}

$projectProcesses = @($verifiedProcesses | Where-Object { $_.IsThisProject })
if ($projectProcesses.Count -ne 1 -or $listenerPids.Count -ne 1) {
  Write-Error 'Refusing to stop the listener: exactly one process must be verified as this project on port 5000.'
  exit 1
}

$projectPid = $projectProcesses[0].PID
Stop-Process -Id $projectPid -ErrorAction Stop
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  if (-not (Get-Process -Id $projectPid -ErrorAction SilentlyContinue)) {
    break
  }
  Start-Sleep -Milliseconds 200
}

if (Get-Process -Id $projectPid -ErrorAction SilentlyContinue) {
  Write-Error "Project backend PID $projectPid did not stop."
  exit 1
}

if (Test-Path $pidFilePath) {
  try {
    $remainingMarker = Get-Content $pidFilePath -Raw | ConvertFrom-Json
    if ([int]$remainingMarker.pid -eq $projectPid) {
      Remove-Item -LiteralPath $pidFilePath -ErrorAction Stop
    }
  } catch {
    Write-Warning "Backend stopped, but its PID marker could not be cleaned up: $($_.Exception.Message)"
  }
}

Write-Output "Stopped only the verified Jay GuruDev backend process (PID $projectPid)."
