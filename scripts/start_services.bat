@echo off
set BASEDIR=%~dp0..\

echo Starting VAA1 services...

REM --- CVAT engine ---
cd /d "%BASEDIR%src\cvat\cvat-engine" || exit /b 1
docker compose up -d

REM --- CVAT backend ---
cd /d "%BASEDIR%src\cvat\backend" || exit /b 1
start "CVAT Backend" cmd /c npm run dev

REM --- Backend API ---
cd /d "%BASEDIR%"
docker run -d -p 8000:8000 video-analysis-app

REM --- Frontend (Browser mode) ---
cd /d "%BASEDIR%src\frontend" || exit /b 1
start "Frontend" cmd /c npm run dev
timeout /t 5 >nul
start http://localhost:3000


exit /b 0
