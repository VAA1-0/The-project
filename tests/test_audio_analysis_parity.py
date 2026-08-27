import unittest

from src.backend.analysis.audio_analysis_parity import build_audio_analysis_parity


class AudioAnalysisParityTests(unittest.TestCase):
    def test_counts_each_audio_consumer_input(self):
        parity = build_audio_analysis_parity(
            {"cues": [{}, {}]}, {"intervals": [{}]},
            {"speaker_turns": [{}, {}, {}]}, {"clouds": [{}, {}]},
        )
        self.assertEqual(parity["audio_prosody"]["row_count"], 2)
        self.assertEqual(parity["audio_event_intervals"]["row_count"], 1)
        self.assertEqual(parity["audio_diarization"]["row_count"], 3)
        self.assertEqual(parity["audio_sample_clouds"]["row_count"], 2)
        self.assertTrue(parity["audio_sample_clouds"]["consumer_route"])


if __name__ == "__main__":
    unittest.main()
