# README

This file explains how to create and activate a Python virtual environment and run `demo_video_analysis.py`.

## Prerequisites
- Python 3.8+ installed and on PATH
- A terminal opened at the project root:
    ```
    cd /c/Users/Amaan/Vaa/The-project
    ```

## Activate the virtual environment

- PowerShell (Windows):
```
virtenvir\Scripts\Activate.ps1
```

- Command Prompt (cmd.exe, Windows):
```
virtenvir\Scripts\activate
```

- Git Bash / WSL / macOS / Linux:
```
source virtenvir/bin/activate
```

After activation the prompt typically shows `(.venv)`.

## Run the demo script
Execute the demo script from the project root:
```
python demo_video_analysis.py
```
If the script accepts arguments (e.g., input file, output path), pass them:


## Deactivate the virtual environment
When finished:
```
deactivate
```

## Troubleshooting
- "python" not found: ensure correct Python version is installed and added to PATH.
- Permission errors in PowerShell: run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force` (Windows admin rights may be required).

That's it — activate `.venv`, then run `demo_video_analysis.py` and all the dependencies should be installed.

# vaa1_compatible — Development Environment Setup  
Python version: **3.10.19**

This guide explains how to recreate the `vaa1_compatible` Conda environment on any machine.  
Follow these steps if you need to reinstall the environment, move it to another computer, or share it with collaborators.

---

## 1. Install Miniconda or Anaconda
Download and install either:

- **Miniconda** (recommended)  
- **Anaconda**

You can confirm installation with:

```bash
conda --version
```


## 📘 Installing spaCy Language Model

The spaCy English model **cannot be installed through `environment.yml`**, because spaCy model packages are no longer distributed on PyPI.  
Therefore, after creating or updating the Conda environment, you must install the model manually.

Run the following command **after activating the environment**:

```
python -m spacy download en_core_web_sm
```

# Remember to npm install

If dependencies/packages are not recognized, run npm install in the folder. For example in `project root folder`, `src/frontend`, `cvat/backend`

___

# Commands for the whole project
NOTE: To run the whole project, you need all of this running at the same time. Currently backend does not communicate with frontend without cvat running.

### CVAT - engine and backend

**Engine**
1. Navigate to cvat engine from project root
```bash
cd src/cvat/src/cvat-engine
```
2. Run the following command and start cvat docker. Make sure that your docker desktop is up and running:
```bash
docker compose up -d
```

**Cvat backend**

1. Navigate to cvat backend folder from project root
```bash
cd src/cvat/backend
```
2. Run the backend:
```bash
npm run dev
```

___

### Proxy

1. Make sure that you have created `.env.local` file in `src/frontend` with the following line:
```bash
NEXT_PUBLIC_CVAT_BASE_URL=http://localhost:8091
```

2. Navigate to the root of the project.

3. Run the following command and replace the path with your own project path:
```bash
docker run --rm -p 8091:80 `
>>   -v C:/Users/Asus/VAA1_app/The-project/cvat-proxy.conf:/etc/nginx/conf.d/default.conf:ro `
>>   nginx:alpine
```
___
### Backend

1. Navigate to the root of the project

2. If you don't have a docker image container built yet, build it with the following command. Note that it might take a while if it's the first time:
```bash
docker-compose build
```

3. Run the docker image container with teh following command, replace the name with the actual name of your container:
```bash
docker run -p 8000:8000 the-project-video-analysis
```
___

### Frontend
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