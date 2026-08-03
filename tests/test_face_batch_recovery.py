from pathlib import Path

from app.pipeline import face_analysis


def test_face_batch_reuses_atomic_per_frame_checkpoint(tmp_path, monkeypatch):
    image = tmp_path / "frame.jpg"
    image.write_bytes(b"frame")
    calls = []

    def fake_analyze_face_image(**kwargs):
        calls.append(kwargs["image_path"])
        return {
            "success": True,
            "error": None,
            "analysis_timestamp": "2026-08-03T00:00:00+00:00",
            "csv_path": str(kwargs["csv_path"]),
            "faces": [],
            "warnings": [],
            "user_message": "complete",
            "style_message": "complete",
        }

    monkeypatch.setattr(face_analysis, "analyze_face_image", fake_analyze_face_image)
    items = [{"image_path": str(image), "source_timestamp": 12.0, "frame_index": 12}]

    first = face_analysis.analyze_face_images_batch(items, output_dir=tmp_path / "batch")
    second = face_analysis.analyze_face_images_batch(items, output_dir=tmp_path / "batch")

    assert len(calls) == 1
    assert first["resumed_frame_count"] == 0
    assert second["resumed_frame_count"] == 1
    assert list((tmp_path / "batch").glob("*.checkpoint.json"))
