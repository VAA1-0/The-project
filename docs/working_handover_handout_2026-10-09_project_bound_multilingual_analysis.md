# Working Handover: Project-Bound Multilingual Analysis and Panel Hydration

Date: 2026-10-09

Branch: `petteri`

Delivered commit: `ffac6be` (`Harden project-bound multilingual analysis hydration`)

Delivery route: direct plain-Git commit and push to `origin/petteri`, following the established Datascene handover method

## Executive status

This thread prepared and analysed the six-video project `research-test-2-20226-cop30-vids`, repaired project and analysis identity failures, restored correct source-to-panel correspondence, completed all required analysis branches, and hardened multilingual morphology selection.

The material is now project-isolated and source-bound. Svenska YLE uses its own Swedish transcript and Swedish morphology; YLE1 uses Finnish; Tagesthemen uses German; CNN, BBC Newsround, and Al Jazeera use English core. Live completeness summaries reported `full` for all six analyses with zero missing and zero unsurfaced branches at final verification.

Frontend and backend returned HTTP 200 at delivery. The implementation and bug-report changes were pushed to GitHub in commit `ffac6be`.

## Project and upload boundary work

The new COP30 material initially exposed an upload membership defect. Files uploaded while `research-test-2-20226-cop30-vids` was visible were persisted under `bond-cop30-helsinki`; the subsequent metadata save correctly rejected that mismatch with `PROJECT_MEMBERSHIP_MISMATCH`, but the files had already entered the wrong catalogue.

The correction established one atomic project context for upload creation and metadata persistence. The six records were backed up and reassigned to `research-test-2-20226-cop30-vids`. Final catalogue verification showed exactly six analyses in the project and none of them in Bond.

Project-specific morphology configuration was also made durable. The pre-analysis setup supports three additional morphology slots, and the full language catalogue is presented alphabetically. The workshop configuration used Finnish, German, and Swedish alongside English core.

## Confirmed transcript-boundary defect

The most serious data-matching failure was canonical rather than merely visual. Five non-Finnish records pointed these fields at the Finnish YLE1 raw Whisper artifact:

- `transcript`;
- `raw_whisper_transcript`;
- `operational_transcript`;
- `language_analysis_parity`.

The authoritative-transcript resolver recursively searched the shared transcript directory and ranked timing authority before proving artifact ownership. A timing-valid transcript belonging to another analysis could therefore become operational truth.

The permanent guard now requires the analysis UUID in the candidate artifact path or payload. A foreign timing-authoritative artifact is rejected and logged. The focused regression contract proves that an own-analysis artifact outranks a foreign record pointer.

## Svenska YLE correction

Svenska YLE had two separate problems:

1. its operational transcript pointer had crossed into Finnish YLE1;
2. its own first automatic transcript was labelled Finnish and contained malformed mixed-language text.

The source audio was retranscribed with Swedish constrained. The corrected artifact contains 30 source-timed Swedish segments and opens with `FN:s klimatmöte ...`. The following dependent layers were then rebuilt from the corrected operational clock:

- linked transcript;
- audio prosody;
- audio event intervals;
- speaker diarization;
- audio sample clouds;
- time-bank audio;
- POS analysis;
- Quant analysis;
- language-analysis parity;
- dependency/SFL;
- multimodal meaning;
- second-order and narrative readings;
- source-media derived metadata;
- full-analysis manifest.

A final projection mismatch was also corrected. The regenerated audio-event artifact contained 15 intervals while the embedded panel projection retained 13. Transcript-dependent rebuilding now updates both the persisted artifact and `results.audio_analysis.audio_event_intervals` together.

## Source and panel synchronization

Canonical data repair alone did not explain every screenshot. `SpeechToTextPanel` also allowed an older asynchronous load to finish after the analyst selected another video. A slow BBC or Bond response could overwrite a newly selected German or Swedish panel.

Transcript-panel hydration now carries a cancellation guard. When `videoId` or refresh generation changes, responses belonging to the superseded selection cannot update metadata, media, transcript, raw CSV, loading, or error state. This closes the visible source/panel disparity that had made correct backend records appear mixed.

## Distributed language and morphology selection

Morphology selection no longer depends on the first sentences or an unexamined whole-file hint.

The transcript array is divided into as many as nine evenly distributed timeline buckets. In each bucket, the median segment and its immediate neighbours form a representative sample. Language evidence is aggregated across the sampled timeline. A strong distributed result may override a conflicting Whisper hint, and the disagreement remains recorded through the language-profile source field.

The profile records detected language volumes and routes as many as three significant volumes inside the same analysis:

- primary;
- secondary;
- tertiary.

Secondary and tertiary volumes currently require at least 12% of recognized sampled tokens and evidence in at least two distributed samples. Existing analyst-selected morphology slots remain explicit and retain their order. A detected language uses its configured slot when available; otherwise it receives a traceable `analysis_associated_morphology` route. English continues to use English core.

Sparse or inconclusive distributed evidence does not leave the morphology empty. Datascene falls back to the governed whole-file language and labels the association source `whole_file_language_fallback`. BBC Newsround exercised this path during the existing-project refresh.

## Six-analysis final state

| Analysis | Language | Morphology route | Completeness |
| --- | --- | --- | --- |
| YLE Svenska | Swedish (`sv`) | configured Swedish slot | full |
| YLE 1 Suomi | Finnish (`fi`) | configured Finnish slot | full |
| Tagesthemen 1 ger | German (`de`) | configured German slot | full |
| CNN | English (`en`) | English core | full |
| BBC Newsround | English (`en`) | English core, whole-file fallback provenance | full |
| Al Jazeera | English (`en`) | English core | full |

The scoped completeness endpoint computed missing shot boundaries, spatial-tone measurement, adaptive visual measurement, and native relational/statistical interpretation without discarding completed object, OCR, expression, audio, transcript, or analyst arrays. Final live summaries returned zero missing and zero unsurfaced branches for every analysis.

The affected analysis directories were searched for the Bond analysis UUID and `NO_TIME_TO_DIE`/`James_Bond` names after repair. No foreign match remained.

## Bug-report record

The systemic project-boundary report now includes the October recurrence and its complete failure chain:

- upload/project bleeding;
- cross-analysis transcript promotion;
- wrong associated language profile;
- source/panel asynchronous disparity;
- artifact/projection mismatch;
- delivered mitigations;
- verification evidence;
- residual multilingual limitation.

See `docs/bug_report_2026-10-01_systemic_meta_bleeding_project_boundary.md`.

## Repair and recovery tooling

Two reusable scripts were added:

- `scripts/repair_project_transcript_boundaries.py` repairs foreign transcript pointers within one governed project and rebuilds dependent language artifacts;
- `scripts/refresh_project_language_profiles.py` recalculates timeline-distributed language profiles and associated morphology routing for all analyses in one project.

Backups were written before record or transcript migration. They remain local under `backups/` and were deliberately excluded from Git.

## Acceptance evidence

Before the final push:

- focused backend project/language/transcript contracts: **8 passed**;
- focused frontend runtime-load governance contracts: **13 passed**;
- frontend TypeScript: passed;
- distributed-language and morphology contracts alone: **6 passed**;
- cross-analysis transcript-boundary regression: passed;
- live project catalogue: exactly six completed analyses;
- final live completeness: six of six `full`;
- final live service checks: backend 200, frontend 200.

The broader frontend source-contract suite was not represented as wholly green. Earlier sampling in this thread showed unrelated legacy assertion failures. They remain outside this scoped delivery and must be classified when their corresponding feature areas are reopened.

## Principal implementation locations

- `api_server.py`
- `src/backend/analysis/language_utils.py`
- `src/backend/analysis/language_pack_policy.py`
- `src/backend/analysis/morphology_catalog.py`
- `src/backend/analysis/pipeline_audio_text.py`
- `src/frontend/app/V2components/components/MenuBar.tsx`
- `src/frontend/app/V2components/components/panels/ProjectPanel.tsx`
- `src/frontend/app/V2components/components/panels/SpeechToTextPanel.tsx`
- `src/frontend/app/V2components/components/panels/ToolsPanel.tsx`
- `src/frontend/lib/morphology-configuration.ts`
- `src/frontend/lib/morphology-language-packs.ts`
- `scripts/repair_project_transcript_boundaries.py`
- `scripts/refresh_project_language_profiles.py`
- `tests/test_language_pack_policy.py`
- `tests/test_project_catalogue_filter_contract.py`
- `tests/test_transcript_analysis_boundary.py`

## Deliberately excluded local material

The following unrelated or generated workspace material remained outside commit `ffac6be` and should not be swept into a future delivery without a separate request:

- investor-deck binary and generator changes;
- `docs/board_meeting/` and `docs/figures/`;
- board/archive slide generators;
- `node_modules/.package-lock.json`;
- `backups/`;
- `docs/.Rhistory`;
- root-level scratch `AudioPanel.tsx`;
- malformed deleted `run_vaa1_lite.sh"` entry.

## Residual limitation

The new detection operates on distributed transcript buckets, not on word-level language identification. It can identify significant language volumes and route up to three associated morphologies, but a short code-switch below the threshold may remain under the primary morphology. Word- or utterance-level multilingual tagging, morphology-specific per-segment POS execution, and analyst review controls for detected language boundaries remain future enhancements. Do not describe those as already delivered.

Detach-to-a-second-screen also remains a manual multi-monitor acceptance item from the preceding panel-UI work.

## Recommended next production sequence

1. Manually inspect the six workshop sources in the running dashboard, especially Svenska, Finnish YLE1, and Tagesthemen transcript/morphology surfaces.
2. Add a compact analyst-facing language-volume disclosure showing sampled regions, shares, provenance, and associated morphology routing.
3. Add analyst confirmation/correction for primary, secondary, and tertiary language boundaries before implementing word- or utterance-level multilingual morphology.
4. Generate and inspect the printable Chapter 5 corpus report using these six now-isolated, full analyses.
5. Continue the highest-impact General Sprint item needed for the workshop while preserving project tickets, source-clock authority, mature-data precedence, and fail-closed hydration.

## Suggested opening prompt for the next thread

```text
Continue from docs/working_handover_handout_2026-10-09_project_bound_multilingual_analysis.md on branch petteri. Treat commit ffac6be, the six isolated full COP30 analyses, own-analysis transcript authority, stale panel-load cancellation, three morphology slots, and timeline-distributed language profiling as delivered. First inspect the analyst-facing language/morphology surfaces and add a compact language-volume review disclosure if still absent. Then generate and manually inspect the Chapter 5 workshop report. Preserve Global Clock authority, project isolation, analyst data, canonical artifact precedence, and the rule that short code-switch detection remains a candidate until reviewed.
```
