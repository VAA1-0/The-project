import importlib.util
import json
import math
import struct
import sys
import tempfile
import unittest
import wave
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


def write_test_wave(path: Path, duration: float = 4.0, sample_rate: int = 16000) -> None:
    samples = []
    for index in range(int(duration * sample_rate)):
        time_seconds = index / sample_rate
        frequency = 180.0 if time_seconds < duration / 2 else 310.0
        envelope = 0.65 if (index // 800) % 5 != 0 else 0.2
        value = int(32767 * envelope * math.sin(2 * math.pi * frequency * time_seconds))
        samples.append(struct.pack("<h", value))
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(b"".join(samples))


class AudioDiarizationContractTest(unittest.TestCase):
    def test_measured_audio_pass_produces_vad_turns_and_acoustic_embeddings(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            audio_path = Path(tmpdir) / "voices.wav"
            write_test_wave(audio_path)
            payload = audio_diarization.build_audio_diarization(
                "analysis-1",
                audio_path=audio_path,
                transcript={
                    "segments": [
                        {"start": 0.0, "end": 1.8, "text": "Hello"},
                        {"start": 2.0, "end": 3.8, "text": "World"},
                    ]
                },
                audio_prosody={"cues": [{}, {}]},
            )

        self.assertEqual(payload["status"], "completed_measured")
        self.assertEqual(payload["provider"], "local_waveform_vad_acoustic_clustering")
        self.assertEqual(payload["turn_count"], 2)
        self.assertGreater(len(payload["vad_segments"]), 0)
        self.assertTrue(
            all(
                turn["diarization_status"] == "measured_acoustic_cluster"
                for turn in payload["speaker_turns"]
            )
        )
        self.assertEqual(
            payload["embedding_index"]["status"],
            "completed_measured",
        )
        self.assertGreater(
            len(payload["embedding_index"]["items"][0]["vector"]),
            10,
        )
        self.assertFalse(payload["measurement"]["identity_recognition_performed"])
        self.assertEqual(payload["prosody_cue_count"], 2)

    def test_write_measured_audio_analysis_persists_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            audio_path = Path(tmpdir) / "voices.wav"
            output_path = Path(tmpdir) / "audio_diarization.json"
            write_test_wave(audio_path)
            payload = audio_diarization.write_audio_diarization(
                "analysis-1",
                audio_path=audio_path,
                output_json_path=output_path,
                transcript={"segments": []},
            )

            self.assertTrue(output_path.exists())
            persisted = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(persisted["analysis_id"], payload["analysis_id"])
            self.assertEqual(persisted["status"], "completed_measured")
            self.assertEqual(
                persisted["measurement"]["sample_rate"],
                16000,
            )

    def test_repaired_transcript_timing_status_is_carried_into_speaker_turns(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            audio_path = Path(tmpdir) / "voices.wav"
            write_test_wave(audio_path, duration=6.0)
            payload = audio_diarization.build_audio_diarization(
                "analysis-1",
                audio_path=audio_path,
                transcript={
                    "transcription_strategy": "anchored_vad_timing_repair",
                    "timing_repair": {
                        "status": "partially_repaired",
                        "reason": "degraded_scaffold_clock_repaired_with_anchored_vad_timing",
                    },
                    "segments": [
                        {
                            "start": 1.0,
                            "end": 2.0,
                            "source_start": 0.0,
                            "source_end": 1.0,
                            "text": "Anchor",
                            "timing_status": "anchor_verified",
                            "timing_authority": "anchored_vad_timing_repair",
                            "timing_source": "annotation_corrections.transcript_clock_offset_seconds",
                        },
                        {
                            "start": 3.0,
                            "end": 4.2,
                            "source_start": 2.0,
                            "source_end": 3.2,
                            "text": "Measured drift anchor",
                            "timing_status": "vad_anchor_verified",
                            "timing_authority": "anchored_vad_timing_repair",
                            "timing_source": "audio_diarization.vad_segments",
                        },
                    ],
                },
            )

        authority = payload["measurement"]["transcript_timing_authority"]
        self.assertEqual(authority["status"], "partially_repaired")
        self.assertEqual(authority["strategy"], "anchored_vad_timing_repair")
        self.assertEqual(payload["speaker_turns"][0]["timing_status"], "anchor_verified")
        self.assertEqual(payload["speaker_turns"][1]["timing_status"], "vad_anchor_verified")
        self.assertEqual(
            payload["speaker_turns"][1]["timing_authority"],
            "anchored_vad_timing_repair",
        )

    def test_completed_measured_diarization_is_stale_if_transcript_clock_changed(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            audio_path = Path(tmpdir) / "voices.wav"
            write_test_wave(audio_path, duration=8.0)
            original_transcript = {
                "segments": [
                    {"start": 0.0, "end": 2.0, "text": "Why would I betray you?"},
                    {"start": 2.0, "end": 4.0, "text": "We all have our secrets."},
                ]
            }
            payload = audio_diarization.build_audio_diarization(
                "analysis-1",
                audio_path=audio_path,
                transcript=original_transcript,
            )
            repaired_transcript = {
                "segments": [
                    {"start": 6.4, "end": 8.4, "text": "Why would I betray you?"},
                    {"start": 8.4, "end": 10.4, "text": "We all have our secrets."},
                ]
            }

            health = audio_diarization.audio_diarization_staleness(
                payload,
                repaired_transcript,
                audio_path,
            )

        self.assertTrue(health["is_stale"])
        self.assertIn("mismatch", health["stale_reason"])

    def test_verified_speaker_turns_survive_rebuild_with_correct_global_time(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            audio_path = Path(tmpdir) / "voices.wav"
            write_test_wave(audio_path, duration=24.0)
            payload = audio_diarization.build_audio_diarization(
                "analysis-bond",
                audio_path=audio_path,
                transcript={
                    "transcription_strategy": "anchored_vad_timing_repair",
                    "segments": [
                        {
                            "start": 6.4,
                            "end": 8.4,
                            "text": "Why would I betray you?",
                            "timing_status": "anchor_verified",
                            "timing_authority": "anchored_vad_timing_repair",
                        },
                        {
                            "start": 20.96,
                            "end": 22.215,
                            "text": "The world is arming faster than we can respond.",
                            "timing_status": "vad_anchor_verified",
                            "timing_authority": "anchored_vad_timing_repair",
                        },
                    ],
                },
            )

        self.assertEqual(payload["speaker_turns"][0]["start"], 6.4)
        self.assertEqual(payload["speaker_turns"][1]["start"], 20.96)
        self.assertTrue(payload["speaker_turns"][0]["valid_for_confirmation"])
        self.assertFalse(payload["is_stale"])


if __name__ == "__main__":
    unittest.main()
