import io

import pytest

from src.backend.analysis.research_corpus_ingestion import (
    GIB,
    IngestionLimits,
    assess_corpus_capacity,
    copy_upload_bounded,
)


def test_eight_video_3_4_gb_corpus_is_admitted_with_working_reserve(tmp_path):
    sizes = [425_000_000] * 8
    result = assess_corpus_capacity(
        sizes,
        tmp_path,
        limits=IngestionLimits(
            max_file_bytes=6 * GIB,
            max_corpus_bytes=12 * GIB,
            working_reserve_bytes=8 * GIB,
        ),
        free_bytes=19 * GIB,
    )

    assert result["accepted"] is True
    assert result["file_count"] == 8
    assert result["total_bytes"] == 3_400_000_000


def test_capacity_rejects_batch_that_would_consume_working_reserve(tmp_path):
    result = assess_corpus_capacity(
        [2 * GIB, 2 * GIB],
        tmp_path,
        limits=IngestionLimits(
            max_file_bytes=6 * GIB,
            max_corpus_bytes=12 * GIB,
            working_reserve_bytes=8 * GIB,
        ),
        free_bytes=10 * GIB,
    )

    assert result["accepted"] is False
    assert "free-space reserve" in result["reasons"][0]


def test_bounded_copy_removes_partial_file_on_limit_failure(tmp_path):
    destination = tmp_path / "video.partial"

    with pytest.raises(ValueError, match="per-file"):
        copy_upload_bounded(io.BytesIO(b"123456"), destination, max_bytes=5, chunk_bytes=2)

    assert not destination.exists()


def test_bounded_copy_verifies_expected_size(tmp_path):
    destination = tmp_path / "video.mp4"

    with pytest.raises(ValueError, match="size mismatch"):
        copy_upload_bounded(
            io.BytesIO(b"1234"),
            destination,
            max_bytes=10,
            expected_bytes=5,
            chunk_bytes=2,
        )

    assert not destination.exists()
