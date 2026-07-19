@echo off
setlocal
title VAA1 Launcher

set SCRIPT_DIR=%~dp0
set REPO_ROOT=%SCRIPT_DIR%..\

if not exist "%REPO_ROOT%run_vaa1.bat" (
  echo Root VAA1 launcher was not found at "%REPO_ROOT%run_vaa1.bat".
  exit /b 1
)

call "%REPO_ROOT%run_vaa1.bat" %*
exit /b %ERRORLEVEL%
