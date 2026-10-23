from pathlib import Path

from src.backend.utils.runtime_executables import configure_media_executables


def test_media_executables_are_resolved_from_the_active_runtime() -> None:
    result = configure_media_executables()

    assert Path(result["runtime_bin"]).is_dir()
    assert set(result["executables"]) == {"ffmpeg", "ffprobe"}
    assert result["ready"] is (not result["missing"])
