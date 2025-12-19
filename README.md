# VAA1 — Video Analysis Automation 1.0

VAA1 is an open-source pipeline designed to automate the first stages of video analysis, transforming raw footage into structured, research-ready data. Its goal is simple: make video a practical, accessible, and analyzable resource for everyone.

## Why VAA1?

1. The explosion of video data
 More video is produced today than any human could ever watch. Researchers and creators need automated, scalable tools to keep up.

2. The rise of open science and FAIR principles
 Transparency, accessibility, and reproducibility are now required across global research communities.

3. A missing piece in the ecosystem
Despite the need, there is still no widely adopted, open, and affordable pipeline for video analysis. Most researchers rely on closed, fragmented, or costly tools.

## What VAA1 Provides
A unified open-source pipeline for:

- Metadata extraction
- Transcription
- Object and expression recognition
- Audio & visual intelligence
- Quantitative text features
- Research-ready structured outputs


## Deployment

**Prerequisites**
- Python 3.8+ installed and added to PATH
- Docker Desktop running
- Node.js and npm installed

### Install dependencies
From the project root:
```bash
pip install -e .
```
```bash
npm install
```

If dependencies are not recognized, also run npm install in:
`src/frontend` and `src/cvat/backend`



### Running the Project
Note: To run the whole project, you need all components running simultaneously. The backend does not communicate with the frontend without CVAT running.


#### CVAT - engine and backend

*Engine*
1. Navigate to cvat engine from project root
```bash
cd src/cvat/cvat-engine
```

2. Run the following command and start cvat docker. Make sure that your docker desktop is up and running:
```bash
docker compose up -d
```


*Cvat backend*

1. Navigate to cvat backend folder from project root
```bash
cd src/cvat/backend
```

2. Run the backend:
```bash
npm run dev
```

_________
#### Proxy

1. Make sure that you have created `.env.local` file in `src/frontend` with the following line:
```bash
NEXT_PUBLIC_CVAT_BASE_URL=http://localhost:8091
```


2. Navigate to the root of the project.

3. Run the following command and replace the path with your own project path:
```bash
docker run --rm -p 8091:80 -v D:/work/the-project/cvat-proxy.conf:/etc/nginx/conf.d/default.conf:ro nginx:alpine
```

_________
#### Backend

1. Navigate to the root of the project

2. If you don't have a docker image container built yet, build it with the following command. Note that it might take a while if it's the first time:
```bash
docker-compose build
```


3. Run the docker image container with the following command:
```bash
docker-compose up -d
```

__________

#### Frontend
1. Navigate to the frontend folder from the root of your project:
```bash
cd src/frontend
```

2. Run the frontend with the following command:
```bash
npm run dev
```

or for electron app
```bash
npm run start:electron
```

## User guide
To understand how the app user interface works, see USER_GUIDE.md.

## Licensing

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).

This is required due to the use of AGPL-licensed components (YOLOv8).
All source code for this application is publicly available in this repository.

Third-party dependencies are listed in THIRD_PARTY_LICENSES.md.
