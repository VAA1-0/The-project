import json
from app.pipeline.face_analysis import analyze_face_images_batch


def main():
    """
    Small test runner for batch face analysis across frame images.
    """
    frame_items = [
        {
            "image_path": "tmp/test_face.jpg",
            "source_timestamp": 0.0,
            "frame_index": 0,
        },
        {
            "image_path": "tmp/test_face.jpg",
            "source_timestamp": 1.0,
            "frame_index": 1,
        },
    ]

    result = analyze_face_images_batch(
        frame_items=frame_items,
        output_dir="tmp/face_batch",
        style_mode="starfleet",
    )

    summary = {
        "success": result.get("success"),
        "error": result.get("error"),
        "error_code": result.get("error_code"),
        "warnings": result.get("warnings"),
        "user_message": result.get("user_message"),
        "style_message": result.get("style_message"),
        "style_mode": result.get("style_mode"),
        "combined_csv_path": result.get("combined_csv_path"),
        "frame_count": len(result.get("frames", [])),
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
