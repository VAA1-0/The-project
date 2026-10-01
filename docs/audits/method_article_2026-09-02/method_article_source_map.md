# Method-article claim-to-source map

| Candidate article claim | Repository evidence | Principal status | Confidence | Permissible wording |
|---|---|---|---|---|
| Datascene is a local multimodal video-analysis workbench | `README.md`, lines 1–54; `api_server.py`, lines 241–286; `LayoutHost.tsx`, lines 189–287 | IMPLEMENTED_AND_TESTED | HIGH | “The audited system runs as a local FastAPI and Next.js workbench.” |
| Analyses persist as source-owned records | `api_server.py`, lines 428–484 | IMPLEMENTED_NOT_ADEQUATELY_TESTED | HIGH | “Records include lightweight project ownership metadata”; do not claim lossless restoration universally. |
| The clock normalizes evidence to source-relative seconds | `source_clock_authority.py`, lines 27–99 | IMPLEMENTED_AND_TESTED | HIGH | Add that legacy millisecond envelopes remain (`timestamp_schema.py`, lines 18–150). |
| Whisper preserves word/segment timestamps | `pipeline_audio_text.py`, lines 106–249; timing guard tests lines 30–386 | IMPLEMENTED_AND_TESTED | HIGH | “The pipeline preserves and contract-tests source-relative timestamps,” not “timestamps are error-free.” |
| Visual evidence uses YOLO, EasyOCR and DeepFace | `pipeline_video_frames.py`, lines 213–453; `expression_detector.py`, lines 129–192 | IMPLEMENTED_NOT_ADEQUATELY_TESTED | HIGH | Name components and thresholds; report accuracy as unevaluated. |
| Human authority controls canonical interpretation | `decision_ledger.py`, lines 89–251; boundary tests lines 11–29 | IMPLEMENTED_AND_TESTED | HIGH | Strong claim. |
| Current state is projected without mutating raw evidence | `projected_state.py`, lines 140–336 | IMPLEMENTED_AND_TESTED | HIGH | Strong claim. |
| Confirmed evidence can refresh multiple consumers | `api_server.py`, lines 13724–13755; live-bus tests lines 27–834 | IMPLEMENTED_AND_TESTED | HIGH | Describe governance/control flow, not recognition accuracy. |
| Narrative Agent twins combine seven evidence families | `narrative_agent_digital_twin.py`, lines 16–60, 263–433 | PARTIALLY_IMPLEMENTED | HIGH | “The schema and builder combine…”; not “the model learns robust twins.” |
| Speaker attribution is automated | overlap assignment at `pipeline_audio_text.py`, lines 141–161; unavailable diarization default lines 21–55 | PARTIALLY_IMPLEMENTED | HIGH | “Temporal overlap and manual confirmation support candidate attribution.” |
| Native statistics prevents overstatement | `native_statistical_interpretation.py`, around line 182; tests lines 39–94 | IMPLEMENTED_AND_TESTED | HIGH | “Guards reject specified invalid inputs and label robust z descriptively.” |
| Reports require evidence and traceback | `governed_reporting.py`, lines 78–176; tests lines 20–73 | IMPLEMENTED_AND_TESTED | HIGH | Strong claim. |
| Publications are deterministic/checksummed | `data_book_publication.py`, lines 330–390; tests lines 26–74 | IMPLEMENTED_AND_TESTED | HIGH | Limit to package generation under the tested fixtures. |
| Runtime can recover interrupted work | `analysis_recovery.py`, lines 15–113; recovery tests lines 8–45 | IMPLEMENTED_AND_TESTED | HIGH | “Checkpoint and atomic-write recovery contracts passed”; not universal crash consistency. |
| All 15 analysis branches are complete | `full_analysis_manifest.py`, lines 13–37 and 281–335 | PARTIALLY_IMPLEMENTED | HIGH | Report branch-specific manifest states; contradiction resolution is unsupported. |
| Datascene contains a trained Qwen/learning model | no executable source found | PLANNED | HIGH | Do not claim implementation. |

## Test evidence used

The 2026-09-02 backend audit ran the contract files for decision ledger, canonical boundary, projected state, clock/timing, proliferation/live bus, recovery/hydration, publication/reporting/traceback, native statistics, scene cards, Narrative Agent twins/recognition, diarization and prosody: 135 tests and 8 subtests passed. The frontend `node --test tests/*.test.mjs` suite was executed and failed; individual green frontend contracts may be cited, but the UI as a whole must not be called regression-clean.

## Historical/limitation sources

- `docs/bug_report_2026-08-31_project_mixup_and_restored_annotation_hydration.md`: project ownership, preview/artifact and annotation hydration incident.
- `docs/datascene_full_project_integrity_scan_2026-08-31.md`: restored-data completeness scan.
- `docs/vaa1_bond_trailer_transcript_timestamp_bug_report_2026-04-10.md`: transcript timestamp incident.
- `docs/vaa1_transcript_timing_authority_bug_report_2026-06-05.md`: authority regression and mitigations.
- `docs/vaa1_transcript_audio_master_clock_rca_2026-07-08.md`: master-clock root-cause analysis.

These reports document observed risk and remediation history. They are not substitutes for current regression results.
