@echo off
set HEALTH_URL=http://localhost:8000/api/health

echo Checking backend health...

for /L %%i in (1,1,10) do (
  curl -s %HEALTH_URL% | findstr /C:"\"status\":\"healthy\"" >nul
  if not errorlevel 1 (
    echo Backend is healthy.
    exit /b 0
  )
  timeout /t 3 >nul
)

echo Backend health check failed.
exit /b 1
