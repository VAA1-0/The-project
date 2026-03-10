@echo off
set PORTS=8000 3000 8091

for %%P in (%PORTS%) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr :%%P') do (
    tasklist /FI "PID eq %%A" | findstr node.exe docker.exe >nul
    if not errorlevel 1 (
      taskkill /PID %%A /F >nul
    )
  )
)

exit /b 0
