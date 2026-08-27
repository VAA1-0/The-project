import unittest

from src.backend.analysis.language_analysis_parity import build_language_analysis_parity


class LanguageAnalysisParityTests(unittest.TestCase):
    def test_denominators_and_ttr_are_explicit(self):
        result = build_language_analysis_parity(
            {"language": "en", "segments": [{"text": "One good test", "start": 0, "end": 1}]},
            {"token_count": 3, "pos_counts": {"NOUN": 2}, "analysis_mode": "structured_pos"},
            {"token_info": {"tokens": ["one", "good", "test"], "tokens_filtered": ["good", "test"], "ttr": 1.0},
             "stats_df": [{"Sentences": 1, "Words": 3}]},
            {"anchors": [{"anchor_id": "a-1"}]},
        )
        self.assertEqual(result["cross_panel"]["pos_quant_token_parity_percentage"], 100.0)
        self.assertEqual(result["pos"]["classification_coverage_percentage"], 66.7)
        self.assertEqual(result["quant"]["type_token_ratio_formula"], "all_token_unique_terms / input_token_count")
        self.assertEqual(result["transcript"]["timed_coverage_percentage"], 100.0)
        self.assertEqual(result["linked_transcript"]["anchor_count"], 1)


if __name__ == "__main__":
    unittest.main()
