from pathlib import Path
from app.pipeline.face_analysis import analyze_face_image


def main():
    """
    Test runner for the normalized face-analysis wrapper.
    """
    image_path = Path("tmp/test_face.jpg")
    output_path = Path("tmp/test_face_result.json")
    csv_path = Path("tmp/test_face_result.csv")

    result = analyze_face_image(
        image_path=image_path,
        output_path=output_path,
        csv_path=csv_path,
        source_timestamp="still_image_test",
        style_mode="starfleet",
    )

    print("SUCCESS:", result["success"])
    print("ERROR:", result["error"])
    print("IMAGE PATH:", result["image_path"])
    print("SOURCE TIMESTAMP:", result["source_timestamp"])
    print("ANALYSIS TIMESTAMP:", result["analysis_timestamp"])
    print("CSV PATH:", result["csv_path"])
    print("WARNINGS:", result.get("warnings"))
    print("USER MESSAGE:", result.get("user_message"))
    print("STYLE MESSAGE:", result.get("style_message"))
    print("FACES:", result["faces"])

    if result["success"] and result["faces"]:
        face = result["faces"][0]
        region = face["region"]

        print("\nSUMMARY:")
        print("Face index:", face["face_index"])
        print("Age:", face["age"])
        print("Gender:", face["dominant_gender"])
        print("Emotion:", face["dominant_emotion"])
        print("Race:", face["dominant_race"])
        print("Confidence:", face["face_confidence"])
        print("Warnings:", face.get("warnings"))
        print("Confidence note:", face.get("confidence_note"))
        print("Region:", region)
        print("Gender scores:", face["gender_scores"])
        print("Emotion scores:", face["emotion_scores"])
        print("Race scores:", face["race_scores"])


if __name__ == "__main__":
    main()
