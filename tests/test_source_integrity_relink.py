from pathlib import Path

import pytest

from src.backend.analysis.source_integrity import (
    SourceIntegrityError,
    assess_source_relink,
    build_missing_source_notice,
    capture_source_integrity,
    fingerprint_file,
)


def test_identical_copy_is_accepted_even_when_name_and_path_change(tmp_path: Path):
    original = tmp_path / "original.mp4"
    replacement = tmp_path / "renamed.mov"
    original.write_bytes(b"source-media-content")
    replacement.write_bytes(original.read_bytes())
    identity = capture_source_integrity(original, original_filename="research.mp4")

    result = assess_source_relink(identity, replacement)

    assert result["accepted"] is True
    assert result["reason"] == "exact_content_match"
    assert identity["original_filename"] == "research.mp4"


def test_same_name_with_different_content_is_rejected(tmp_path: Path):
    first = tmp_path / "first" / "source.mp4"
    second = tmp_path / "second" / "source.mp4"
    first.parent.mkdir()
    second.parent.mkdir()
    first.write_bytes(b"first")
    second.write_bytes(b"second")

    result = assess_source_relink(capture_source_integrity(first), second)

    assert result["accepted"] is False
    assert result["write_effect"] == "none_candidate_rejected"


def test_missing_legacy_identity_fails_closed(tmp_path: Path):
    candidate = tmp_path / "candidate.mp4"
    candidate.write_bytes(b"candidate")
    with pytest.raises(SourceIntegrityError, match="No governed source fingerprint"):
        assess_source_relink({}, candidate)


def test_fingerprint_is_stable_and_size_bound(tmp_path: Path):
    source = tmp_path / "source.mp4"
    source.write_bytes(b"123456")
    first = fingerprint_file(source)
    second = fingerprint_file(source)
    assert first == second
    assert first[0].startswith("sha256:")
    assert first[1] == 6


def test_missing_notice_preserves_name_location_id_and_identity(tmp_path: Path):
    missing_path = tmp_path / "offline" / "research.mov"
    notice = build_missing_source_notice(
        {
            "analysis_id": "analysis-17",
            "original_filename": "research.mov",
            "source_video_path": str(missing_path),
            "source_integrity": {
                "source_fingerprint": "sha256:expected",
                "size_bytes": 123,
            },
        }
    )
    assert notice["analysis_id"] == "analysis-17"
    assert notice["original_filename"] == "research.mov"
    assert notice["last_known_source_location"] == str(missing_path)
    assert notice["expected_source_fingerprint"] == "sha256:expected"


def test_available_source_does_not_raise_missing_notice(tmp_path: Path):
    source = tmp_path / "present.mp4"
    source.write_bytes(b"present")
    assert build_missing_source_notice({"source_video_path": str(source)}) is None
