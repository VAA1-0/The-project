param(
  [switch]$SkipPythonInstall,
  [switch]$SkipFrontendInstall,
  [int]$BackendPort = 8000,
  [int]$FrontendPort = 3001
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$preferredFrontendRoot = Join-Path $repoRoot "src\frontend"
$venvRoot = Join-Path $repoRoot ".venv"
$venvPython = Join-Path $venvRoot "Scripts\python.exe"

Set-Location $repoRoot

function Require-Command {
  param(
    [string]$Command,
    [string]$Message
  )
  if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
    throw $Message
  }
}

function Find-FrontendRoot {
  if (Test-Path (Join-Path $preferredFrontendRoot "package.json")) {
    return $preferredFrontendRoot
  }

  $package = Get-ChildItem -Path $repoRoot -Filter "package.json" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\src\\cvat\\" } |
    Select-Object -First 1

  if ($package) {
    return $package.DirectoryName
  }

  return $null
}

Write-Host ""
Write-Host "VAA1 Windows First-Run Setup Helper" -ForegroundColor Cyan
Write-Host "Repo: $repoRoot"
Write-Host ""

if (-not (Test-Path (Join-Path $repoRoot "api_server.py"))) {
  throw "api_server.py was not found. Run this script from the VAA1 repository root."
}

Require-Command "python" "Python was not found. Install Python or activate the VAA1 conda environment first."
Require-Command "node" "Node.js was not found. Install Node.js LTS and reopen PowerShell."
Require-Command "npm" "npm was not found. Install Node.js LTS and reopen PowerShell."

if (-not $SkipPythonInstall) {
  if (-not (Test-Path $venvPython)) {
    Write-Host "Creating local Python virtual environment: .venv" -ForegroundColor Cyan
    python -m venv .venv
  } else {
    Write-Host "Local Python virtual environment already exists: .venv" -ForegroundColor Green
  }

  Write-Host "Upgrading pip in .venv..." -ForegroundColor Cyan
  & $venvPython -m pip install --upgrade pip

  if (Test-Path (Join-Path $repoRoot "requirements.txt")) {
    Write-Host "Installing Python requirements from requirements.txt..." -ForegroundColor Cyan
    & $venvPython -m pip install -r requirements.txt
  } elseif (Test-Path (Join-Path $repoRoot "environment.yml")) {
    Write-Host "No requirements.txt found. environment.yml exists; use conda env create -f environment.yml instead." -ForegroundColor Yellow
  } else {
    Write-Host "No requirements.txt or environment.yml found. Python dependency install skipped." -ForegroundColor Yellow
  }
}

$frontendRoot = Find-FrontendRoot
if (-not $frontendRoot) {
  throw "No frontend package.json was found outside node_modules/CVAT paths."
}

if (-not $SkipFrontendInstall) {
  Write-Host "Installing frontend dependencies in $frontendRoot..." -ForegroundColor Cyan
  Push-Location $frontendRoot
  npm install
  Pop-Location
}

Write-Host ""
Write-Host "Setup helper finished. It did not start Docker or download model weights." -ForegroundColor Green
Write-Host ""
Write-Host "Recommended startup commands:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend (Windows plain-Python development only):"
Write-Host "  cd `"$repoRoot`""
Write-Host "  .\.venv\Scripts\Activate.ps1"
Write-Host "  python api_server.py"
Write-Host ""
Write-Host "Alternative backend if using the Windows conda environment:"
Write-Host "  conda activate vaa1_compatible"
Write-Host "  python api_server.py"
Write-Host ""
Write-Host "Note: On Mac, .venv is not the Datascene/VAA1 runtime authority. Use:"
Write-Host "  bash scripts/start_vaa1_macos.sh"
Write-Host ""
Write-Host "Frontend:"
Write-Host "  cd `"$frontendRoot`""
Write-Host "  `$env:NEXT_PUBLIC_API_URL=`"http://127.0.0.1:$BackendPort`""
Write-Host "  npm run dev -- --hostname 127.0.0.1 --port $FrontendPort"
Write-Host ""
Write-Host "Then open:"
Write-Host "  http://127.0.0.1:$FrontendPort/dashboard"
Write-Host ""
Write-Host "After setup, run:"
Write-Host "  .\scripts\windows_env_check.ps1"
Write-Host ""
