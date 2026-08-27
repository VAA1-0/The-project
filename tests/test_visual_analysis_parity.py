import unittest

from src.backend.analysis.visual_analysis_parity import build_visual_analysis_parity


class VisualAnalysisParityTests(unittest.TestCase):
    def test_counts_each_visual_consumer_input(self):
        parity = build_visual_analysis_parity(
            [{"id": 1}, {"id": 2}], [{"text": "one"}],
            [{"emotion": "neutral"}, {"emotion": "happy"}, {"emotion": "sad"}],
        )
        self.assertEqual(parity["tracked_objects"]["row_count"], 2)
        self.assertEqual(parity["ocr"]["row_count"], 1)
        self.assertEqual(parity["expressions"]["row_count"], 3)
        self.assertTrue(parity["ocr"]["consumer_route"])


if __name__ == "__main__":
    unittest.main()
