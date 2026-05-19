@echo off
title VAA1 Launcher
set LOGDIR=%~dp0logs
set LOGFILE=%LOGDIR%\vaa1-launch.log

if not exist "%LOGDIR%" mkdir "%LOGDIR%"

echo =============================== >> "%LOGFILE%"
echo VAA1 LAUNCH STARTED %DATE% %TIME% >> "%LOGFILE%"

set BASEDIR=%~dp0
cd /d "%BASEDIR%"

call "%BASEDIR%scripts\check_docker.bat" || goto :error
call "%BASEDIR%scripts\check_ports.bat" || goto :error
call "%BASEDIR%scripts\start_services.bat" || goto :error
:: call "%BASEDIR%scripts\check_backend_health.bat" || goto :error




echo VAA1 started successfully >> "%LOGFILE%"
echo.
echo VAA1 is running. You may now use the application.
echo VAA1 is starting in the background.
echo First launch may take 10-30 minutes depending on your system.
echo You can check progress in Docker Desktop.
exit /b 0

:error
echo.
echo ❌ VAA1 failed to start.
echo Please see logs\vaa1-launch.log
pause
exit /b 1
