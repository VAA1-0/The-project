import json
import tempfile
import unittest
from pathlib import Path

from api_server import (
    build_source_media_metadata_payload,
    dedupe_web_metadata_sources,
    extract_embedded_media_metadata,
    parse_web_metadata_html,
)


class SourceMediaMetadataContractTest(unittest.TestCase):
    def test_web_metadata_html_parser_returns_governed_candidates_with_retrieval_time(self):
        retrieved_at = "2026-05-14T12:34:56+00:00"
        payload = parse_web_metadata_html(
            """
            <html>
              <head>
                <title>Example film page</title>
                <meta name="description" content="A short synopsis about a mission.">
                <meta name="keywords" content="spy, trailer, mission">
                <script type="application/ld+json">
                {
                  "@type": "Movie",
                  "name": "Example film",
                  "actor": [{"name": "Example Actor"}],
                  "contentLocation": {"name": "Matera"},
                  "datePublished": "2021-09-30"
                }
                </script>
              </head>
              <body><p>Visible page text.</p></body>
            </html>
            """,
            "https://example.test/film",
            retrieved_at,
        )

        fields = payload["fields"]
        candidates = payload["candidates"]

        self.assertEqual(fields["retrieved_at"], retrieved_at)
        self.assertEqual(fields["source_url"], "https://example.test/film")
        self.assertEqual(fields["title"], "Example film page")
        self.assertIn("Example Actor", fields["persons"])
        self.assertIn("Matera", fields["places"])
        self.assertIn("2021-09-30", fields["dates"])
        self.assertEqual(fields["genre"], "advertising / promo")
        self.assertEqual(fields["genre_subtype"], "movie trailer")
        self.assertEqual(fields["situational_genre"], "confrontation")
        self.assertTrue(any(candidate["field"] == "description" for candidate in candidates))
        self.assertTrue(any(candidate["field"] == "genre" for candidate in candidates))
        self.assertTrue(any(candidate["field"] == "situational_genre" for candidate in candidates))
        self.assertTrue(all(candidate["retrieved_at"] == retrieved_at for candidate in candidates))

    def test_wikipedia_scrape_reads_article_content_not_source_contributors(self):
        retrieved_at = "2026-05-14T13:09:56.843547+00:00"
        payload = parse_web_metadata_html(
            """
            <html>
              <head>
                <title>No Time to Die - Wikipedia</title>
                <meta name="author" content="Contributors to Wikimedia projects">
                <meta name="dc.date" content="2012-12-27T23:33:31Z">
              </head>
              <body>
                <div class="mw-parser-output">
                  <p><i>No Time to Die</i> is a 2021 spy thriller film and the twenty-fifth film in the James Bond series. The film follows James Bond after he has left active service and is drawn into a mission involving a kidnapped scientist and a dangerous bioweapon.</p>
                  <table class="infobox vevent">
                    <tr><th>Directed by</th><td><a>Cary Joji Fukunaga</a></td></tr>
                    <tr><th>Screenplay by</th><td><a>Neal Purvis</a><br><a>Robert Wade</a><br><a>Phoebe Waller-Bridge</a></td></tr>
                    <tr><th>Starring</th><td><a>Daniel Craig</a><br><a>Lea Seydoux</a><br><a>Rami Malek</a><br><a>Lashana Lynch</a></td></tr>
                    <tr><th>Release dates</th><td>28 September 2021 (Royal Albert Hall)<br>30 September 2021 (United Kingdom)</td></tr>
                    <tr><th>Countries</th><td><a>United Kingdom</a><br><a>United States</a></td></tr>
                  </table>
                  <h2><span id="Cast">Cast</span></h2>
                  <ul>
                    <li><a>Daniel Craig</a> as James Bond: Former MI6 agent.</li>
                    <li><a>Lashana Lynch</a> as Nomi: A new agent assigned the 007 number.</li>
                  </ul>
                  <h2><span id="Plot">Plot</span></h2>
                  <p>Five years later, Bond is living in <a>Jamaica</a> and is asked by the <a>CIA</a> to extract Obruchev from <a>Cuba</a>. Nomi warns him not to interfere with her own extraction. Bond uncovers a weapons plot that threatens civilians and draws him back into the conflict.</p>
                  <h2><span id="Filming">Filming</span></h2>
                  <p>Filming locations included <a>Italy</a>, <a>Jamaica</a>, <a>Norway</a>, the <a>Faroe Islands</a> and <a>London</a>, in addition to <a>Pinewood Studios</a>. In late August 2019, the second unit moved to southern Italy where they began to shoot a chase sequence through the streets of <a>Matera</a>.</p>
                  <h2>References</h2>
                  <a title="Category:2021 films">2021 films</a>
                  <a title="Category:James Bond films">James Bond films</a>
                  <a title="Category:British spy action films">British spy action films</a>
                  <a title="Category:Films set in London">Films set in London</a>
                </div>
              </body>
            </html>
            """,
            "https://en.wikipedia.org/wiki/No_Time_to_Die",
            retrieved_at,
        )

        fields = payload["fields"]

        self.assertIn("Five years later, Bond is living in Jamaica", fields["description"])
        self.assertIn("weapons plot", fields["description"])
        self.assertNotIn("twenty-fifth film in the James Bond series", fields["description"])
        self.assertNotIn("Contributors to Wikimedia projects", fields["persons"])
        self.assertIn("James Bond", fields["persons"])
        self.assertIn("Nomi", fields["persons"])
        self.assertNotIn("Cary Joji Fukunaga", fields["persons"])
        self.assertTrue(any(role["actor"] == "Daniel Craig" for role in fields["character_roles"]))
        self.assertTrue(any(role["person"] == "Cary Joji Fukunaga" for role in fields["production_crew"]))
        self.assertIn("Jamaica", fields["places"])
        self.assertIn("CIA", fields["places"])
        self.assertIn("Five years later", fields["dates"])
        self.assertNotIn("2012-12-27T23:33:31Z", fields["dates"])
        self.assertIn("James Bond films", fields["keywords"])
        self.assertNotIn("British spy action films", fields["keywords"])
        self.assertNotIn("2021 films", fields["keywords"])
        self.assertEqual(fields["genre"], "movie drama / fiction")
        self.assertEqual(fields["genre_subtype"], "action / adventure")
        self.assertEqual(fields["situational_genre"], "confrontation")
        self.assertTrue(any(candidate["selector"].endswith("plot_synopsis") for candidate in payload["candidates"]))

    def test_wikipedia_cast_section_parser_uses_exact_h2_not_toc_mentions(self):
        retrieved_at = "2026-05-15T09:09:51.801376+00:00"
        payload = parse_web_metadata_html(
            """
            <html>
              <body>
                <div id="toc"><a href="#Cast">Cast</a></div>
                <h2 id="Plot">Plot</h2>
                <p>An adolescent <a>Madeleine Swann</a> witnesses violence. In the present day, Bond lives in <a>Jamaica</a>.</p>
                <h2 id="Cast">Cast</h2>
                <ul>
                  <li><a>Daniel Craig</a> as <a>James Bond</a>: Former MI6 agent 007, retired for five years.</li>
                  <li><a>Rami Malek</a> as Lyutsifer Safin: Bioterrorist who becomes Bond's adversary.</li>
                  <li><a>Example Actor</a> as Example Character: A suspect. Producer Someone described the character as "very mysterious".</li>
                </ul>
                <h2 id="Production">Production</h2>
              </body>
            </html>
            """,
            "https://en.wikipedia.org/wiki/No_Time_to_Die",
            retrieved_at,
        )

        roles = payload["fields"]["character_roles"]
        self.assertEqual(len(roles), 3)
        self.assertEqual(roles[0]["character"], "James Bond")
        self.assertIn("protagonist", roles[0]["role"])
        self.assertEqual(roles[1]["character"], "Lyutsifer Safin")
        self.assertIn("antagonist", roles[1]["role"])
        self.assertNotIn("protagonist", roles[1]["role"])
        self.assertEqual(roles[1]["description"], "Bioterrorist scientist; Bond adversary")
        self.assertEqual(roles[2]["description"], "A suspect")

    def test_wikipedia_synopsis_can_use_story_section_without_plot_heading(self):
        payload = parse_web_metadata_html(
            """
            <html>
              <body>
                <p>Example Film is a 1974 feature directed by Example Director and released by Example Studio.</p>
                <h2 id="Story">Story</h2>
                <p>A retired courier discovers a hidden archive and travels to Lisbon to protect a witness from a criminal network.</p>
                <h2 id="Production">Production</h2>
                <p>The film was produced by Example Producer and released in cinemas in 1974.</p>
              </body>
            </html>
            """,
            "https://en.wikipedia.org/wiki/Example_Film",
            "2026-05-15T13:00:00+00:00",
        )

        self.assertIn("retired courier discovers a hidden archive", payload["fields"]["description"])
        self.assertNotIn("released by Example Studio", payload["fields"]["description"])
        self.assertTrue(any(candidate["selector"].endswith("plot_synopsis") for candidate in payload["candidates"]))

    def test_web_metadata_sources_dedupe_by_canonical_url_and_sort_main_first(self):
        sources = [
            {
                "id": "old",
                "url": "https://en.wikipedia.org/wiki/No_Time_to_Die/",
                "retrieved_at": "2026-05-14T13:09:56+00:00",
                "preference": "supporting",
            },
            {
                "id": "background",
                "url": "https://www.imdb.com/title/tt2382320/",
                "retrieved_at": "2026-05-14T13:20:00+00:00",
                "preference": "background",
            },
            {
                "id": "new",
                "url": "https://en.wikipedia.org/wiki/No_Time_to_Die",
                "retrieved_at": "2026-05-14T14:00:00+00:00",
                "preference": "main",
            },
        ]

        deduped = dedupe_web_metadata_sources(sources)

        self.assertEqual([source["id"] for source in deduped], ["new", "background"])
        self.assertEqual(deduped[0]["preference"], "main")

    def test_embedded_media_metadata_keeps_ambiguous_container_tags_out_of_governed_fields(self):
        embedded = extract_embedded_media_metadata(
            {
                "artist": "James Bond 007",
                "compatible_brands": "isomiso6iso2avc1mp41",
                "encoder": "Lavf60.3.100",
                "com.apple.quicktime.make": "DJI",
                "com.apple.quicktime.model": "Mini 4 Pro",
                "com.apple.quicktime.location.ISO6709": "+60.1699+024.9384/",
                "com.apple.quicktime.creationdate": "2026-05-12T10:11:12Z",
                "filmed_by": "Archive Operator",
            }
        )

        self.assertEqual(embedded["filmed_by"], "Archive Operator")
        self.assertEqual(embedded["camera_make"], "DJI")
        self.assertEqual(embedded["camera_model"], "Mini 4 Pro")
        self.assertEqual(embedded["gps_coordinates"], "+60.1699+024.9384/")
        self.assertEqual(embedded["date_time"], "2026-05-12T10:11:12Z")
        self.assertEqual(embedded["software"], "Lavf60.3.100")
        self.assertNotIn("recording_device", embedded)

    def test_ambiguous_artist_tag_does_not_become_filmed_by(self):
        embedded = extract_embedded_media_metadata(
            {
                "artist": "James Bond 007",
                "author": "Trailer channel",
                "compatible_brands": "isomiso6iso2avc1mp41",
            }
        )

        self.assertNotIn("filmed_by", embedded)
        self.assertNotIn("recording_device", embedded)

    def test_stored_media_fact_aliases_survive_metadata_roundtrip(self):
        status = {
            "analysis_id": "analysis-1",
            "original_filename": "trailer.mp4",
            "filename": "stored.mp4",
            "source_media_metadata": {
                "duration_seconds": 155.104,
                "size_bytes": 123456,
                "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
                "container_extension": ".mp4",
                "video_codec": "h264",
                "audio_codec": "aac",
                "has_audio": True,
                "width": 1280,
                "height": 720,
                "fps": 25.0,
                "audio_channels": 2,
                "audio_sample_rate": 48000,
                "recorded_at": "2026-05-12T10:11:12Z",
                "gps_coordinates": "+60.1699+024.9384/",
                "camera_make": "DJI",
                "camera_model": "Mini 4 Pro",
                "recording_device": "drone",
                "recording_software": "DJI Fly",
                "filmed_by": "Archive Operator",
                "user_annotations": {"title": "Manual title"},
            },
        }

        payload = build_source_media_metadata_payload(status)

        self.assertEqual(payload["duration_seconds"], 155.104)
        self.assertEqual(payload["size_bytes"], 123456)
        self.assertEqual(payload["width"], 1280)
        self.assertEqual(payload["height"], 720)
        self.assertEqual(payload["fps"], 25.0)
        self.assertEqual(payload["recorded_at"], "2026-05-12T10:11:12Z")
        self.assertEqual(payload["gps_coordinates"], "+60.1699+024.9384/")
        self.assertEqual(payload["camera_make"], "DJI")
        self.assertEqual(payload["camera_model"], "Mini 4 Pro")
        self.assertEqual(payload["recording_software"], "DJI Fly")
        self.assertEqual(payload["filmed_by"], "Archive Operator")
        self.assertEqual(payload["user_annotations"]["title"], "Manual title")

    def test_source_file_itself_supplies_basic_filesystem_facts(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            source_path = Path(tmpdir) / "source.mp4"
            source_path.write_bytes(b"not a real video but a source file")
            status = {
                "analysis_id": "analysis-1",
                "source_video_path": str(source_path),
                "source_media_annotations": {"description": "Manual description"},
            }

            payload = build_source_media_metadata_payload(status)

            self.assertTrue(payload["source_video_exists"])
            self.assertEqual(payload["container_extension"], ".mp4")
            self.assertEqual(payload["mime_type"], "video/mp4")
            self.assertEqual(payload["size_bytes"], source_path.stat().st_size)
            self.assertEqual(
                payload["user_annotations"]["description"],
                "Manual description",
            )

    def test_manual_metadata_overrides_video_internal_harvest(self):
        status = {
            "analysis_id": "analysis-1",
            "original_filename": "NO_TIME_TO_DIE_Trailer_UK_-_James_Bond_007_720p_h264.mp4",
            "source_media_annotations": {
                "title": "Curated archive title",
                "persons": ["Curated Person"],
                "genre": "curated genre",
            },
            "results": {
                "audio_analysis": {
                    "transcript": {
                        "segments": [
                            {"start": 0, "end": 2, "text": "Where's 007?"},
                        ]
                    }
                },
                "visual_analysis": {
                    "tracked_objects": [
                        {"display_label": "James Bond / person track 2"},
                    ]
                },
            },
        }

        payload = build_source_media_metadata_payload(status)

        self.assertEqual(payload["user_annotations"]["title"], "Curated archive title")
        self.assertEqual(payload["user_annotations"]["persons"], ["Curated Person"])
        self.assertEqual(payload["user_annotations"]["genre"], "curated genre")
        self.assertEqual(payload["annotation_maturity"]["title"]["maturity"], "manual")
        self.assertEqual(
            payload["annotation_maturity"]["title"]["traceback"]["route"],
            "source_media.manual_metadata_governance",
        )

    def test_video_internal_maturity_harvest_consults_shared_evidence_families(self):
        status = {
            "analysis_id": "analysis-1",
            "original_filename": "NO_TIME_TO_DIE_Trailer_UK_-_James_Bond_007_720p_h264.mp4",
            "results": {
                "audio_analysis": {
                    "transcript": {
                        "segments": [
                            {
                                "start": 0,
                                "end": 6,
                                "text": "Why would I betray you? We all have our secrets. Where's 007? The world is arming faster than we can respond.",
                            },
                        ]
                    }
                },
                "visual_analysis": {
                    "tracked_objects": [
                        {"display_label": "James Bond / person track 2"},
                    ],
                    "ocr_results": [
                        {"text": "007"},
                    ],
                    "cinematic_clues": {
                        "shot_type": "close-up",
                        "lighting": "low key interior",
                    },
                },
            },
            "pos_analysis": {
                "interrogative_lens": {
                    "why": ["betrayal"],
                    "where": ["007"],
                },
                "case_profile": {
                    "semantic_role": ["agent", "threat"],
                },
            },
            "dependency_sfl_stage1": {
                "utterance_analyses": [
                    {"speech_function": "question", "process_type": "relational"},
                    {"speech_function": "command", "process_type": "material"},
                ]
            },
            "multimodal_meaning_stage1": {
                "meaning_events": [
                    {"meaning_label": "trust conflict"},
                    {"plot_label": "mission briefing"},
                ]
            },
            "second_order_label_proliferation": {
                "instructions": [
                    {"candidate_label": "threat escalation"},
                ]
            },
            "mise_en_scene_scene_cards": {
                "scene_cards": [
                    {
                        "scene_account": "Bond is framed inside a vehicle while dialogue introduces secrecy, betrayal, and a wider armed threat."
                    }
                ]
            },
            "vaa1_annotation_master_schema": {
                "source_context_snapshot": {
                    "person_name": "James Bond",
                    "genre": "film trailer",
                    "place": "vehicle interior",
                }
            },
        }

        payload = build_source_media_metadata_payload(status)
        annotations = payload["user_annotations"]
        maturity = payload["annotation_maturity"]
        harvest = payload["video_internal_harvest"]

        self.assertIn("NO TIME TO DIE Trailer", annotations["title"])
        self.assertIn("James Bond", annotations["persons"])
        self.assertEqual(annotations["genre"], "trailer")
        self.assertEqual(annotations["genre_subtype"], "spy action")
        self.assertIn("trust", annotations["narrative_development"].lower())
        self.assertIn("question", annotations["interaction_dynamics"].lower())
        self.assertIn("close-up", annotations["performance_expression"])
        self.assertEqual(maturity["description"]["maturity"], "derived_video_internal")
        self.assertIn(
            "pos_grammar_interrogatives_case",
            maturity["description"]["evidence_sources"],
        )
        self.assertIn(
            "dependency_sfl_stage1",
            maturity["description"]["traceback"]["consulted"],
        )
        self.assertIn(
            "mise_en_scene_scene_cards",
            maturity["description"]["traceback"]["consulted"],
        )
        self.assertGreaterEqual(harvest["evidence_counts"]["meaning_terms"], 2)

    def test_web_character_roles_route_through_metadata_maturity(self):
        status = {
            "analysis_id": "analysis-roles",
            "original_filename": "NO_TIME_TO_DIE_Trailer_UK_-_James_Bond_007_720p_h264.mp4",
            "source_media_web_metadata_sources": [
                {
                    "id": "wiki-1",
                    "url": "https://en.wikipedia.org/wiki/No_Time_to_Die",
                    "preference": "main",
                    "retrieved_at": "2026-05-15T08:30:00+00:00",
                    "status": "ok",
                    "fields": {
                        "character_roles": [
                            {
                                "actor": "Daniel Craig",
                                "character": "James Bond / 007",
                                "role": "protagonist, secret agent",
                                "description": "retired MI6 agent drawn back into conflict",
                            },
                        ],
                    },
                }
            ],
        }

        payload = build_source_media_metadata_payload(status)
        annotations = payload["user_annotations"]
        maturity = payload["annotation_maturity"]["character_roles"]
        master_schema = status.get("source_media_video_internal_harvest", {})

        self.assertIn(
            "James Bond / 007 (Daniel Craig): protagonist, secret agent; retired MI6 agent",
            annotations["character_roles"][0],
        )
        self.assertEqual(
            annotations["character_definitions"][0]["character_name"],
            "James Bond / 007",
        )
        self.assertEqual(
            annotations["character_definitions"][0]["actor_name"],
            "Daniel Craig",
        )
        self.assertIn(
            "protagonist",
            annotations["character_definitions"][0]["role_labels"],
        )
        self.assertEqual(
            annotations["character_definitions"][0]["constituent_evidence"]["actor_name"]["source_field"],
            "fields.character_roles.actor",
        )
        self.assertEqual(
            annotations["character_definitions"][0]["profile_governance"]["profile_type"],
            "Narrative Agent Profile",
        )
        self.assertIn(
            "not natural person identity profiles",
            annotations["character_definitions"][0]["profile_governance"]["identity_boundary"].lower(),
        )
        self.assertIn(
            "performed, destabilized",
            annotations["character_definitions"][0]["profile_governance"]["shakespearean_modality_note"],
        )
        self.assertIn("James Bond / 007", annotations["persons"])
        self.assertIn("Daniel Craig", annotations["persons"])
        self.assertEqual(maturity["maturity"], "derived_external_metadata")
        self.assertEqual(
            maturity["traceback"]["route"],
            "master_schema.source_media_character_role_maturity",
        )
        self.assertEqual(master_schema["evidence_counts"]["character_roles"], 1)
        self.assertEqual(master_schema["evidence_counts"]["character_definitions"], 1)

    def test_video_internal_maturity_harvest_reads_import_artifact_aliases(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            tracked_path = tmp / "tracked_objects.json"
            tracked_path.write_text(
                json.dumps(
                    {
                        "objects": [
                            {"display_label": "James Bond / person track 2"},
                            {"display_label": "vehicle / car track 4"},
                        ]
                    }
                ),
                encoding="utf-8",
            )
            ocr_path = tmp / "time_bank_ocr.json"
            ocr_path.write_text(
                json.dumps(
                    {
                        "objects": [
                            {"text": "007.com"},
                            {"text": "APRIL 2"},
                        ],
                        "anchors": [
                            {"time": 1.0},
                            {"time": 154.0},
                        ],
                    }
                ),
                encoding="utf-8",
            )
            status = {
                "analysis_id": "analysis-aliases",
                "original_filename": "NO_TIME_TO_DIE_Trailer_UK_-_James_Bond_007_720p_h264.mp4",
                "source_media_metadata": {"duration_seconds": 155.0},
                "results": {
                    "audio_analysis": {
                        "transcript": {
                            "segments": [
                                {
                                    "start": 0,
                                    "end": 6,
                                    "text": "Where's 007? The world is arming faster than we can respond.",
                                }
                            ]
                        }
                    }
                },
                "output_files": {
                    "tracked_objects_json": str(tracked_path),
                    "time_bank_ocr": str(ocr_path),
                },
            }

            payload = build_source_media_metadata_payload(status)
            annotations = payload["user_annotations"]
            harvest = payload["video_internal_harvest"]

            self.assertIn("James Bond", annotations["persons"])
            self.assertIn("007.com", annotations["source_context"])
            self.assertGreaterEqual(harvest["evidence_counts"]["tracked_objects"], 2)
            self.assertGreaterEqual(harvest["evidence_counts"]["ocr_items"], 2)

    def test_beginning_and_end_title_ocr_feeds_metadata_with_traceback(self):
        status = {
            "analysis_id": "analysis-1",
            "original_filename": "archive_clip.mp4",
            "source_media_metadata": {"duration_seconds": 100.0},
            "results": {
                "visual_analysis": {
                    "ocr_results": [
                        {"timestamp_seconds": 2, "text": "A FILM BY EXAMPLE ARCHIVE"},
                        {"timestamp_seconds": 5, "text": "HELSINKI 1977"},
                        {"timestamp_seconds": 96, "text": "Directed by Aino Editor"},
                        {"timestamp_seconds": 98, "text": "Camera Matti Operator"},
                    ],
                },
            },
        }

        payload = build_source_media_metadata_payload(status)
        annotations = payload["user_annotations"]
        maturity = payload["annotation_maturity"]
        harvest = payload["video_internal_harvest"]

        self.assertIn("Beginning/end OCR", annotations["source_context"])
        self.assertIn("A FILM BY EXAMPLE ARCHIVE", annotations["description"])
        self.assertIn("Directed by Aino Editor", annotations["description"])
        self.assertIn("Directed by Aino Editor", annotations["persons"])
        self.assertIn("beginning_end_title_ocr", maturity["description"]["evidence_sources"])
        self.assertIn(
            "beginning_end_title_ocr",
            maturity["source_context"]["traceback"]["consulted"],
        )
        self.assertEqual(harvest["evidence_counts"]["beginning_ocr_items"], 2)
        self.assertEqual(harvest["evidence_counts"]["ending_ocr_items"], 2)

    def test_time_bank_ocr_anchor_object_pairs_feed_source_context(self):
        status = {
            "analysis_id": "analysis-1",
            "original_filename": "archive_clip.mp4",
            "source_media_metadata": {"duration_seconds": 100.0},
            "results": {
                "visual_analysis": {
                    "ocr_results": {
                        "anchors": [
                            {"t_start_ms": 1000},
                            {"t_start_ms": 98000},
                        ],
                        "objects": [
                            {"text": "OPENING TITLE"},
                            {"text": "Directed by Aino Editor"},
                        ],
                    },
                },
            },
        }

        payload = build_source_media_metadata_payload(status)
        annotations = payload["user_annotations"]
        harvest = payload["video_internal_harvest"]

        self.assertIn("Beginning/end OCR", annotations["source_context"])
        self.assertIn("OPENING TITLE", annotations["source_context"])
        self.assertIn("Directed by Aino Editor", annotations["source_context"])
        self.assertEqual(harvest["evidence_counts"]["beginning_ocr_items"], 1)
        self.assertEqual(harvest["evidence_counts"]["ending_ocr_items"], 1)


if __name__ == "__main__":
    unittest.main()
