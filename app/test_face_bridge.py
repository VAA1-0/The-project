from pathlib import Path
from app.pipeline.face_bridge import run_face_worker


def main():
    """
    Small test runner for the face-analysis bridge.

    It sends one test image to the face worker and prints
    the return code, stdout, stderr, raw parsed JSON data,
    and a compact human-readable summary.
    """
    image_path = Path("tmp/test_face.jpg")
    output_path = Path("tmp/test_face_result.json")

    result = run_face_worker(image_path, output_path)

    print("Return code:", result["returncode"])
    print("STDOUT:")
    print(result["stdout"])
    print("STDERR:")
    print(result["stderr"])
    print("DATA:")
    print(result["data"])

    if result["data"]:
        first_face = result["data"][0]

        print("\nSUMMARY:")
        print("Estimated age:", first_face.get("age"))
        print("Dominant gender:", first_face.get("dominant_gender"))
        print("Dominant emotion:", first_face.get("dominant_emotion"))
        print("Dominant race:", first_face.get("dominant_race"))
        print("Face confidence:", first_face.get("face_confidence"))
        print("Face region:", first_face.get("region"))


if __name__ == "__main__":
    main()

