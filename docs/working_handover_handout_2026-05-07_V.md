# VAA1 Working Handover Handout V

Date: 2026-05-07

## 1. Session Focus

Today focused on the Mise-en-Scene Scene Card feature and on making VAA1 more mature about
downloadable derived artifacts.

The practical issue was:

- Scene Card outputs existed but were hard to recognize in the UI/downloads.
- Some completed videos showed important files as missing.
- Several missing files were not truly impossible; VAA1 already had enough stored evidence to
  derive them.
- The platform should not ask for a full new analysis when a completed analysis can be repaired
  or backfilled from existing outputs.

The working principle became:

> completed analysis -> refresh status -> repair registrations -> backfill all derivable artifacts -> do not rerun sensors unless genuinely needed

## 2. Scene Card Work

Primary backend file:

- `src/backend/analysis/mise_en_scene_scene_card.py`

Primary test:

- `tests/test_mise_en_scene_scene_card_contract.py`

The Scene Card report now produces:

- top-level `title: "Mise-en-Scene Scene Card Report"`
- top-level `artifact_type: "mise_en_scene_scene_card_report"`
- individual card titles such as `Scene Card 001`
- `display_title` such as `Mise-en-Scene Scene Card 001`
- exact speech in `said_in_scene`
- ontology facets for persons, places, speech, situations, events, themes, props, costume,
  actions, cinematic cues, genre form, and subject domain
- linked navigation payloads back to VAA1 panels and time anchors
- manual-correction authority policy

The paired metadata summary now produces:

- `title: "Scene Card Source Extraction Metadata Summary"`
- `artifact_type: "scene_card_source_extraction_metadata_summary"`
- source metadata preserved as unchanged input
- derived summary/facets that can later feed archive metadata without diluting original metadata

## 3. Download Naming

The Download panel and API download filenames were clarified.

Important visible labels:

- `Scene Card Report`
- `Scene Card Metadata Summary`

Download filenames now include:

- `mise_en_scene_scene_card_report.json`
- `scene_card_source_extraction_metadata_summary.json`

This was prompted by the manual test where the user had downloaded:

- `..._scene_cards.json`
- `..._extraction_metadata_summary.json`

and correctly noted that the title should explicitly say Scene Card.

## 4. Iterative Backfill

Primary backend file:

- `api_server.py`

New status-refresh behavior:

- `write_iterative_derived_artifacts_for_status`
- `normalize_imported_output_files_for_status`
- `write_tracked_objects_fallback_from_yolo_if_needed`
- `write_iterative_audio_identity_artifacts_for_status`
- `write_iterative_matrix_artifacts_for_status`

The completed status endpoint now attempts to repair/backfill derivable outputs when an analysis is
opened.

Backfillable artifacts include:

- linked transcript / Time Bank Transcript registration repair
- tracked objects CSV/JSON from YOLO detections when tracking output is absent
- audio diarization scaffold from audio + transcript
- audio sample clouds from diarization
- identity triangulation from visual/audio/manual evidence
- POS matrix from POS analysis
- Quant matrix from Quant analysis
- Dependency SFL Stage 1 from transcript
- Multimodal Meaning Stage 1 from SFL + visual/audio metadata
- Second-order Label Proliferation from multimodal meaning
- Scene Card Report
- Scene Card Source Extraction Metadata Summary

Face Manifest intentionally remains absent unless face anonymization was engaged.

## 5. Manual Test Evidence

Galaxy Song analysis:

- Audio Diarization Scaffold surfaced.
- Audio Sample Clouds surfaced.
- Identity Triangulation surfaced.
- POS Matrix surfaced.
- Quant Matrix surfaced.
- Face Manifest stayed absent because anonymization was not enabled.

No Time To Die analysis:

- Time Bank Transcript / linked transcript repaired.
- Dependency SFL Stage 1 surfaced.
- Multimodal Meaning Stage 1 surfaced.
- Second-order Label Proliferation surfaced.
- Face Manifest stayed absent because anonymization was not enabled.

VAA1 checkpoint video:

- Tracked Objects CSV surfaced.
- Tracked Objects JSON surfaced.
- Face Manifest stayed absent because anonymization was not enabled.

The No Time To Die case revealed a concrete import bug:

- imported `linked_transcript.json` could be registered as `transcript`
- this blocked transcript-led derivations
- status refresh now repairs that channel registration

The checkpoint case revealed a different issue:

- YOLO detections existed
- separate tracked-object artifacts were missing
- VAA1 now creates explicit untracked-object fallback artifacts with
  `tracking_status: "not_tracked_yolo_detection_fallback"`

## 6. Regression Test Added

Primary test file:

- `tests/test_face_backend_contract.py`

New test:

- `test_completed_status_repairs_and_backfills_derivable_downloads`

The test builds a deliberately broken completed analysis:

- linked transcript registered as transcript
- YOLO CSV present but tracked-object artifacts absent
- POS and Quant analyses present but matrices absent
- audio/transcript/prosody present but audio identity artifacts absent

It then opens analysis status and verifies:

- registration repair
- all derivable files exist on disk
- all derivable files are exposed through `download_links`
- tracked-object fallback marks the provenance clearly
- Scene Card files are produced
- Face Manifest remains absent when anonymization was not engaged

## 7. Verification Run

Passed:

```bash
conda run -n vaa1_core python -m py_compile api_server.py
conda run -n vaa1_core python -m unittest \
  tests.test_face_backend_contract.ApiServerContractTests \
  tests.test_mise_en_scene_scene_card_contract \
  tests.test_second_order_pipeline_wiring_contract \
  tests.test_audio_diarization_contract \
  tests.test_audio_sample_cloud_contract \
  tests.test_identity_triangulation_contract
```

Result:

- 32 tests passed.

Known harmless local warning:

- Ultralytics tries to write settings/cache under `/Users/admin/Library/Application Support`
- sandbox denies that write
- tests still pass

## 8. Running State

VAA1 was restarted with:

```bash
bash scripts/start_vaa1_macos.sh --replace
```

Expected URLs:

- backend health: `http://127.0.0.1:8000/api/health`
- frontend dashboard: `http://127.0.0.1:3001/dashboard`

## 9. Git Recommendation

Do not push blindly tonight.

The worktree contains several connected but broad changes:

- Scene Card backend and tests
- iterative derived artifact backfill
- download panel availability semantics
- import repair
- tracked-object fallback
- evidence proliferation work from the previous session
- frontend panel changes
- docs and startup script

Recommended tomorrow:

1. Restart VAA1.
2. Open Galaxy Song, No Time To Die, and the checkpoint video.
3. Confirm the Download panel still shows repaired/backfilled outputs.
4. Run the focused test sequence again.
5. Review `git diff --stat`.
6. Decide whether to make one checkpoint PR or split into smaller PRs.

Likely split:

- PR 1: Scene Card Report + source extraction metadata summary
- PR 2: iterative downloadable artifact backfill and import repair
- PR 3: evidence proliferation / closest match UI work

## 10. Tomorrow's Best Next Step

Start with a calm review of `api_server.py`, because it now carries the core lifecycle behavior.

The most important question:

> Are all derivable artifacts regenerated from existing evidence without pretending that optional runtime artifacts were actually run?

The current answer is yes, but that is the right place to review first before Git.

## 11. Mental Bookmark

The product maturity target is:

VAA1 should act like a careful archive workstation.

If evidence already exists, VAA1 should organize it, repair it, expose it, and explain its status.
It should not make the user rerun a whole video just because a secondary artifact was not written
the first time.
