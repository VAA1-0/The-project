@echo off
set HEALTH_URL=http://localhost:8000/api/health

echo Checking backend health (non-blocking)...

curl -s %HEALTH_URL% | findstr /C:"\"status\":\"healthy\"" >nul
if not errorlevel 1 (
  echo Backend is healthy >> "%~dp0..\logs\vaa1-launch.log"
) else (
  echo Backend not ready yet >> "%~dp0..\logs\vaa1-launch.log"
)

exit /b 0
