@echo off
title VAA1 Launcher
set LOGDIR=%~dp0logs
set LOGFILE=%LOGDIR%\vaa1-launch.log

if not exist "%LOGDIR%" mkdir "%LOGDIR%"

echo BASEDIR=%BASEDIR% >> "%LOGFILE%"
echo =============================== >> "%LOGFILE%"
echo VAA1 LAUNCH STARTED %DATE% %TIME% >> "%LOGFILE%"

call scripts\check_docker.bat || goto :error
call scripts\check_ports.bat || goto :error
call scripts\check_backend_health.bat || goto :error
call scripts\start_services.bat || goto :error



echo VAA1 started successfully >> "%LOGFILE%"
echo.
echo VAA1 is running. You may now use the application.
exit /b 0

:error
echo.
echo ❌ VAA1 failed to start.
echo Please see logs\vaa1-launch.log
pause
exit /b 1
