import json
import subprocess
from pathlib import Path


def run_face_worker(image_path, output_path):
    """
    Calls the face worker inside the vaa1_face Conda environment
    and returns both the subprocess result and parsed JSON output.

    Parameters
    ----------
    image_path : str or Path
        Path to the input image.
    output_path : str or Path
        Path to the JSON output file.

    Returns
    -------
    dict
        Dictionary containing:
        - returncode
        - stdout
        - stderr
        - data (parsed JSON or None)
    """
    image_path = Path(image_path)
    output_path = Path(output_path)

    command = [
        "conda", "run", "-n", "vaa1_face",
        "python", "app/face_worker.py",
        str(image_path),
        str(output_path)
    ]

    result = subprocess.run(command, capture_output=True, text=True)

    data = None
    if output_path.exists():
        with open(output_path, "r") as f:
            data = json.load(f)

    return {
        "returncode": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "data": data
    }
