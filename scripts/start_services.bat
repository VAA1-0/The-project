@echo off


set BASEDIR=%~dp0..\
echo Starting services from %BASEDIR% >> "%BASEDIR%logs\vaa1-launch.log"

cd /d "%BASEDIR%src\cvat\cvat-engine" || exit /b 1
docker compose up -d

cd /d "%BASEDIR%src\cvat\backend" || exit /b 1
start cmd /c npm run dev

cd /d "%BASEDIR%"
docker run -d -p 8000:8000 video-analysis-app

cd /d "%BASEDIR%src\frontend" || exit /b 1
start cmd /c npm run start:electron

exit /b 0

