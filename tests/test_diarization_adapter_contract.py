import importlib.util
import ast
import unittest
from pathlib import Path


def load_diarization_adapter_module():
    module_path = Path(__file__).resolve().parents[1] / "src/backend/analysis/diarization_adapter.py"
    spec = importlib.util.spec_from_file_location("diarization_adapter", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


diarization_adapter = load_diarization_adapter_module()


class DiarizationAdapterContractTest(unittest.TestCase):
    def test_unavailable_adapter_preserves_runtime_contract(self):
        adapter = diarization_adapter.get_default_diarization_adapter()
        payload = adapter.run(
            diarization_adapter.DiarizationRequest(
                analysis_id="analysis-1",
                audio_path="outputs/audio/example.wav",
                reference_speakers=[{"speaker_label": "SPEAKER_01"}],
            )
        )

        self.assertEqual(payload["status"], "runtime_unavailable")
        self.assertEqual(payload["provider"], "pyannote.audio")
        self.assertEqual(payload["reference_speaker_count"], 1)
        self.assertEqual(payload["embedding_index"]["alternative_provider"], "SpeechBrain")

    def test_realtime_request_selects_diart_provider(self):
        adapter = diarization_adapter.get_default_diarization_adapter()
        payload = adapter.run(
            diarization_adapter.DiarizationRequest(
                analysis_id="analysis-1",
                audio_path="outputs/audio/example.wav",
                realtime=True,
            )
        )

        self.assertEqual(payload["provider"], "diart")

    def test_measured_writer_accepts_reference_speakers_contract(self):
        project_root = Path(__file__).resolve().parents[1]
        source_path = project_root / "src/backend/analysis/audio_diarization.py"
        tree = ast.parse(source_path.read_text(encoding="utf-8"))
        functions = {
            node.name: node
            for node in tree.body
            if isinstance(node, ast.FunctionDef)
        }

        for name in ("build_audio_diarization", "write_audio_diarization"):
            self.assertIn(name, functions)
            keyword_names = [arg.arg for arg in functions[name].args.kwonlyargs]
            self.assertIn(
                "reference_speakers",
                keyword_names,
                f"{name} must accept API-provided reference speakers without crashing",
            )


if __name__ == "__main__":
    unittest.main()
