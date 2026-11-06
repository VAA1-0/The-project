import unittest

from src.backend.analysis.speaker_suggestion_evaluation import (
    confirmed_speaker_seeds,
    evaluate_speaker_suggestions,
)


class SpeakerSuggestionEvaluationTests(unittest.TestCase):
    def test_extracts_only_confirmed_audio_rows_with_embeddings(self):
        corrections = {"proliferation_decisions": [
            {"candidate_id": "narrative-agent-audio-family:a:embedding:t1", "decision": "confirmed", "applied_label": "A"},
            {"candidate_id": "visual:x", "decision": "confirmed", "applied_label": "A"},
        ]}
        diarization = {"embedding_index": {"items": [{"embedding_id": "embedding:t1", "vector": [1, 0]}]}}
        seeds = confirmed_speaker_seeds(corrections, diarization)
        self.assertEqual([(row["speaker_label"], row["embedding_id"]) for row in seeds], [("A", "embedding:t1")])

    def test_reports_top_two_margin_abstention_and_authority_boundary(self):
        seeds = [
            {"seed_id": "a1", "speaker_label": "A", "vector": [1.0, 0.0]},
            {"seed_id": "a2", "speaker_label": "A", "vector": [0.99, 0.01]},
            {"seed_id": "b1", "speaker_label": "B", "vector": [0.0, 1.0]},
            {"seed_id": "b2", "speaker_label": "B", "vector": [0.01, 0.99]},
        ]
        result = evaluate_speaker_suggestions(seeds, abstention_margins=(0.0, 0.5))
        self.assertEqual(result["top_1"], {"correct": 4, "total": 4, "accuracy": 1.0})
        self.assertEqual(len(result["rows"][0]["top_two"]), 2)
        self.assertFalse(result["authority_boundary"]["automatic_maturation_allowed"])
        self.assertTrue(result["authority_boundary"]["analyst_confirmation_is_canonical"])


if __name__ == "__main__":
    unittest.main()
