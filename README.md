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
```

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
