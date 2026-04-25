import importlib.util
import json
import unittest
from pathlib import Path


def load_audio_sample_cloud_module():
    module_path = (
        Path(__file__).resolve().parents[1]
        / "src/backend/analysis/audio_sample_cloud.py"
    )
    spec = importlib.util.spec_from_file_location("audio_sample_cloud", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


audio_sample_cloud = load_audio_sample_cloud_module()


class AudioSampleCloudContractTest(unittest.TestCase):
    def test_character_audio_cloud_preserves_sample_array_and_authority_order(self):
        payload = audio_sample_cloud.build_character_audio_sample_cloud(
            "analysis-1",
            entity_label="James Bond",
            source_media_context={
                "source_media_id": "media-1",
                "genre": "movie_trailer",
            },
            speaker_turns=[
                {
                    "turn_id": "turn_0001",
                    "speaker_label": "SPEAKER_01",
                    "start": 53.639,
                    "end": 56.076,
                    "text": "Bond. James Bond.",
                    "embedding_ref": "embedding:james-bond:0001",
                    "confidence": 0.82,
                    "review_state": "confirmed",
                    "epistemic_status": "confirmed",
                    "source_type": "analyst_promoted_candidate",
                    "sample_role": "reference",
                    "speech_role_hints": ["identity_cue"],
                },
                {
                    "turn_id": "turn_0002",
                    "speaker_label": "SPEAKER_01",
                    "start": 61.0,
                    "end": 63.0,
                    "text": "Another short sample.",
                },
            ],
        )

        self.assertEqual(payload["entity_type"], "character_voice")
        self.assertEqual(payload["entity_label"], "James Bond")
        self.assertEqual(payload["cloud_summary"]["sample_count"], 2)
        self.assertEqual(payload["cloud_summary"]["confirmed_sample_count"], 1)
        self.assertEqual(
            payload["cloud_summary"]["authority_order"],
            [
                "manual_confirmed_sample",
                "manual_candidate_sample",
                "diarization_speaker_turn",
                "transcript_segment",
                "raw_audio",
            ],
        )
        self.assertEqual(payload["samples"][0]["source_turn_id"], "turn_0001")
        self.assertEqual(payload["samples"][0]["speaker_label"], "SPEAKER_01")
        self.assertEqual(
            payload["samples"][0]["audio_features"]["voice_embedding_ref"],
            "embedding:james-bond:0001",
        )
        self.assertIn("turn_0002", payload["samples"][1]["supporting_evidence_ids"])

    def test_audio_sample_cloud_schema_declares_trackable_sample_fields(self):
        schema_path = (
            Path(__file__).resolve().parents[1]
            / "docs/schemas/vaa1.audio_sample_data_cloud.schema.json"
        )
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        sample_properties = (
            schema["properties"]["samples"]["items"]["properties"]
        )
        summary_properties = schema["properties"]["cloud_summary"]["properties"]

        self.assertIn("speaker_label", sample_properties)
        self.assertIn("source_turn_id", sample_properties)
        self.assertIn("sample_role", sample_properties)
        self.assertIn("authority_order", summary_properties)

    def test_diarization_turns_group_into_one_cloud_per_speaker(self):
        payload = audio_sample_cloud.build_audio_sample_clouds_from_diarization(
            "analysis-1",
            audio_diarization={
                "speaker_turns": [
                    {
                        "turn_id": "turn_0001",
                        "speaker_label": "SPEAKER_01",
                        "start": 0.0,
                        "end": 2.0,
                        "text": "First sample",
                    },
                    {
                        "turn_id": "turn_0002",
                        "speaker_label": "SPEAKER_02",
                        "start": 2.0,
                        "end": 4.0,
                        "text": "Second sample",
                    },
                    {
                        "turn_id": "turn_0003",
                        "speaker_label": "SPEAKER_01",
                        "start": 4.0,
                        "end": 5.0,
                        "text": "Third sample",
                    },
                ]
            },
        )

        self.assertEqual(payload["status"], "sample_clouds_ready")
        self.assertEqual(payload["cloud_count"], 2)
        self.assertEqual(payload["sample_count"], 3)
        speaker_one = payload["clouds"][0]
        self.assertEqual(speaker_one["entity_label"], "SPEAKER_01")
        self.assertEqual(speaker_one["entity_type"], "speaker")
        self.assertEqual(speaker_one["cloud_summary"]["sample_count"], 2)


if __name__ == "__main__":
    unittest.main()
