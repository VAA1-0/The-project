param(
  [switch]$Json
)

$ErrorActionPreference = "Continue"

function New-CheckResult {
  param(
    [string]$Name,
    [string]$Command,
    [string[]]$Arguments = @(),
    [string]$RequiredFor = "optional",
    [string]$Help = ""
  )

  $result = [ordered]@{
    name = $Name
    command = $Command
    required_for = $RequiredFor
    ok = $false
    version = ""
    path = ""
    help = $Help
  }

  $resolved = Get-Command $Command -ErrorAction SilentlyContinue
  if (-not $resolved) {
    $result.help = if ($Help) { $Help } else { "Install $Name or add it to PATH." }
    return [pscustomobject]$result
  }

  $result.path = $resolved.Source
  try {
    $output = & $Command @Arguments 2>&1 | Select-Object -First 3
    $result.version = ($output -join " ").Trim()
    $result.ok = $true
  } catch {
    $result.version = $_.Exception.Message
    $result.help = if ($Help) { $Help } else { "$Name was found but did not run cleanly." }
  }
  return [pscustomobject]$result
}

function Test-HttpEndpoint {
  param(
    [string]$Name,
    [string]$Url,
    [string]$RequiredFor = "running app"
  )

  $result = [ordered]@{
    name = $Name
    url = $Url
    required_for = $RequiredFor
    ok = $false
    status = ""
    help = "Start the related VAA1 service, then rerun this check."
  }

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
    $result.ok = $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
    $result.status = "HTTP $($response.StatusCode)"
  } catch {
    $result.status = $_.Exception.Message
  }
  return [pscustomobject]$result
}

function Test-PathPresence {
  param(
    [string]$Name,
    [string]$Path,
    [string]$RequiredFor = "repository hygiene",
    [bool]$Expected = $true,
    [string]$Help = ""
  )

  $exists = Test-Path $Path
  return [pscustomobject][ordered]@{
    name = $Name
    path = $Path
    required_for = $RequiredFor
    ok = if ($Expected) { $exists } else { -not $exists }
    status = if ($exists) { "present" } else { "missing" }
    help = $Help
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$checks = @()
$checks += New-CheckResult -Name "Git" -Command "git" -Arguments @("--version") -RequiredFor "clone/update"
$checks += New-CheckResult -Name "Conda" -Command "conda" -Arguments @("--version") -RequiredFor "Python environment" -Help "Install Miniconda, then open a new Anaconda Prompt or PowerShell."
$checks += New-CheckResult -Name "Python" -Command "python" -Arguments @("--version") -RequiredFor "backend"
$checks += New-CheckResult -Name "pip" -Command "python" -Arguments @("-m", "pip", "--version") -RequiredFor "Python dependencies"
$checks += New-CheckResult -Name "Node.js" -Command "node" -Arguments @("--version") -RequiredFor "frontend"
$checks += New-CheckResult -Name "npm" -Command "npm" -Arguments @("--version") -RequiredFor "frontend"
$checks += New-CheckResult -Name "Docker" -Command "docker" -Arguments @("--version") -RequiredFor "CVAT / optional containers"
$checks += New-CheckResult -Name "Docker Compose" -Command "docker" -Arguments @("compose", "version") -RequiredFor "CVAT / optional containers"
$checks += New-CheckResult -Name "FFmpeg" -Command "ffmpeg" -Arguments @("-version") -RequiredFor "video/audio workflows" -Help "Install FFmpeg and ensure ffmpeg.exe is on PATH, or configure the team-provided binary."
$checks += New-CheckResult -Name "FFprobe" -Command "ffprobe" -Arguments @("-version") -RequiredFor "video/audio metadata" -Help "Install FFmpeg and ensure ffprobe.exe is on PATH."

$repoChecks = @()
$repoChecks += Test-PathPresence -Name "Local virtual environment" -Path (Join-Path $repoRoot ".venv") -RequiredFor "plain Python setup" -Help "Run .\scripts\windows_first_run.ps1 or use conda activate vaa1_compatible."
$repoChecks += Test-PathPresence -Name "requirements.txt" -Path (Join-Path $repoRoot "requirements.txt") -RequiredFor "plain Python setup" -Help "If absent, use environment.yml / conda setup."
$repoChecks += Test-PathPresence -Name "environment.yml" -Path (Join-Path $repoRoot "environment.yml") -RequiredFor "conda setup" -Help "Ask the VAA1 team for the current environment file."
$repoChecks += Test-PathPresence -Name "Frontend package.json" -Path (Join-Path $repoRoot "src\frontend\package.json") -RequiredFor "frontend"
$repoChecks += Test-PathPresence -Name ".env.example" -Path (Join-Path $repoRoot ".env.example") -RequiredFor "safe local configuration" -Help "The repository should include placeholders, not real secrets."
$repoChecks += Test-PathPresence -Name ".env should not be committed/shared" -Path (Join-Path $repoRoot ".env") -RequiredFor "secret hygiene" -Expected $false -Help "If present, keep it local and never commit it."

$heavyLocalChecks = @()
foreach ($localPath in @(".venv", "venv", "node_modules", "src\frontend\node_modules", "data", "datasets", "uploads", "outputs", "media", "videos", "models", "weights", "cvat_data", "docker-volumes")) {
  $heavyLocalChecks += Test-PathPresence -Name "Local/heavy path: $localPath" -Path (Join-Path $repoRoot $localPath) -RequiredFor "git cleanliness" -Expected $false -Help "This may be valid locally, but it should not be committed."
}

$pythonOptionalChecks = @()
foreach ($moduleName in @("fastapi", "uvicorn", "cv2", "torch", "ultralytics", "whisper")) {
  $pythonOptionalChecks += [pscustomobject]@{
    name = "Python module: $moduleName"
    module = $moduleName
    required_for = if ($moduleName -eq "ultralytics") { "optional YOLO detector" } elseif ($moduleName -eq "whisper") { "optional transcription" } else { "backend/core analysis" }
    ok = $false
    status = ""
    help = "Activate the VAA1 conda environment and install project requirements."
  }
  try {
    $probe = & python -c "import $moduleName; print('ok')" 2>&1
    $pythonOptionalChecks[-1].ok = ($LASTEXITCODE -eq 0)
    $pythonOptionalChecks[-1].status = ($probe -join " ").Trim()
  } catch {
    $pythonOptionalChecks[-1].status = $_.Exception.Message
  }
}

$torchCudaCheck = [pscustomobject]@{
  name = "PyTorch CUDA"
  ok = $false
  status = ""
  help = "CUDA is optional. CPU-only is acceptable unless GPU acceleration is required."
}
try {
  $torchProbe = & python -c "import torch; print('torch', torch.__version__); print('cuda_available', torch.cuda.is_available())" 2>&1
  $torchCudaCheck.ok = ($LASTEXITCODE -eq 0)
  $torchCudaCheck.status = ($torchProbe -join " ").Trim()
} catch {
  $torchCudaCheck.status = $_.Exception.Message
}

$serviceChecks = @()
$serviceChecks += Test-HttpEndpoint -Name "Backend health" -Url "http://127.0.0.1:8000/api/health" -RequiredFor "backend running"
$serviceChecks += Test-HttpEndpoint -Name "Frontend dashboard" -Url "http://127.0.0.1:3001/dashboard" -RequiredFor "frontend running"

$summary = [ordered]@{
  generated_at = (Get-Date).ToString("s")
  repo_root = "$repoRoot"
  checks = $checks
  repository = $repoChecks
  heavy_local_paths = $heavyLocalChecks
  python_modules = $pythonOptionalChecks
  torch_cuda = $torchCudaCheck
  services = $serviceChecks
  notes = @(
    "YOLOv8/Ultralytics and Whisper are optional capability checks, not mandatory first-day blockers.",
    "Docker is optional for core backend/frontend startup, but needed for CVAT/container workflows.",
    "If FFmpeg is missing, video/audio workflows may be disabled or degraded until configured."
  )
}

if ($Json) {
  $summary | ConvertTo-Json -Depth 5
  exit 0
}

Write-Host ""
Write-Host "VAA1 Windows Development Environment Check" -ForegroundColor Cyan
Write-Host "Repo: $repoRoot"
Write-Host ""

foreach ($item in $checks) {
  $status = if ($item.ok) { "OK" } else { "MISSING" }
  $color = if ($item.ok) { "Green" } else { "Yellow" }
  Write-Host ("[{0}] {1} - {2}" -f $status, $item.name, $item.required_for) -ForegroundColor $color
  if ($item.version) { Write-Host "    $($item.version)" }
  if (-not $item.ok -and $item.help) { Write-Host "    $($item.help)" -ForegroundColor DarkYellow }
}

Write-Host ""
Write-Host "Repository setup and hygiene" -ForegroundColor Cyan
foreach ($item in $repoChecks) {
  $status = if ($item.ok) { "OK" } else { "CHECK" }
  $color = if ($item.ok) { "Green" } else { "Yellow" }
  Write-Host ("[{0}] {1} - {2}: {3}" -f $status, $item.name, $item.required_for, $item.status) -ForegroundColor $color
  if (-not $item.ok -and $item.help) { Write-Host "    $($item.help)" -ForegroundColor DarkYellow }
}

Write-Host ""
Write-Host "Local/heavy path warnings" -ForegroundColor Cyan
foreach ($item in $heavyLocalChecks) {
  if (-not $item.ok) {
    Write-Host ("[WARN] {0}: {1}" -f $item.name, $item.status) -ForegroundColor Yellow
    Write-Host "    $($item.help)" -ForegroundColor DarkYellow
  }
}

Write-Host ""
Write-Host "Python module probes" -ForegroundColor Cyan
foreach ($item in $pythonOptionalChecks) {
  $status = if ($item.ok) { "OK" } else { "CHECK" }
  $color = if ($item.ok) { "Green" } else { "Yellow" }
  Write-Host ("[{0}] {1} - {2}" -f $status, $item.name, $item.required_for) -ForegroundColor $color
  if ($item.status) { Write-Host "    $($item.status)" }
}

Write-Host ""
Write-Host "PyTorch CUDA probe" -ForegroundColor Cyan
$torchColor = if ($torchCudaCheck.ok) { "Green" } else { "Yellow" }
$torchStatus = if ($torchCudaCheck.ok) { "OK" } else { "CHECK" }
Write-Host ("[{0}] {1}" -f $torchStatus, $torchCudaCheck.name) -ForegroundColor $torchColor
if ($torchCudaCheck.status) { Write-Host "    $($torchCudaCheck.status)" }
if (-not $torchCudaCheck.ok) { Write-Host "    $($torchCudaCheck.help)" -ForegroundColor DarkYellow }

Write-Host ""
Write-Host "Running service probes" -ForegroundColor Cyan
foreach ($item in $serviceChecks) {
  $status = if ($item.ok) { "OK" } else { "NOT RUNNING" }
  $color = if ($item.ok) { "Green" } else { "Yellow" }
  Write-Host ("[{0}] {1} - {2}" -f $status, $item.name, $item.url) -ForegroundColor $color
  if ($item.status) { Write-Host "    $($item.status)" }
}

Write-Host ""
Write-Host "Next step:" -ForegroundColor Cyan
Write-Host "  If Git, Conda/Python, Node/npm, and FFmpeg look OK, run:"
Write-Host "  .\scripts\windows_first_run.ps1"
Write-Host ""
