import json
from pathlib import Path
from unittest.mock import patch

from api_server import prefer_authoritative_transcript_artifact


def _authoritative(text: str) -> dict:
    return {
        "transcription_strategy": "original_whisper_timecode",
        "segments": [
            {
                "start": 0.0,
                "end": 1.0,
                "text": text,
                "timing_authority": "original_whisper_timecode",
            }
        ],
    }


def test_authoritative_transcript_rejects_foreign_analysis(tmp_path: Path) -> None:
    own_id = "11111111-1111-1111-1111-111111111111"
    foreign_id = "22222222-2222-2222-2222-222222222222"
    transcripts = tmp_path / "transcripts"
    transcripts.mkdir()
    current = transcripts / f"{own_id}_transcript.json"
    own_raw = transcripts / f"{own_id}_transcript_raw_whisper.json"
    foreign_raw = transcripts / f"{foreign_id}_transcript_raw_whisper.json"
    current.write_text(json.dumps({"segments": []}), encoding="utf-8")
    own_raw.write_text(json.dumps(_authoritative("own")), encoding="utf-8")
    foreign_raw.write_text(json.dumps(_authoritative("foreign")), encoding="utf-8")
    record = tmp_path / "analysis_record.json"
    record.write_text(
        json.dumps(
            {
                "output_files": {
                    "raw_whisper_transcript": str(foreign_raw),
                    "transcript": str(foreign_raw),
                }
            }
        ),
        encoding="utf-8",
    )
    status = {
        "analysis_id": own_id,
        "output_files": {"transcript": str(current)},
        "results": {"audio_analysis": {}},
    }

    with patch("api_server.get_analysis_record_path", return_value=record), patch(
        "api_server.IMPORTED_WORK_DIR", tmp_path / "imports"
    ):
        assert prefer_authoritative_transcript_artifact(status) is True

    assert status["output_files"]["transcript"] == str(own_raw)
    assert status["output_files"]["raw_whisper_transcript"] == str(own_raw)
    assert status["results"]["audio_analysis"]["transcript"]["segments"][0]["text"] == "own"
