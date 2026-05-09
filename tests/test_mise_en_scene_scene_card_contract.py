import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


def load_scene_card_module():
    module_path = (
        Path(__file__).resolve().parents[1]
        / "src/backend/analysis/mise_en_scene_scene_card.py"
    )
    spec = importlib.util.spec_from_file_location("mise_en_scene_scene_card", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


scene_cards = load_scene_card_module()
ROOT = Path(__file__).resolve().parents[1]
API_SERVER = (ROOT / "api_server.py").read_text(encoding="utf-8")
API_SERVICE = (ROOT / "src/frontend/lib/api-service.ts").read_text(encoding="utf-8")
FRONTEND_CONFIG = (ROOT / "src/frontend/lib/config.ts").read_text(encoding="utf-8")
DOWNLOAD_PANEL = (
    ROOT / "src/frontend/app/V2components/components/panels/DownloadPanel.tsx"
).read_text(encoding="utf-8")
LAYOUT_HOST = (
    ROOT / "src/frontend/app/V2components/components/LayoutHost.tsx"
).read_text(encoding="utf-8")
MENU_BAR = (
    ROOT / "src/frontend/app/V2components/components/MenuBar.tsx"
).read_text(encoding="utf-8")
SCENE_CARD_PANEL = (
    ROOT / "src/frontend/app/V2components/components/panels/SceneCardPanel.tsx"
).read_text(encoding="utf-8")


class MiseEnSceneSceneCardContractTest(unittest.TestCase):
    def sample_status(self):
        return {
            "video_id": "video-1",
            "source_metadata": {
                "title": "Archive Programme",
                "genre": "current affairs",
                "location": "studio",
            },
            "results": {
                "scene_analysis": {
                    "scenes": [
                        {
                            "scene_id": "analysis-1:scene:001",
                            "start_ms": 43000,
                            "end_ms": 69000,
                            "scene_boundary_source": "detected",
                            "shot_size": "medium shot",
                        }
                    ]
                },
                "transcript": {
                    "segments": [
                        {
                            "id": "utt-1",
                            "speaker": "SPEAKER_01",
                            "start": 43.12,
                            "end": 45.5,
                            "text": "We need to finish this before tomorrow.",
                        },
                        {
                            "id": "utt-2",
                            "speaker": "SPEAKER_02",
                            "start": 48.0,
                            "end": 50.2,
                            "text": "I know, but we still don't have the files.",
                        },
                        {
                            "id": "utt-3",
                            "speaker": "SPEAKER_01",
                            "start": 55.0,
                            "end": 56.4,
                            "text": "Then call her now?",
                        },
                    ]
                },
                "visual_analysis": {
                    "tracked_objects": [
                        {
                            "track_id": 1,
                            "class_name": "person",
                            "timestamp": 44.0,
                            "endTimestamp": 68.0,
                        },
                        {
                            "track_id": 2,
                            "class_name": "screen",
                            "timestamp": 44.5,
                            "endTimestamp": 66.0,
                        },
                        {
                            "track_id": 3,
                            "class_name": "evening dress",
                            "timestamp": 49.0,
                            "endTimestamp": 60.0,
                        },
                    ],
                    "ocr_results": [
                        {
                            "id": "ocr-1",
                            "timestamp": 46.0,
                            "text": "DEADLINE",
                        }
                    ],
                    "expression_results": [
                        {
                            "id": "expr-1",
                            "timestamp": 52.0,
                            "emotion": {
                                "fear": 78.0,
                                "happy": 1.0,
                                "neutral": 21.0,
                            },
                        }
                    ],
                },
                "audio_prosody": {
                    "events": [
                        {
                            "id": "prosody-1",
                            "timestamp": 55.1,
                            "event": "raised voice",
                        }
                    ]
                },
                "second_order_label_proliferation": {
                    "instructions": [
                        {
                            "instruction_id": "meaning-1",
                            "target_label_family": "Scene",
                            "candidate_label": "opening_question",
                            "status": "probable",
                            "time_span": {"start_ms": 43000, "end_ms": 45000},
                            "source_feature_payload": {
                                "alternative_plot_lenses": {
                                    "freytag": ["exposition", "rising_action"]
                                }
                            },
                            "open_scores": {"weighted_support_score": 0.72},
                        }
                    ]
                },
            },
        }

    def test_scene_card_includes_exact_speech_symbols_and_navigation(self):
        bundle = scene_cards.build_mise_en_scene_scene_cards(
            "analysis-1",
            self.sample_status(),
        )

        self.assertEqual(bundle["schema"], "vaa1.mise_en_scene_scene_cards.v1")
        self.assertEqual(bundle["title"], "Mise-en-Scene Scene Card Report")
        self.assertEqual(bundle["artifact_type"], "mise_en_scene_scene_card_report")
        card = bundle["scene_cards"][0]
        self.assertEqual(card["schema"], "vaa1.scene_card.v1")
        self.assertEqual(card["title"], "Scene Card 001")
        self.assertEqual(card["display_title"], "Scene Card 001")
        self.assertEqual(card["scene_id"], "analysis-1:scene:001")
        self.assertEqual(len(card["said_in_scene"]), 3)
        self.assertEqual(
            card["said_in_scene"][0]["text"],
            "We need to finish this before tomorrow.",
        )
        self.assertEqual(
            card["said_in_scene"][0]["navigation"]["panel"],
            "TranscriptPanel",
        )

        labels = {item["label"]: item for item in card["items"]}
        prop_labels = {
            item["label"]: item for item in card["items"] if item["category"] == "props"
        }
        self.assertEqual(labels["dialogue"]["symbol"], "●")
        self.assertEqual(labels["urgency"]["symbol"], "◐")
        self.assertEqual(labels["screen"]["symbol"], "●")
        self.assertEqual(prop_labels["evening dress"]["category"], "props")
        self.assertEqual(prop_labels["evening dress"]["navigation"]["panel"], "OBJDetectionPanel")
        self.assertEqual(labels["medium shot"]["category"], "cinematic_cues")
        self.assertIn("fear expression cue", labels)
        self.assertTrue(card["authority_policy"]["exact_transcript_remains_visible"])
        self.assertIn("meaning_plot", card)
        self.assertIn("opening question", card["meaning_plot"]["summary"])
        self.assertEqual(
            card["meaning_plot"]["instructions"][0]["navigation"]["panel"],
            "MeaningPlotPanel",
        )
        self.assertIn("nlp_scene_summary_sentence", card)
        self.assertIn("speakers exchange questions", card["nlp_scene_summary_sentence"])
        self.assertEqual(
            card["nlp_scene_summary"]["authority"],
            "mature_evidence_deterministic_nlp",
        )
        self.assertIn("summary_inputs", card["nlp_scene_summary"])
        self.assertIn("mise_en_scene_description", card)
        self.assertIn("what_is_happening", card["mise_en_scene_description"])
        self.assertIn("who_is_speaking", card["mise_en_scene_description"])
        self.assertIn("situation", card["mise_en_scene_description"])
        self.assertIn("meanings_constructed", card["mise_en_scene_description"])
        self.assertIn("phenomena", card["mise_en_scene_description"])

    def test_scene_card_supports_costume_action_and_genre_facets(self):
        card = scene_cards.build_mise_en_scene_scene_cards(
            "analysis-1",
            self.sample_status(),
        )["scene_cards"][0]

        tags = card["tags"]
        self.assertIn("◐ working", tags["actions"])
        self.assertIn("○ evening dress", tags["costume"])
        self.assertIn("● current affairs", tags["genre_form"])
        self.assertIn("● studio", tags["places"])
        self.assertIn("◐ interview segment", tags["genre_form"])

    def test_scene_summary_interprets_transcript_discourse_topics(self):
        status = self.sample_status()
        status["results"]["transcript"]["segments"] = [
            {
                "id": "utt-planet-1",
                "speaker": "SPEAKER_UNKNOWN",
                "start": 43.1,
                "end": 44.2,
                "text": "Sir, what are you doing in this universe?",
            },
            {
                "id": "utt-planet-2",
                "speaker": "SPEAKER_UNKNOWN",
                "start": 46.0,
                "end": 48.0,
                "text": "In this universe, I am trying to exist without hurting anybody.",
            },
            {
                "id": "utt-planet-3",
                "speaker": "SPEAKER_UNKNOWN",
                "start": 49.0,
                "end": 50.0,
                "text": "Yeah, maybe co-exists.",
            },
        ]

        card = scene_cards.build_mise_en_scene_scene_cards(
            "analysis-1",
            status,
        )["scene_cards"][0]
        description = card["mise_en_scene_description"]

        self.assertIn("street interview", description["situation"])
        self.assertIn("existence", description["meanings_constructed"])
        self.assertIn("universe", description["meanings_constructed"])
        self.assertIn(
            "transcript_topics",
            card["nlp_scene_summary"]["summary_inputs"],
        )

    def test_scene_summary_uses_transcript_topic_model(self):
        status = self.sample_status()
        status["results"]["transcript"]["segments"] = [
            {
                "id": "utt-climate-1",
                "speaker": "SPEAKER_01",
                "start": 43.1,
                "end": 44.2,
                "text": "When the world faces a big challenge like climate change,",
            },
            {
                "id": "utt-climate-2",
                "speaker": "SPEAKER_01",
                "start": 46.0,
                "end": 48.0,
                "text": "these COP conferences and the UN Climate Summit talk about solutions.",
            },
            {
                "id": "utt-climate-3",
                "speaker": "SPEAKER_01",
                "start": 49.0,
                "end": 50.0,
                "text": "Emissions of carbon dioxide are still increasing and warming our planet.",
            },
        ]

        card = scene_cards.build_mise_en_scene_scene_cards(
            "analysis-1",
            status,
        )["scene_cards"][0]
        description = card["mise_en_scene_description"]

        self.assertIn("climate", card["nlp_scene_summary_sentence"])
        self.assertIn("climate", description["meanings_constructed"])
        self.assertTrue(
            any("climate summit report" in tag for tag in card["tags"]["subject_domain"])
        )
        self.assertEqual(
            card["nlp_scene_summary"]["summary_inputs"]["transcript_topic_model"][
                "primary_label"
            ],
            "climate summit report",
        )

    def test_scene_summary_prefers_mature_identity_context_for_speaker(self):
        status = self.sample_status()
        status["annotation_corrections"] = {
            "manual_visual_annotations": [
                {
                    "id": "manual-role-1",
                    "category": "Role",
                    "label": "News anchor",
                    "role_affirmation": "News anchor",
                    "start_seconds": 43.0,
                    "end_seconds": 60.0,
                },
                {
                    "id": "manual-id-1",
                    "category": "Identification",
                    "label": "Sari Multala",
                    "identity_affirmation": "Sari Multala",
                    "start_seconds": 43.0,
                    "end_seconds": 60.0,
                },
            ]
        }

        card = scene_cards.build_mise_en_scene_scene_cards(
            "analysis-1",
            status,
        )["scene_cards"][0]
        description = card["mise_en_scene_description"]

        self.assertIn("News anchor", description["who_is_speaking"])
        self.assertIn("Sari Multala", description["who_is_speaking"])
        self.assertIn(
            "Sari Multala",
            card["nlp_scene_summary"]["summary_inputs"]["identity_labels"],
        )

    def test_single_long_scene_splits_into_transcript_windows(self):
        status = self.sample_status()
        status["results"]["scene_analysis"]["scenes"] = [
            {
                "scene_id": "analysis-1:scene:001",
                "start_ms": 0,
                "end_ms": 150000,
                "scene_boundary_source": "detected_single_extent",
            }
        ]
        status["results"]["transcript"]["segments"] = [
            {
                "id": f"utt-window-{index}",
                "speaker": "SPEAKER_01",
                "start": float(index * 12),
                "end": float(index * 12 + 3),
                "text": f"Transcript line {index}.",
            }
            for index in range(12)
        ]

        bundle = scene_cards.build_mise_en_scene_scene_cards("analysis-1", status)

        self.assertGreater(len(bundle["scene_cards"]), 1)
        self.assertTrue(
            all(
                card["scene_boundary_source"] == "fallback_transcript_window"
                for card in bundle["scene_cards"]
            )
        )

    def test_manual_correction_wins_without_destroying_system_item(self):
        card = scene_cards.build_mise_en_scene_scene_cards(
            "analysis-1",
            self.sample_status(),
        )["scene_cards"][0]
        office_item = next(item for item in card["items"] if item["label"] == "studio")

        resolved = scene_cards.apply_scene_card_corrections(
            card,
            [
                {
                    "action": "rename",
                    "target_item_id": office_item["item_id"],
                    "category": "places",
                    "label": "newsroom",
                    "note": "Archivist correction.",
                }
            ],
        )

        original_labels = {item["label"] for item in resolved["items"]}
        resolved_labels = {item["label"] for item in resolved["resolved_items"]}
        self.assertIn("studio", original_labels)
        self.assertIn("newsroom", resolved_labels)
        manual_item = next(item for item in resolved["resolved_items"] if item["label"] == "newsroom")
        self.assertEqual(manual_item["symbol"], "✓")
        self.assertTrue(resolved["authority_policy"]["manual_correction_wins"])

    def test_scene_card_prefers_mature_annotation_corrections(self):
        status = self.sample_status()
        status["annotation_corrections"] = {
            "updated_at": "2026-05-08T08:00:00+00:00",
            "text_substitutions": [
                {
                    "modality": "text",
                    "raw_value": "before tomorrow",
                    "corrected_value": "by noon",
                }
            ],
            "label_overrides": [
                {
                    "modality": "object",
                    "raw_value": "screen",
                    "corrected_value": "archive monitor",
                },
                {
                    "modality": "expression",
                    "raw_value": "fear",
                    "corrected_value": "concern",
                },
            ],
            "manual_transcript_entries": [
                {
                    "id": "manual-line-1",
                    "start": 57.0,
                    "end": 58.0,
                    "text": "Manual transcript line.",
                }
            ],
            "manual_visual_annotations": [
                {
                    "id": "manual-scene-1",
                    "category": "Scene",
                    "label": "archivist reviewed scene",
                    "geometry_type": "box",
                    "coordinates": {"x": 0, "y": 0, "w": 1, "h": 1},
                    "timestamp_seconds": 58.0,
                    "start_seconds": 57.5,
                    "end_seconds": 58.5,
                    "open_note": "Human-confirmed scene note.",
                }
            ],
        }

        bundle = scene_cards.build_mise_en_scene_scene_cards("analysis-1", status)
        card = bundle["scene_cards"][0]
        said = [entry["text"] for entry in card["said_in_scene"]]
        labels = {item["label"]: item for item in card["items"]}

        self.assertIn("We need to finish this by noon.", said)
        self.assertIn("Manual transcript line.", said)
        self.assertIn("archive monitor", labels)
        self.assertIn("concern expression cue", labels)
        self.assertIn("archivist reviewed scene", labels)
        self.assertEqual(labels["archivist reviewed scene"]["symbol"], "✓")
        self.assertTrue(bundle["mature_evidence_policy"]["annotation_corrections_applied"])

    def test_source_extraction_metadata_summary_does_not_mutate_source_metadata(self):
        status = self.sample_status()
        original_metadata = dict(status["source_metadata"])
        bundle = scene_cards.build_mise_en_scene_scene_cards("analysis-1", status)
        summary = scene_cards.build_source_extraction_metadata_summary(bundle)

        self.assertEqual(status["source_metadata"], original_metadata)
        self.assertEqual(summary["schema"], "vaa1.source_extraction_metadata_summary.v1")
        self.assertEqual(summary["title"], "Scene Card Source Extraction Metadata Summary")
        self.assertEqual(summary["artifact_type"], "scene_card_source_extraction_metadata_summary")
        self.assertEqual(summary["source_metadata_unchanged"], original_metadata)
        self.assertTrue(summary["authority_policy"]["scene_cards_do_not_mutate_source_metadata"])
        self.assertIn("analysis-1:scene:001", summary["supporting_scenes"])
        self.assertIn("scene_cards", summary["derived_from"])

    def test_scene_card_and_metadata_summary_can_be_written_as_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            card_path = Path(tmpdir) / "scene_cards.json"
            summary_path = Path(tmpdir) / "source_extraction_metadata_summary.json"

            bundle = scene_cards.write_mise_en_scene_scene_cards(
                "analysis-1",
                self.sample_status(),
                card_path,
            )
            summary = scene_cards.write_source_extraction_metadata_summary(
                bundle,
                summary_path,
            )

            self.assertTrue(card_path.exists())
            self.assertTrue(summary_path.exists())
            persisted_card = json.loads(card_path.read_text(encoding="utf-8"))
            persisted_summary = json.loads(summary_path.read_text(encoding="utf-8"))
            self.assertEqual(persisted_card["schema"], bundle["schema"])
            self.assertEqual(persisted_summary["schema"], summary["schema"])

    def test_backend_and_frontend_download_wiring_exposes_scene_card_artifacts(self):
        self.assertIn("write_mise_en_scene_artifacts_for_status", API_SERVER)
        self.assertIn("write_mise_en_scene_scene_cards", API_SERVER)
        self.assertIn("write_source_extraction_metadata_summary", API_SERVER)
        self.assertIn("write_mise_en_scene_artifacts_for_status(status)", API_SERVER)
        self.assertIn('"mise_en_scene_scene_cards": status.get("mise_en_scene_scene_cards")', API_SERVER)
        self.assertIn(
            '"source_extraction_metadata_summary": status.get("source_extraction_metadata_summary")',
            API_SERVER,
        )
        self.assertIn('"mise_en_scene_scene_cards": "mise_en_scene_scene_card_report.json"', API_SERVER)
        self.assertIn(
            '"source_extraction_metadata_summary": "scene_card_source_extraction_metadata_summary.json"',
            API_SERVER,
        )

        for frontend_source in (API_SERVICE, FRONTEND_CONFIG, DOWNLOAD_PANEL):
            self.assertIn("mise_en_scene_scene_cards", frontend_source)
            self.assertIn("source_extraction_metadata_summary", frontend_source)
            self.assertIn("Scene Card", frontend_source)

    def test_scene_card_panel_is_registered_and_loads_downloaded_artifact(self):
        self.assertIn("SceneCardPanel", LAYOUT_HOST)
        self.assertIn('"SceneCards"', LAYOUT_HOST)
        self.assertIn('openPanel("SceneCards"', MENU_BAR)
        self.assertIn('"mise_en_scene_scene_cards"', SCENE_CARD_PANEL)
        self.assertIn('"source_extraction_metadata_summary"', SCENE_CARD_PANEL)
        self.assertIn("openVideoAtTime", SCENE_CARD_PANEL)
        self.assertIn("said_in_scene", SCENE_CARD_PANEL)
        self.assertIn("matureSpeech", SCENE_CARD_PANEL)
        self.assertIn("masterSchemaResolvedEvidence", SCENE_CARD_PANEL)
        self.assertIn("VideoService.refreshAnalysis", SCENE_CARD_PANEL)
        self.assertIn("meaning_plot", SCENE_CARD_PANEL)
        self.assertIn("MeaningPlot", SCENE_CARD_PANEL)
        self.assertIn("ManualScene", SCENE_CARD_PANEL)
        self.assertIn("nlp_scene_summary_sentence", SCENE_CARD_PANEL)
        self.assertIn("mise_en_scene_description", SCENE_CARD_PANEL)


if __name__ == "__main__":
    unittest.main()
