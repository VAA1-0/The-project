from pathlib import Path
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class AudioTimingRegimeGuardTest(unittest.TestCase):
    def test_prosody_regenerates_when_transcript_fingerprint_changes(self):
        source = (PROJECT_ROOT / "api_server.py").read_text(encoding="utf-8")
        self.assertIn("audio_diarization_staleness", source)
        self.assertIn("transcript_fingerprint", source)
        self.assertIn("\"audio_diarization\" in created", source)

    def test_master_schema_rejects_speaker_turns_from_stale_audio_clock(self):
        source = (PROJECT_ROOT / "api_server.py").read_text(encoding="utf-8")
        self.assertIn("stale_rebuild_required", source)
        self.assertIn("valid_for_mature_master_schema", source)
        self.assertIn("can_seed_mature_speaker_claim", source)

    def test_audio_panel_does_not_retime_stale_sample_by_text_only_match(self):
        source = (
            PROJECT_ROOT
            / "src/frontend/app/V2components/components/panels/AudioPanel.tsx"
        ).read_text(encoding="utf-8")
        self.assertIn("targetHasValidSourceTiming", source)
        self.assertIn("sample.validForConfirmation !== false", source)
        self.assertIn("Audio row is quarantined", source)

    def test_speaker_label_is_not_imported_when_diarization_event_has_no_time_overlap(self):
        source = (
            PROJECT_ROOT
            / "src/frontend/app/V2components/components/panels/AudioPanel.tsx"
        ).read_text(encoding="utf-8")
        self.assertIn("overlapSeconds(event.start, event.end, row.start, row.end)", source)
        self.assertIn("bestTranscript?.overlap", source)

    def test_manual_audio_confirmation_requires_valid_source_media_overlap(self):
        source = (
            PROJECT_ROOT
            / "src/frontend/app/V2components/components/panels/AudioPanel.tsx"
        ).read_text(encoding="utf-8")
        self.assertIn("targetHasValidSourceTiming(target)", source)
        self.assertIn("Choose a known narrative agent", source)
        self.assertIn("visualAnchorForTarget", source)

    def test_audio_navigation_uses_canonical_start_end_not_source_start_source_end(self):
        source = (
            PROJECT_ROOT
            / "src/frontend/app/V2components/components/panels/AudioPanel.tsx"
        ).read_text(encoding="utf-8")
        self.assertIn("jumpTo(event.start", source)
        self.assertIn("start: event.start", source)
        self.assertNotIn("jumpTo(event.source_start", source)

    def test_transcript_panel_prefers_segments_over_coverage_timeline(self):
        source = (
            PROJECT_ROOT
            / "src/frontend/app/V2components/components/panels/SpeechToTextPanel.tsx"
        ).read_text(encoding="utf-8")
        self.assertIn(
            "analysisData?.transcript ?? analysisData?.transcriptTimeline ?? []",
            source,
        )
        self.assertIn(
            "analysis.transcript ?? analysis.transcriptTimeline ?? []",
            source,
        )


if __name__ == "__main__":
    unittest.main()
