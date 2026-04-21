import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


def load_audio_diarization_module():
    project_root = Path(__file__).resolve().parents[1]
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
    module_path = project_root / "src/backend/analysis/audio_diarization.py"
    spec = importlib.util.spec_from_file_location("audio_diarization", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


audio_diarization = load_audio_diarization_module()


class AudioDiarizationContractTest(unittest.TestCase):
    def test_scaffold_declares_planned_stack_and_turn_contract(self):
        payload = audio_diarization.build_audio_diarization_scaffold(
            "analysis-1",
            audio_path="outputs/audio/example.wav",
            transcript={
                "segments": [
                    {"start": 0.0, "end": 1.5, "text": "Hello"},
                    {
                        "start": 1.5,
                        "end": 3.0,
                        "text": "World",
                        "speaker": "SPEAKER_01",
                    },
                ]
            },
            audio_prosody={"cues": [{}, {}]},
        )

        self.assertEqual(payload["status"], "scaffold_ready")
        self.assertEqual(payload["turn_count"], 2)
        self.assertEqual(payload["speaker_turns"][0]["speaker_label"], "SPEAKER_UNKNOWN")
        self.assertEqual(payload["speaker_turns"][1]["speaker_label"], "SPEAKER_01")
        self.assertEqual(payload["stack_plan"]["diarization"]["provider"], "pyannote.audio")
        self.assertEqual(payload["stack_plan"]["real_time"]["provider"], "diart")
        self.assertEqual(payload["adapter_probe"]["status"], "runtime_unavailable")
        self.assertEqual(
            payload["stack_plan"]["speaker_embeddings"]["alternative_provider"],
            "SpeechBrain",
        )
        self.assertEqual(payload["prosody_cue_count"], 2)

    def test_write_scaffold_persists_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "audio_diarization_scaffold.json"
            payload = audio_diarization.write_audio_diarization_scaffold(
                "analysis-1",
                audio_path="outputs/audio/example.wav",
                output_json_path=output_path,
                transcript={"segments": []},
            )

            self.assertTrue(output_path.exists())
            persisted = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(persisted["analysis_id"], payload["analysis_id"])
            self.assertEqual(persisted["stack_plan"]["vad"]["provider"], "pyannote.audio")


if __name__ == "__main__":
    unittest.main()
