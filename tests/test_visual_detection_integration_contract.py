import unittest
from pathlib import Path

from src.backend.analysis.evidence_proliferation_matcher import collect_matchable_evidence


class VisualDetectionIntegrationContractTests(unittest.TestCase):
    def setUp(self):
        self.shot_boundaries = {
            "schema": "vaa1.shot_boundary_intervals.v1",
            "method": "PySceneDetect ContentDetector",
            "true_boundary_intervals": True,
            "intervals": [{
                "shot_id": "shot:0001",
                "start": 1.0,
                "end": 2.5,
                "review_state": "available",
            }],
        }
        self.spatial_tone = {
            "schema": "vaa1.spatial_tone_measurement.v1",
            "method": "OpenCV source-frame window measurement",
            "samples": [{
                "sample_id": "spatial-tone:000001",
                "timestamp": 1.0,
                "interval": {"start_seconds": 1.0, "end_seconds": 2.0},
                "authority": "measured_automatic_detection",
                "zones": {"whole_frame": {
                    "dominant_tone": "blue-cyan",
                    "brightness": 82.0,
                    "contrast": 31.0,
                    "saturation": 54.0,
                    "luminance_entropy": 6.2,
                }},
            }],
        }

    def test_measurements_feed_visual_cinematic_and_report_motors(self):
        source = (Path(__file__).parents[1] / "api_server.py").read_text(encoding="utf-8")
        self.assertIn('"cue_type": "measured_visual_tone"', source)
        self.assertIn('"brightness": whole_frame.get("brightness")', source)
        self.assertIn('"clue_type": "shot_boundary_interval"', source)
        self.assertIn('"measurement_family": "shot_boundary_interval"', source)
        self.assertIn('"measurement_family": "spatial_tone"', source)
        self.assertIn('"measurement_family": "adaptive_visual_motion"', source)
        self.assertIn('"measurement_family": "audio_event_interval"', source)
        self.assertIn('"measurement_family": "speaker_diarization_turn"', source)
        self.assertIn('"cue_type": "measured_adaptive_visual_motion"', source)
        self.assertIn('/adaptive-visual/measure', source)
        self.assertIn('"adaptive_temporal_visual_measurements"', source)
        self.assertIn('"maturity_route": "master_schema.adaptive_temporal_visual_measurement_maturity"', source)
        self.assertIn(
            'response_data["summary"]["adaptive_visual_scan"]',
            source,
        )

    def test_master_schema_measurements_feed_matcher(self):
        status = {
            "vaa1_annotation_master_schema": {
                "temporal_segments": [{
                    "segment_id": "shot-boundary-0001",
                    "event_family": "shot_boundary_interval",
                    "event_label": "Shot 1",
                    "start": 1.0,
                    "end": 2.5,
                }],
                "foundational_source_layers": {"layers": {
                    "spatial_tone_measurements": {
                        "status": "available",
                        "row_count": 1,
                        "schema": "vaa1.spatial_tone_measurement.v1",
                    },
                }},
            },
            "summary": {
                "shot_boundaries": self.shot_boundaries,
                "spatial_tone_scan": self.spatial_tone,
            },
        }
        evidence = collect_matchable_evidence("analysis-1", status)
        ids = {item["evidence_id"] for item in evidence}
        self.assertIn("shot-boundary-0001", ids)
        self.assertIn("master_schema:foundational:spatial_tone_measurements", ids)

if __name__ == "__main__":
    unittest.main()
