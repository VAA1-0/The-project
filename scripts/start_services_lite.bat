@echo off
set BASEDIR=%~dp0..\

echo Starting VAA1 (Lite mode — no CVAT)...

REM --- Backend API ---
cd /d "%BASEDIR%"
docker run -d -p 8000:8000 video-analysis-app

REM --- Frontend (Browser mode) ---
cd /d "%BASEDIR%src\frontend" || exit /b 1
start "VAA1 Frontend" cmd /c npm run dev

REM --- Open dashboard when ready ---
timeout /t 5 >nul
start http://localhost:3000/dashboard

exit /b 0
