import sys
import json
from deepface import DeepFace


def analyze_face(image_path, output_path):
    """
    Runs DeepFace analysis on a single image and writes the results to JSON.

    Parameters
    ----------
    image_path : str
        Path to the image to analyze.
    output_path : str
        Path where the JSON result will be saved.
    """
    try:
        result = DeepFace.analyze(
            img_path=image_path,
            actions=["age", "gender", "emotion", "race"],
            enforce_detection=False
        )

        with open(output_path, "w") as f:
            json.dump(result, f, indent=2)

        print("Face analysis completed")

    except Exception as e:
        print(f"Face analysis failed: {e}")


if __name__ == "__main__":
    image_path = sys.argv[1]
    output_path = sys.argv[2]

    analyze_face(image_path, output_path) 


