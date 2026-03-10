@echo off
docker info >nul 2>&1
if errorlevel 1 (
  echo Docker is not running.
  echo Please start Docker Desktop.
  exit /b 1
)
exit /b 0
