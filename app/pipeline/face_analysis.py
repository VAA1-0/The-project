from pathlib import Path
from app.pipeline.face_bridge import run_face_worker


def analyze_face_image(image_path, output_path="tmp/test_face_result.json"):
    """
    Run face analysis for one image and return a normalized summary.

    Parameters
    ----------
    image_path : str or Path
        Path to the input image.
    output_path : str or Path
        Path to the JSON output file written by the face worker.

    Returns
    -------
    dict
        Normalized face-analysis result.
    """
    result = run_face_worker(Path(image_path), Path(output_path))

    if result["returncode"] != 0:
        return {
            "success": False,
            "error": "Face worker failed",
            "stderr": result["stderr"],
            "stdout": result["stdout"],
            "faces": []
        }

    data = result.get("data") or []
    if not data:
        return {
            "success": False,
            "error": "No face data returned",
            "stderr": result["stderr"],
            "stdout": result["stdout"],
            "faces": []
        }

    normalized_faces = []
    for face in data:
        normalized_faces.append({
            "age": face.get("age"),
            "dominant_gender": face.get("dominant_gender"),
            "dominant_emotion": face.get("dominant_emotion"),
            "dominant_race": face.get("dominant_race"),
            "face_confidence": face.get("face_confidence"),
            "region": face.get("region")
        })

    return {
        "success": True,
        "error": None,
        "stderr": result["stderr"],
        "stdout": result["stdout"],
        "faces": normalized_faces
    }

