@echo off

echo Starting CVAT...
cd src\cvat\cvat-engine
docker compose up -d

echo Starting CVAT backend...
cd ..\backend
start cmd /c npm run dev

echo Starting backend API...
cd ..\..\..
docker run -d -p 8000:8000 video-analysis-app

echo Starting frontend...
cd src\frontend
start cmd /c npm run start:electron

exit /b 0
