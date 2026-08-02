import json
import zipfile
from pathlib import Path

from src.backend.analysis.data_book_publication import FEATURES, build_corpus_publication, build_video_publication


def _status(tmp_path: Path, analysis_id: str = "analysis-001") -> dict:
    tmp_path.mkdir(parents=True, exist_ok=True)
    source = tmp_path / "Interview Sample.mp4"
    source.write_bytes(b"governed-video-source")
    transcript = tmp_path / "transcript.json"
    transcript.write_text(json.dumps({"segments": [{"start": 0, "end": 1, "text": "Test."}]}), encoding="utf-8")
    return {
        "analysis_id": analysis_id,
        "project_id": "Research Project",
        "status": "completed",
        "analysis_completed_at": "2026-08-02T12:00:00+00:00",
        "original_filename": source.name,
        "source_video_path": str(source),
        "source_media_metadata": {"duration": 1.0, "fps": 25.0},
        "output_files": {"transcript": str(transcript)},
    }


def test_video_publication_has_readable_complete_chapter_tree_and_is_repeatable(tmp_path: Path):
    status = _status(tmp_path)
    first = build_video_publication(status, tmp_path / "publication")
    second = build_video_publication(status, tmp_path / "publication")
    assert first["archive_checksum"] == second["archive_checksum"]
    with zipfile.ZipFile(first["archive_path"]) as archive:
        names = archive.namelist()
        assert "Data Book/Chapters/01 - Video and Source Media/Chapter.json" in names
        assert "Data Book/Chapters/02 - Transcript/Files/Transcript.json" in names
        assert len([name for name in names if name.endswith("/Chapter.json")]) == len(FEATURES)
        assert not any("video_source_media" in name or "statskit" in name for name in names)
        empty = json.loads(archive.read("Data Book/Chapters/03 - Parts of Speech/Chapter.json"))
        assert empty["content_state"] == "empty_confirmed"
        assert empty["empty_state"]["reason_code"] == "no_eligible_observations"


def test_corpus_preserves_browsable_video_publications(tmp_path: Path):
    statuses = [_status(tmp_path / "one", "analysis-001"), _status(tmp_path / "two", "analysis-002")]
    built = build_corpus_publication(statuses, tmp_path / "corpus", "Research Project")
    with zipfile.ZipFile(built["archive_path"]) as archive:
        names = archive.namelist()
        assert any(name.endswith("/Publication Manifest.json") for name in names)
        assert any(name.endswith("/Data Book/Data Book.json") for name in names)
        assert any(name.endswith("/Scientific Report/Scientific Report.json") for name in names)
    assert built["video_count"] == 2
