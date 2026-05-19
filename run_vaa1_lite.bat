@echo off
title VAA1 Lite Launcher
set BASEDIR=%~dp0
set LOGDIR=%BASEDIR%logs
set LOGFILE=%LOGDIR%\vaa1-lite.log

if not exist "%LOGDIR%" mkdir "%LOGDIR%"

echo =============================== >> "%LOGFILE%"
echo VAA1 LITE START %DATE% %TIME% >> "%LOGFILE%"

call "%BASEDIR%scripts\check_docker.bat" || goto :error
call "%BASEDIR%scripts\check_ports.bat" || goto :error

call "%BASEDIR%scripts\start_services_lite.bat" || goto :error

echo VAA1 Lite started successfully >> "%LOGFILE%"
echo.
echo VAA1 Lite is starting in the background.
echo Backend and frontend may take several minutes on first run.
echo See logs\vaa1-lite.log for details.
exit /b 0

:error
echo.
echo ❌ VAA1 Lite failed to start.
echo Please see logs\vaa1-lite.log
pause
exit /b 1
