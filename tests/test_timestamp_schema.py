import unittest

from src.backend.analysis.evidence_linker import link_transcript_to_trace, seconds_to_ms
from src.backend.analysis.timestamp_schema import (
    ActivityRecord,
    Anchor,
    EvidenceObject,
    MediaProfile,
    MediaRef,
    RegionBox,
    build_media_locator,
)


class TimestampSchemaTests(unittest.TestCase):
    def test_anchor_point_defaults_end_time_and_duration(self):
        anchor = Anchor(media_id="media_1", t_start_ms=1250)
        self.assertEqual(anchor.t_end_ms, 1250)
        self.assertEqual(anchor.duration_ms, 0)
        self.assertEqual(anchor.anchor_type, "point")

    def test_media_locator_builds_media_fragment(self):
        media_ref = MediaRef(
            media_id="media_1",
            source_uri="vaa1://media/media_1",
            source_filename="sample.mp4",
            media_profile=MediaProfile(duration_ms=15000, rate_mode="vfr"),
        )
        anchor = Anchor(
            media_id="media_1",
            t_start_ms=1200,
            t_end_ms=3600,
            anchor_type="interval",
        )
        locator = build_media_locator(media_ref, anchor)
        self.assertEqual(
            locator.to_media_fragment(),
            "vaa1://media/media_1#t=1.200,3.600",
        )

    def test_evidence_object_supports_correction_layer(self):
        evidence = EvidenceObject(
            object_type="annotation_correction",
            anchor_id="anchor_1",
            payload={
                "raw_label": "refrigerator",
                "corrected_label": "doorway",
            },
            confidence=0.95,
            created_by="analyst",
            raw_or_corrected="corrected",
            derived_from=["evidence_raw_1"],
        )
        self.assertEqual(evidence.raw_or_corrected, "corrected")
        self.assertEqual(evidence.payload["corrected_label"], "doorway")

    def test_activity_record_accepts_iso_timestamp(self):
        activity = ActivityRecord(
            activity_type="object_detection",
            used=["media_1"],
            generated=["evidence_1"],
            timestamp="2026-03-27T12:00:00+00:00",
            associated_agent="detector",
        )
        self.assertEqual(activity.associated_agent, "detector")

    def test_seconds_to_ms_handles_bad_values(self):
        self.assertEqual(seconds_to_ms(1.234), 1234)
        self.assertEqual(seconds_to_ms("2.5"), 2500)
        self.assertEqual(seconds_to_ms(None), 0)

    def test_link_transcript_to_trace_builds_utterances_and_activity(self):
        media_ref = MediaRef(
            media_id="media_1",
            source_uri="vaa1://media/media_1",
            source_filename="sample.mp4",
        )
        transcript = {
            "language": "fi",
            "segments": [
                {"start": 0.0, "end": 1.2, "text": "Ensimmainen lause."},
                {"start": 1.2, "end": 3.0, "text": "Toinen lause."},
            ],
        }
        envelope = link_transcript_to_trace(transcript, media_ref)
        self.assertEqual(envelope.media_ref.media_id, "media_1")
        self.assertEqual(len(envelope.anchors), 2)
        self.assertEqual(len(envelope.objects), 2)
        self.assertEqual(envelope.objects[0].object_type, "utterance")
        self.assertEqual(envelope.objects[0].payload["segment_index"], 0)
        self.assertEqual(envelope.objects[1].payload["text"], "Toinen lause.")
        self.assertEqual(envelope.activities[0].activity_type, "transcript_linking")
        self.assertEqual(len(envelope.activities[0].generated), 2)

    def test_region_box_standardizes_geometry_shape(self):
        region = RegionBox(x=10, y=20, w=30, h=40)
        self.assertEqual(region.model_dump(), {"x": 10.0, "y": 20.0, "w": 30.0, "h": 40.0})


if __name__ == "__main__":
    unittest.main()
