import json
import hashlib
from pathlib import Path
import subprocess
import sys
import zipfile

from src.backend.analysis.data_book_publication import build_corpus_publication, build_video_publication


ROOT = Path(__file__).resolve().parents[1]
VERIFIER = ROOT / "scripts" / "independent_export_verifier.py"


def status(tmp_path: Path, analysis_id: str) -> dict:
    tmp_path.mkdir(parents=True, exist_ok=True)
    source = tmp_path / f"{analysis_id}.mp4"
    source.write_bytes(b"independent-source")
    transcript = tmp_path / "transcript.json"
    transcript.write_text(json.dumps({"segments": [{"start": 0, "end": 1, "text": "Evidence."}]}), encoding="utf-8")
    return {
        "analysis_id": analysis_id,
        "project_id": "independent-project",
        "status": "completed",
        "analysis_completed_at": "2026-11-06T12:00:00+00:00",
        "original_filename": source.name,
        "source_video_path": str(source),
        "source_media_metadata": {"duration": 1.0, "fps": 25.0},
        "output_files": {"transcript": str(transcript)},
    }


def run_verifier(path: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(VERIFIER), str(path)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


def test_standalone_process_verifies_video_and_emits_readable_summary(tmp_path: Path):
    built = build_video_publication(status(tmp_path, "video-1"), tmp_path / "publication")
    result = run_verifier(Path(built["archive_path"]))
    assert result.returncode == 0, result.stderr or result.stdout
    receipt = json.loads(result.stdout)
    assert receipt["status"] == "verified"
    assert receipt["datascene_runtime_required"] is False
    assert receipt["reader_summary"]["video_ids"] == ["video-1"]
    assert receipt["reader_summary"]["chapter_count"] > 0


def test_standalone_process_verifies_nested_corpus_editions(tmp_path: Path):
    built = build_corpus_publication(
        [status(tmp_path / "one", "video-1"), status(tmp_path / "two", "video-2")],
        tmp_path / "corpus",
        "independent-project",
    )
    result = run_verifier(Path(built["archive_path"]))
    assert result.returncode == 0, result.stderr or result.stdout
    receipt = json.loads(result.stdout)
    assert receipt["reader_summary"]["video_count"] == 2
    assert receipt["reader_summary"]["video_ids"] == ["video-1", "video-2"]


def test_standalone_process_rejects_tampered_payload(tmp_path: Path):
    built = build_video_publication(status(tmp_path, "video-1"), tmp_path / "publication")
    tampered = tmp_path / "tampered.zip"
    with zipfile.ZipFile(built["archive_path"]) as source, zipfile.ZipFile(tampered, "w") as target:
        for info in source.infolist():
            content = source.read(info.filename)
            if info.filename == "Scientific Report/Scientific Report.json":
                content += b"tampered"
            target.writestr(info, content)
    result = run_verifier(tampered)
    assert result.returncode == 1
    assert json.loads(result.stdout)["status"] == "rejected"
    assert "integrity mismatch" in result.stdout


def test_semantically_invalid_export_is_rejected_even_with_recomputed_hashes(tmp_path: Path):
    built = build_video_publication(status(tmp_path, "video-1"), tmp_path / "publication")
    invalid = tmp_path / "semantically-invalid.zip"
    with zipfile.ZipFile(built["archive_path"]) as source:
        files = {info.filename: source.read(info.filename) for info in source.infolist()}
    data_book = json.loads(files["Data Book/Data Book.json"])
    populated = next(chapter for chapter in data_book["chapters"] if chapter["content"]["records"])
    populated["content"]["records"][0].pop("unit")
    files["Data Book/Data Book.json"] = json.dumps(data_book, indent=2, ensure_ascii=False).encode()
    manifest = json.loads(files["Publication Manifest.json"])
    for entry in manifest["integrity"]["entries"]:
        if entry["archive_path"] == "Data Book/Data Book.json":
            entry["byte_length"] = len(files["Data Book/Data Book.json"])
            entry["checksum"] = "sha256:" + hashlib.sha256(files["Data Book/Data Book.json"]).hexdigest()
    canonical = json.dumps(manifest["integrity"]["entries"], ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    manifest["integrity"]["content_identity"] = "sha256:" + hashlib.sha256(canonical).hexdigest()
    files["Publication Manifest.json"] = json.dumps(manifest, indent=2, ensure_ascii=False).encode()
    with zipfile.ZipFile(invalid, "w") as target:
        for name, content in files.items():
            target.writestr(name, content)
    result = run_verifier(invalid)
    assert result.returncode == 1
    assert "record unit must be explicit" in result.stdout
