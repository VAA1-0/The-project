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
                "dependency_sfl_stage1": {
                    "utterances": [
                        {
                            "utterance_id": "sfl-1",
                            "speaker_id": "SPEAKER_01",
                            "time_interval": {"start_ms": 43120, "end_ms": 45500},
                            "text": "We need to finish this before tomorrow.",
                            "sfl_lite": {
                                "ideational": {"process_type": "material"},
                                "interpersonal": {
                                    "speech_function": "proposal",
                                    "modality": "obligation",
                                    "affect": "urgency",
                                },
                            },
                            "interpretation_support": {
                                "candidate_labels": ["Interaction: deadline pressure"]
                            },
                        },
                        {
                            "utterance_id": "sfl-2",
                            "speaker_id": "SPEAKER_01",
                            "time_interval": {"start_ms": 55000, "end_ms": 56400},
                            "text": "Then call her now?",
                            "sfl_lite": {
                                "ideational": {"process_type": "verbal"},
                                "interpersonal": {
                                    "speech_function": "question",
                                    "modality": "directive",
                                    "affect": "concern",
                                },
                            },
                            "interpretation_support": {
                                "candidate_labels": ["Action: urgent coordination"]
                            },
                        },
                    ]
                },
                "pos_analysis": {
                    "interrogative_lens": {
                        "who": ["producer"],
                        "what": ["production deadline"],
                        "where": ["studio"],
                        "when": ["tomorrow"],
                        "why": ["deadline pressure"],
                        "how": ["question"],
                        "by_what_means": ["using a production meeting"],
                        "towards_what_end": ["to finish the files"],
                        "by_what_consequence": ["therefore the deadline pressure rises"],
                    }
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
        self.assertIn("prose_sections", card)
        self.assertIn("interrogative_schema", card)
        self.assertIn("what", card["interrogative_schema"])
        self.assertIn("by_what_means", card["interrogative_schema"])
        self.assertIn("towards_what_end", card["interrogative_schema"])
        self.assertIn("by_what_consequences", card["interrogative_schema"])
        self.assertIn("performance_and_blocking", card["prose_sections"])
        self.assertIn("meaning_and_plot", card["prose_sections"])
        self.assertIn("what_is_happening", card["mise_en_scene_description"])
        self.assertIn("who_is_speaking", card["mise_en_scene_description"])
        self.assertIn("situation", card["mise_en_scene_description"])
        self.assertIn("meanings_constructed", card["mise_en_scene_description"])
        self.assertIn("phenomena", card["mise_en_scene_description"])

    def test_scene_card_prose_uses_master_sfl_and_plot_meaning_evidence(self):
        card = scene_cards.build_mise_en_scene_scene_cards(
            "analysis-1",
            self.sample_status(),
        )["scene_cards"][0]

        prose = card["prose_sections"]
        self.assertEqual(card["nlp_scene_summary"]["version"], 8)
        self.assertIn("Plot / Meaning indicators", prose["evidence_basis"])
        self.assertIn("SFL interaction analysis", prose["evidence_basis"])
        self.assertIn("opening question", prose["meaning_and_plot"])
        self.assertIn("SFL reads the interaction", prose["performance_and_blocking"])
        self.assertIn("question", prose["performance_and_blocking"])
        self.assertIn("Props and set-dressing", prose["props"])
        self.assertIn("Costume", prose["costume_hair_makeup"])
        self.assertIn("Cinematography", prose["cinematography_and_framing"])
        self.assertIn("Sound design", prose["sound_design"])
        self.assertIn("raw detections remain preserved separately", prose["evidence_basis"])

    def test_scene_card_prose_uses_source_media_metadata_annotations(self):
        status = self.sample_status()
        status["source_media_metadata"] = {
            "user_annotations": {
                "editor_notes": "Planet Helsinki October 2023: PhD Researcher Petteri Laine searching for wisdom in the Helsinki city center Alexanders Square.",
                "source_context": "PhD Researcher Petteri Laine conducts street interviews in Alexanders Square.",
                "relations": "interviewer — interviewed",
                "location_country": "Finaland",
                "location_city": "Helsinki",
                "location_place": "Alexanders Square",
                "time_moment": "October 2023",
                "time_year": "2023",
                "genre": "research video",
                "genre_subtype": "research interview",
                "situational_genre": "interview",
            }
        }
        status["results"]["dependency_sfl_stage1"]["utterances"][0][
            "interpretation_support"
        ]["candidate_labels"] = [
            {
                "label_family": "Interaction",
                "candidate_label": "directive_candidate",
                "support": "speech_function",
            }
        ]

        card = scene_cards.build_mise_en_scene_scene_cards(
            "analysis-1",
            status,
        )["scene_cards"][0]
        prose = card["prose_sections"]

        self.assertIn("Alexanders Square", prose["setting_and_set_design"])
        self.assertIn("Helsinki", prose["setting_and_set_design"])
        self.assertIn("Finland", prose["setting_and_set_design"])
        self.assertNotIn("Finaland", prose["setting_and_set_design"])
        self.assertIn("October 2023", prose["setting_and_set_design"])
        self.assertEqual(prose["setting_and_set_design"].count("Alexanders Square"), 1)
        self.assertEqual(prose["setting_and_set_design"].count("2023"), 1)
        self.assertIn("outdoor public-space footage", prose["lighting_and_color"])
        self.assertNotIn("not yet", prose["setting_and_set_design"].lower())
        self.assertIn("Petteri Laine", card["mise_en_scene_description"]["who_is_speaking"])
        self.assertIn("Petteri Laine", card["interrogative_schema"]["who"])
        self.assertIn("Alexanders Square", card["interrogative_schema"]["where"])
        self.assertIn("October 2023", card["interrogative_schema"]["when"])
        self.assertEqual(card["nlp_scene_summary_sentence"].count("interviewer"), 1)
        self.assertEqual(
            card["prose_sections"]["performance_and_blocking"].count("interviewer"),
            1,
        )
        labels = {item["label"]: item for item in card["items"]}
        self.assertEqual(labels["Alexanders Square"]["category"], "places")
        self.assertEqual(labels["Alexanders Square"]["symbol"], "✓")
        self.assertEqual(labels["research interview"]["category"], "genre_form")
        self.assertEqual(labels["interviewer"]["category"], "persons")
        self.assertIn("Interaction: directive candidate", prose["meaning_and_plot"])
        self.assertNotIn("{", prose["meaning_and_plot"])

    def test_scene_card_uses_ocr_and_pos_interrogatives_for_where_and_what(self):
        status = self.sample_status()
        status["source_media_metadata"] = {
            "user_annotations": {
                "location_country": "Brazil",
                "location_city": "Belem",
                "situation_event": "COP30 climate summit",
                "genre": "news report",
            }
        }
        status["results"]["visual_analysis"]["ocr_results"] = [
            {
                "id": "ocr-cop30",
                "timestamp": 46.0,
                "text": "BBC COP30 BELEM 25",
            }
        ]
        status["results"]["pos_analysis"]["interrogative_lens"]["where"] = ["Belem"]
        status["results"]["pos_analysis"]["interrogative_lens"]["what"] = ["COP30"]

        card = scene_cards.build_mise_en_scene_scene_cards(
            "analysis-1",
            status,
        )["scene_cards"][0]

        labels = {item["label"]: item for item in card["items"]}
        self.assertEqual(labels["Belem"]["category"], "places")
        self.assertEqual(labels["COP30"]["category"], "subject_domain")
        self.assertIn("Belem", card["interrogative_schema"]["where"])
        self.assertIn("COP30", card["interrogative_schema"]["what"])
        self.assertIn("Belem", card["prose_sections"]["setting_and_set_design"])

    def test_description_evidence_adds_means_ends_and_consequences(self):
        status = self.sample_status()
        status["source_media_metadata"] = {
            "user_annotations": {
                "description": (
                    "The researcher gathers public reflections through street interviews "
                    "to understand how people describe existence. As a result, the video "
                    "documents uncertainty and belonging."
                )
            }
        }

        card = scene_cards.build_mise_en_scene_scene_cards(
            "analysis-1",
            status,
        )["scene_cards"][0]
        schema = card["interrogative_schema"]

        self.assertIn("through street interviews", schema["by_what_means"])
        self.assertIn("to understand", schema["towards_what_end"])
        self.assertIn("As a result", schema["by_what_consequences"])
        self.assertIn(
            "description_interrogatives",
            card["nlp_scene_summary"]["summary_inputs"],
        )
        self.assertIn(
            "by_what_means",
            card["nlp_scene_summary"]["summary_inputs"]["description_interrogatives"],
        )

    def test_scene_account_manual_correction_overrides_first_read_prose(self):
        status = self.sample_status()
        status["annotation_corrections"] = {
            "manual_visual_annotations": [
                {
                    "id": "manual-scene-account-1",
                    "category": "Scene",
                    "subcategory": "mise-en-scene scene account correction",
                    "label": "Mise-en-scene scene account correction",
                    "open_note": "A researcher-led interview frames an urgent production problem.",
                    "start_seconds": 43.0,
                    "end_seconds": 69.0,
                    "metadata_correlation": {
                        "target_type": "scene_card_account",
                        "relation": "overrides",
                    },
                }
            ]
        }

        card = scene_cards.build_mise_en_scene_scene_cards(
            "analysis-1",
            status,
        )["scene_cards"][0]

        self.assertEqual(
            card["prose_sections"]["summary"],
            "A researcher-led interview frames an urgent production problem.",
        )
        self.assertTrue(
            card["nlp_scene_summary"]["summary_inputs"]["manual_scene_account_override"]
        )

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
        self.assertIn("prose_sections", SCENE_CARD_PANEL)
        self.assertIn("Performance / Blocking", SCENE_CARD_PANEL)
        self.assertIn("Meaning / Plot", SCENE_CARD_PANEL)
        self.assertIn("Scene Account Correction", SCENE_CARD_PANEL)
        self.assertIn("scene_card_account", SCENE_CARD_PANEL)


if __name__ == "__main__":
    unittest.main()
