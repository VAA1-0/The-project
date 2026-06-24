import importlib.util
import unittest
from pathlib import Path


def load_agent_module():
    module_path = (
        Path(__file__).resolve().parents[1]
        / "src/backend/analysis/multimodal_pattern_scanner_agent.py"
    )
    spec = importlib.util.spec_from_file_location(
        "multimodal_pattern_scanner_agent",
        module_path,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


agent = load_agent_module()


class MultimodalPatternScannerAgentContractTests(unittest.TestCase):
    def test_agent_builds_traceable_constellation_from_known_detection(self):
        status = {
            "analysis_id": "analysis-pattern-agent",
            "transcript": {
                "segments": [
                    {
                        "id": "transcript:bond:late",
                        "start": 95.6,
                        "end": 97.0,
                        "speaker": "SPEAKER_01",
                        "text": "You do not know what this is.",
                    }
                ]
            },
            "audio_diarization": {
                "speaker_turns": [
                    {
                        "turn_id": "speaker:late",
                        "speaker_label": "SPEAKER_01",
                        "start": 95.6,
                        "end": 97.0,
                    }
                ]
            },
            "results": {
                "visual_analysis": {
                    "ocr_results": [
                        {
                            "id": "ocr:mi6",
                            "text": "MI6",
                            "timestamp": 96.0,
                        }
                    ]
                }
            },
            "mise_en_scene_scene_cards": {
                "scene_cards": [
                    {
                        "scene_id": "scene:late-dialogue",
                        "title": "interior confrontation",
                        "start": 94.0,
                        "end": 99.0,
                    }
                ]
            },
        }
        seed = {
            "seed_id": "manual:bond:early",
            "label": "James Bond",
            "category": "Identification",
            "tokens": ["bond", "james"],
            "time": {"start": 4.9, "end": 6.1},
        }
        candidate = {
            "candidate_id": "tracked_object:28",
            "source_panel": "objects_panel",
            "source_ref": "28",
            "label": "person",
            "category": "person",
            "time": {"start": 96.0, "end": 96.2},
        }

        support = agent.scan_constellation_for_candidate(status, seed, candidate)

        self.assertEqual(support["schema"], "vaa1.multimodal_pattern_scanner_agent.v1")
        self.assertEqual(support["agent"], "multimodal_pattern_scanner")
        self.assertTrue(support["governance"]["diagnostic_only"])
        self.assertTrue(support["governance"]["candidate_is_not_mature_truth"])
        self.assertGreaterEqual(support["support_count"], 4)
        self.assertGreaterEqual(support["modality_count"], 4)
        self.assertIn("visual_audio_support", support["match_basis"])
        self.assertIn("visual_text_support", support["match_basis"])
        self.assertIn("scene_context_support", support["match_basis"])
        self.assertIn("objects_panel", support["support_panels"])
        self.assertIn("transcript_panel", support["support_panels"])
        self.assertIn("audio_panel", support["support_panels"])
        self.assertIn("ocr_panel", support["support_panels"])
        self.assertIn("scene_cards", support["support_panels"])
        self.assertGreaterEqual(support["confidence"], 0.75)


if __name__ == "__main__":
    unittest.main()
