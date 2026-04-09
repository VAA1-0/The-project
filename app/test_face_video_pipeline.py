import json
from pathlib import Path

from src.backend.analysis.pipeline_video_frames import FrameAnalysisPipeline


def main():
    """
    Small test runner for video -> sampled frames -> batch face analysis.
    """
    video_path = Path("tmp/test_face_video.mp4")
    output_dir = Path("tmp/test_face_video_pipeline")

    if not video_path.exists():
        raise FileNotFoundError(f"Test video not found: {video_path}")

    pipeline = FrameAnalysisPipeline(
        video_path=str(video_path),
        output_dir=str(output_dir),
        apply_face_anonymization=False,
        face_message_style="starfleet",
    )

    result = pipeline.analyze(save_video=False, display=False)

    summary = {
        "output_directory": result.get("output_directory"),
        "face_anonymization_enabled": result.get("face_anonymization_enabled"),
        "face_frame_count": len((result.get("face_results") or {}).get("frames", [])),
        "face_combined_csv": (result.get("face_results") or {}).get("combined_csv_path"),
        "face_user_message": (result.get("face_results") or {}).get("user_message"),
        "face_style_message": (result.get("face_results") or {}).get("style_message"),
        "first_face_frame_message": (((result.get("face_results") or {}).get("frames") or [{}])[0]).get("style_message"),
        "first_face_frame": ((result.get("face_results") or {}).get("frames") or [None])[0],
    }

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
