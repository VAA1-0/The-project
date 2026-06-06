import unittest
import importlib.util
from pathlib import Path

MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "backend"
    / "analysis"
    / "transcript_timing_guard.py"
)
SPEC = importlib.util.spec_from_file_location("transcript_timing_guard", MODULE_PATH)
transcript_timing_guard = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(transcript_timing_guard)

build_transcript_quality_report = transcript_timing_guard.build_transcript_quality_report
transcript_timing_repair_needed = transcript_timing_guard.transcript_timing_repair_needed


class TranscriptTimingGuardContractTest(unittest.TestCase):
    def test_degraded_transcript_coverage_requires_timing_repair(self):
        transcript = {
            "segments": [
                {"start": 0.0, "end": 2.0, "text": "Why would I betray you?"},
                {"start": 2.0, "end": 4.0, "text": "We all have our secrets."},
                {
                    "start": 120.0,
                    "end": 124.0,
                    "text": "History isn't kind to men who play God.",
                },
            ]
        }

        report = build_transcript_quality_report(
            transcript,
            media_duration_seconds=155.104535,
            audio_duration_seconds=155.062875,
        )

        self.assertEqual(report["status"], "degraded")
        self.assertEqual(report["coverage_ratio"], 0.7995)
        self.assertEqual(report["trailing_uncovered_seconds"], 31.105)
        self.assertIn("trailing_coverage_shortfall", report["reasons"])
        self.assertTrue(transcript_timing_repair_needed(transcript, report))

    def test_repaired_chunked_transcript_is_not_repaired_again(self):
        transcript = {
            "transcription_strategy": "chunked_fallback",
            "segments": [
                {"start": 0.4, "end": 2.2, "text": "Why would I betray you?"},
                {"start": 153.0, "end": 155.0, "text": "Final utterance."},
            ],
        }

        report = build_transcript_quality_report(
            transcript,
            media_duration_seconds=155.104535,
            audio_duration_seconds=155.062875,
        )

        self.assertEqual(report["status"], "ok")
        self.assertFalse(transcript_timing_repair_needed(transcript, report))


if __name__ == "__main__":
    unittest.main()
