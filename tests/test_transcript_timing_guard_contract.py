import unittest
import importlib.util
from pathlib import Path
import numpy as np

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
build_anchored_vad_timing_repair = transcript_timing_guard.build_anchored_vad_timing_repair
build_transcript_timing_authority = transcript_timing_guard.build_transcript_timing_authority
promote_automatic_transcript_timing = transcript_timing_guard.promote_automatic_transcript_timing
rebuild_transcript_from_quick_sweep_candidate = (
    transcript_timing_guard.rebuild_transcript_from_quick_sweep_candidate
)
transcript_timing_repair_needed = transcript_timing_guard.transcript_timing_repair_needed
transcript_timing_looks_scaffolded = transcript_timing_guard.transcript_timing_looks_scaffolded

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

    def test_scaffold_clock_can_be_repaired_with_opening_and_vad_anchor(self):
        transcript = {
            "segments": [
                {"start": 0.0, "end": 2.0, "text": "Why would I betray you?"},
                {"start": 2.0, "end": 4.0, "text": "We all have our secrets."},
                {"start": 4.0, "end": 6.0, "text": "We just didn't get to yours yet."},
                {
                    "start": 6.0,
                    "end": 8.0,
                    "text": "The world is arming faster than we can respond.",
                },
                {"start": 8.0, "end": 10.0, "text": "Where's 007?"},
                {"start": 10.0, "end": 12.0, "text": "I need a favor, brother."},
                {"start": 12.0, "end": 14.0, "text": "You're the only one I trust for this."},
                {"start": 14.0, "end": 16.0, "text": "Two."},
            ]
        }
        audio_diarization = {
            "status": "completed_measured",
            "vad_segments": [
                {"segment_id": "vad_0019", "start": 20.41, "end": 20.715},
                {"segment_id": "vad_0020", "start": 20.96, "end": 22.215},
                {"segment_id": "vad_0021", "start": 22.26, "end": 22.425},
            ],
        }

        repaired = build_anchored_vad_timing_repair(
            transcript,
            annotation_corrections={"transcript_clock_offset_seconds": 6.4},
            audio_diarization=audio_diarization,
        )

        self.assertTrue(transcript_timing_looks_scaffolded(transcript))
        self.assertIsNotNone(repaired)
        assert repaired is not None
        self.assertEqual(repaired["transcription_strategy"], "anchored_vad_timing_repair")
        self.assertEqual(repaired["segments"][0]["start"], 6.4)
        self.assertEqual(repaired["segments"][0]["timing_status"], "anchor_verified")
        self.assertEqual(repaired["segments"][3]["start"], 20.96)
        self.assertEqual(repaired["segments"][3]["end"], 22.215)
        self.assertEqual(repaired["segments"][3]["timing_status"], "vad_anchor_verified")
        self.assertEqual(repaired["segments"][4]["start"], 22.96)
        self.assertEqual(repaired["segments"][4]["end"], 24.96)
        self.assertEqual(
            repaired["segments"][4]["timing_status"],
            "inherited_after_vad_anchor",
        )
        self.assertFalse(repaired["segments"][4]["source_time_valid"])
        self.assertTrue(repaired["segments"][4]["candidate_time_valid"])
        self.assertEqual(
            repaired["timing_authority"]["drift_anchor_segment_id"],
            "vad_0020",
        )

    def test_chunked_fallback_timestamps_do_not_outrank_inherited_projection(self):
        transcript = {
            "transcription_strategy": "anchored_vad_timing_repair",
            "segments": [
                {
                    "start": 20.96,
                    "end": 22.215,
                    "text": "The world is arming faster than we can respond.",
                    "timing_status": "vad_anchor_verified",
                    "timing_authority": "anchored_vad_timing_repair",
                },
                {
                    "start": 22.96,
                    "end": 24.96,
                    "text": "Where's 007?",
                    "timing_status": "inherited_after_vad_anchor",
                    "timing_authority": "anchored_vad_timing_repair",
                    "timing_source": "audio_diarization.vad_segments + transcript scaffold delta",
                },
            ],
        }
        automatic_transcript = {
            "transcription_strategy": "chunked_fallback",
            "segments": [
                {"start": 26.0, "end": 28.0, "text": "Where's 007?"},
            ],
        }

        repaired = promote_automatic_transcript_timing(
            transcript,
            automatic_transcript,
            after_seconds=0.0,
        )

        self.assertIsNone(repaired)

    def test_quick_sweep_rebuild_keeps_text_but_quarantines_candidate_timing(self):
        transcript = {
            "segments": [
                {
                    "start": 6.4,
                    "end": 8.4,
                    "text": "Why would I betray you?",
                    "timing_status": "original_whisper_timecode",
                    "timing_authority": "original_whisper_timecode",
                    "timing_source": "openai_whisper.word_timestamps",
                    "source_time_valid": True,
                },
                {
                    "start": 20.96,
                    "end": 22.215,
                    "text": "The world is arming faster than we can respond.",
                    "timing_status": "original_whisper_timecode",
                    "timing_authority": "original_whisper_timecode",
                    "timing_source": "openai_whisper.word_timestamps",
                    "source_time_valid": True,
                },
                {
                    "start": 26.0,
                    "end": 28.0,
                    "text": "Where's 007?",
                    "timing_status": "automatic_transcript_timestamp",
                    "timing_authority": "quick_sweep_transcript",
                },
                {
                    "start": 30.96,
                    "end": 32.96,
                    "text": "The world's new dungeon, Commander Bond.",
                    "timing_status": "inherited_after_vad_anchor",
                    "timing_authority": "anchored_vad_timing_repair",
                },
                {
                    "start": 36.96,
                    "end": 38.96,
                    "text": "Two.",
                    "timing_status": "inherited_after_vad_anchor",
                    "timing_authority": "anchored_vad_timing_repair",
                },
            ],
        }
        automatic_transcript = {
            "transcription_strategy": "chunked_fallback",
            "segments": [
                {"start": 0.0, "end": 2.0, "text": "Why would I betray you?"},
                {
                    "start": 20.0,
                    "end": 24.0,
                    "text": "The world is arming faster than we can respond.",
                },
                {"start": 26.0, "end": 28.0, "text": "Where's 007?"},
                {"start": 28.0, "end": 30.0, "text": "I need a favor, brother."},
                {
                    "start": 30.0,
                    "end": 32.0,
                    "text": "You're the only one I trust for this.",
                },
                {
                    "start": 34.0,
                    "end": 36.0,
                    "text": "The world's new dawn command are born.",
                },
                {"start": 36.0, "end": 37.0, "text": "You were double-o."},
            ],
        }

        repaired = rebuild_transcript_from_quick_sweep_candidate(
            transcript,
            automatic_transcript,
        )

        self.assertIsNotNone(repaired)
        assert repaired is not None
        rows = repaired["segments"]
        preserved = rows[:2]
        self.assertEqual(
            [(row["start"], row["end"], row["text"]) for row in preserved],
            [
                (6.4, 8.4, "Why would I betray you?"),
                (20.96, 22.215, "The world is arming faster than we can respond."),
            ],
        )
        quarantined = rows[2:]
        self.assertEqual(
            [row["text"] for row in quarantined],
            [
                "Where's 007?",
                "I need a favor, brother.",
                "You're the only one I trust for this.",
                "The world's new dawn command are born.",
                "You were double-o.",
            ],
        )
        self.assertTrue(all(row["start"] is None and row["end"] is None for row in quarantined))
        self.assertTrue(
            all(row["timing_status"] == "needs_per_line_sync" for row in quarantined)
        )
        self.assertTrue(
            all(row["timing_authority"] == "text_only_no_source_timing" for row in quarantined)
        )
        self.assertTrue(all(row["source_time_valid"] is False for row in quarantined))
        self.assertEqual(quarantined[0]["candidate_start"], 26.0)
        self.assertEqual(quarantined[0]["candidate_end"], 28.0)
        self.assertNotIn(
            "inherited_after_vad_anchor",
            {row.get("timing_status") for row in rows},
        )
        self.assertEqual(
            repaired["timing_authority"]["vad_policy"],
            "auxiliary_only_not_transcript_clock",
        )
        self.assertFalse(repaired["timing_authority"]["source_time_operational"])

    def test_high_quality_transcript_with_word_timestamps_is_not_repaired(self):
        transcript = {
            "segments": [
                {
                    "start": 6.4,
                    "end": 8.4,
                    "text": "Why would I betray you?",
                    "words": [
                        {"word": "Why", "start": 6.4, "end": 6.6},
                        {"word": "would", "start": 6.6, "end": 6.8},
                        {"word": "I", "start": 6.8, "end": 6.9},
                        {"word": "betray", "start": 6.9, "end": 7.4},
                        {"word": "you?", "start": 7.4, "end": 7.8},
                    ],
                },
                {
                    "start": 8.4,
                    "end": 10.4,
                    "text": "We all have our secrets.",
                    "words": [{"word": "We", "start": 8.4, "end": 8.6}],
                },
            ]
        }
        report = build_transcript_quality_report(transcript)
        self.assertFalse(transcript_timing_repair_needed(transcript, report))

    def test_quick_sweep_rows_do_not_become_operational_whisper_timecode(self):
        transcript = {
            "language_info": {"source": "whisper"},
            "transcription_strategy": "quick_sweep_transcript_priority",
            "timing_authority": {
                "operational_authority": "original_whisper_timecode",
                "source_time_operational": True,
            },
            "segments": [
                {
                    "start": 6.4,
                    "end": 8.4,
                    "text": "Why would I betray you?",
                    "timing_status": "anchor_verified",
                    "timing_authority": "anchored_vad_timing_repair",
                },
                {
                    "start": 26.0,
                    "end": 28.0,
                    "text": "Where's 007?",
                    "timing_status": "automatic_transcript_timestamp",
                    "timing_authority": "quick_sweep_transcript",
                    "source_time_valid": True,
                },
            ],
        }

        authority = build_transcript_timing_authority(transcript)

        self.assertNotEqual(
            authority["operational_authority"],
            "original_whisper_timecode",
        )
        self.assertFalse(authority["source_time_operational"])
        self.assertEqual(authority["operational_whisper_rows"], 0)

    def test_scaffold_labelled_as_original_whisper_is_rejected(self):
        transcript = {
            "transcription_strategy": "original_whisper_timecode",
            "segments": [
                {
                    "start": 0.0,
                    "end": 2.0,
                    "text": "Why would I betray you?",
                    "timing_status": "original_whisper_timecode",
                    "timing_authority": "original_whisper_timecode",
                    "source_time_valid": True,
                },
                {
                    "start": 2.0,
                    "end": 4.0,
                    "text": "We all have our secrets.",
                    "timing_status": "original_whisper_timecode",
                    "timing_authority": "original_whisper_timecode",
                    "source_time_valid": True,
                },
                {
                    "start": 4.0,
                    "end": 6.0,
                    "text": "We just didn't get to yours yet.",
                    "timing_status": "original_whisper_timecode",
                    "timing_authority": "original_whisper_timecode",
                    "source_time_valid": True,
                },
                {
                    "start": 6.0,
                    "end": 8.0,
                    "text": "The world is arming faster than we can respond.",
                    "timing_status": "original_whisper_timecode",
                    "timing_authority": "original_whisper_timecode",
                    "source_time_valid": True,
                },
            ],
        }

        authority = build_transcript_timing_authority(transcript)

        self.assertEqual(authority["operational_authority"], "scaffold_candidate")
        self.assertEqual(authority["operational_whisper_rows"], 0)
        self.assertFalse(authority["source_time_operational"])

    def test_anchored_offset_manual_label_is_not_operational_manual_timecode(self):
        transcript = {
            "segments": [
                {
                    "start": 8.4,
                    "end": 10.4,
                    "text": "We all have our secrets.",
                    "timing_status": "anchored_offset",
                    "timing_authority": "manual_correction",
                    "timing_source": "manual opening anchor + transcript scaffold delta",
                    "source_time_valid": False,
                    "candidate_time_valid": True,
                },
            ],
        }

        authority = build_transcript_timing_authority(transcript)

        self.assertEqual(authority["operational_whisper_rows"], 0)
        self.assertFalse(authority["source_time_operational"])


if __name__ == "__main__":
    unittest.main()
