from pathlib import Path
from app.pipeline.face_analysis import analyze_face_image


def main():
    result = analyze_face_image(
        image_path=Path("tmp/test_face.jpg"),
        output_path=Path("tmp/test_face_result.json")
    )

    print("SUCCESS:", result["success"])
    print("ERROR:", result["error"])
    print("FACES:", result["faces"])


if __name__ == "__main__":
    main()
