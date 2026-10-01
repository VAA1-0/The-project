# Datascene Full-Analysis Robustness — Thread Handover

Date: 2026-08-28

## Purpose

This handout closes the full-analysis robustness thread and provides a clean starting point for the next Datascene conversation.

The sprint began after completed videos displayed partial StatsKit maturity radars and, in some cases, a transcript without accessible POS or Quant evidence. The core problem was not simply missing analysis output. Datascene lacked a durable contract proving that each expected branch had:

1. a canonical artifact;
2. matching runtime hydration;
3. an explicit consumer route in the UI;
4. a recoverable action when any part was absent or inconsistent.

The sprint replaced optimistic “completed” status with evidence-backed completeness.

## Delivered outcome

All seven current Marcella analyses now have 100.0% strict verified coverage across all 15 required branches:

- Transcript
- Linked transcript
- POS analysis
- Quant analysis
- Audio prosody
- Audio event intervals
- Speaker diarization
- Audio sample clouds
- Tracked objects
- OCR
- Expressions
- Shot boundaries
- Color / brightness / contrast
- Adaptive visual measurement
- Relational connectivity

The completeness result is based on artifact, hydration, and consumer verification. It is not inferred from a generic analysis-completed flag.

Contradiction resolution remains an explicitly unsupported platform capability and is not falsely scored as a failed or zero-valued analysis branch.

## Verified corpus

| Video | Analysis ID | Final verified coverage |
| --- | --- | ---: |
| 1 — Spirituality | `00c22625-82e8-4ddc-bb36-317422664214` | 100.0% |
| 2 — Business | `c034341f-3fba-495e-a7d1-0af03a46cb6c` | 100.0% |
| 3 — Technology | `ca6d0ebf-cbb5-4f7e-8502-f8b0693daf33` | 100.0% |
| 4 — Health | `e9cffc4c-275b-4dcb-b475-600b3c9ac2d7` | 100.0% |
| 5 — Time | `2368228a-f46d-4339-bf7b-5f1966a33ee5` | 100.0% |
| 6 — Space | `fe2c60ec-94b2-4fcd-82d4-34ea7a4f4dd8` | 100.0% |
| 7 — Vision | `ac1af180-df4a-41cd-aed9-c79b91329197` | 100.0% |

Video 2’s live bounded status summary reported:

- overall state: `full`
- computed branches: 15/15
- missing branches: 0
- delivery percentage: 100.0%

## Sustainable model for future analyses

The delivery is not limited to migrated saved records.

Future analyses and completeness refreshes now use the same governed path:

1. Analysis producers write canonical artifacts.
2. Runtime loading hydrates the registered artifacts and favors canonical evidence over stale embedded payloads.
3. Language, visual, and audio parity evaluators record exact row counts and consumer routes.
4. The full-analysis manifest compares canonical rows, hydrated rows, and UI delivery.
5. A branch is counted as computed only when its complete parity contract passes.
6. The Project and panel-level UI can name missing branches and request scoped repair.
7. Refresh operations reuse and re-project valid artifacts before considering expensive recomputation.

The parity records are:

- `vaa1.language_analysis_parity.v1`
- `vaa1.visual_analysis_parity.v1`
- `vaa1.audio_analysis_parity.v1`
- `vaa1.full_analysis_manifest.v1`

## Important reconciliation decisions

### Language evidence

Transcript, linked transcript, POS, and Quant were validated across the corpus. Token agreement ranged from 99.2% to 100.0%; Video 2 measured 99.7%.

The manifest supports both embedded POS/Quant payloads and registered artifact paths, preventing path-based hydration from being mistaken for missing data.

### Visual evidence

Objects, OCR, and Expressions now require row parity and explicit UI consumers.

For Video 2, the verified live counts were:

- tracked objects: 143
- OCR rows: 390
- expression rows: 713

### Audio evidence

Prosody, event intervals, diarization, and sample clouds now share an audio parity contract.

Video 1 exposed a real stale-artifact mismatch. Its hydrated evidence contained 51 prosody cues and 97 audio-event intervals, while the registered files contained older subsets of 34 and 91. The canonical files were reconciled to the newer valid hydrated evidence before the branch was accepted.

Video 2’s verified live audio counts were:

- prosody cues: 79
- event intervals: 131
- diarization turns: 79
- sample clouds: 5

### Shot boundaries and relational connectivity

Six videos already contained hydrated shot intervals but lacked canonical registration. Those intervals were registered without recomputing the underlying measurements.

Video 2 alone lacked a relational-connectivity artifact. A governed native statistical interpretation was run and persisted, producing 11 relationships with an operational StatsKit route.

## UI direction established in this thread

The key interaction principle is:

> An indication that something needs attention must expose the actual evidence and a direct action, not merely point toward a collapsed or silent panel.

The language meta view now provides:

- percentage-based readiness;
- readable radar presentation;
- explicit attention items;
- direct expansion/navigation behavior;
- the underlying POS taxonomy-review data rather than only a meta warning.

The same principle should govern future readiness indicators across Datascene.

## Main implementation files

Backend contracts and orchestration:

- `api_server.py`
- `src/backend/analysis/full_analysis_manifest.py`
- `src/backend/analysis/language_analysis_parity.py`
- `src/backend/analysis/visual_analysis_parity.py`
- `src/backend/analysis/audio_analysis_parity.py`
- `src/backend/analysis/saved_analysis_hydration_loader.py`
- `src/backend/analysis/pos_analysis.py`

Frontend completeness and language surfaces:

- `src/frontend/app/V2components/components/LanguageParityMetaView.tsx`
- `src/frontend/app/V2components/components/panels/ProjectPanel.tsx`
- `src/frontend/app/V2components/components/panels/SpeechToTextPanel.tsx`
- `src/frontend/app/V2components/components/panels/POSAnalyzePanel.tsx`
- `src/frontend/app/V2components/components/panels/QuantitativeAnalysisPanel.tsx`
- `src/frontend/app/V2components/components/panels/StatsKitPanel.tsx`
- `src/frontend/lib/api-service.ts`
- `src/frontend/lib/video-service.ts`

Tests and schemas:

- `docs/schemas/vaa1.full_analysis_manifest.v1.schema.json`
- `tests/test_analysis_completeness_navigation_contract.py`
- `tests/test_language_analysis_parity.py`
- `tests/test_visual_analysis_parity.py`
- `tests/test_audio_analysis_parity.py`
- `tests/test_saved_analysis_hydration_loader.py`
- `src/frontend/tests/analysis-completeness-navigation.test.mjs`
- `src/frontend/tests/statskit-full-analysis-readiness.test.mjs`

Sprint documentation:

- `docs/bug_report_2026-08-24_statskit_maturity_radar_partial_analysis.md`
- `docs/vaa1_sprint_full_analysis_robustness_2026-08-25.md`
- `docs/vaa1_full_analysis_robustness_progress_2026-08-25.md`
- `docs/vaa1_contradiction_resolution_decision_2026-08-25.md`

## Validation completed

Final scoped validation before delivery:

- backend robustness tests: 15/15 passed;
- frontend completeness contracts: 4/4 passed;
- all seven manifests: 100.0%, state `full`, no blocking reasons;
- backend health endpoint: healthy;
- frontend dashboard: HTTP 200.

The Python warning concerning deprecated `pkg_resources` in MTCNN is an environment dependency warning and did not fail the tests.

## Runtime monitoring, interruption recovery, and delivery robustness

This thread also inherited and used an earlier runtime-hardening stream. It is related to the completeness sprint but has a separate delivery boundary.

### Runtime analysis and incident findings

The runtime work established that a single unchanged percentage or low parent-process CPU sample is not proof of a stalled analysis. Face work may run in short-lived subprocesses, and macOS sleep/wake cycles can suspend visible progress without invalidating the checkpoint.

Before restarting an active analysis, inspect:

1. two or more persisted progress or heartbeat samples over an appropriate interval;
2. the active stage and progress cursor;
3. child-worker state;
4. checkpoint modification time and `next_index`;
5. event-log movement;
6. macOS sleep/wake history.

The intended runtime vocabulary distinguishes `running`, `sleep-suspended`, `cooling`, `worker-timeout`, `stalled`, `interrupted`, and `completed` rather than collapsing all uncertainty into “processing” or “failed.”

### Robustness mechanisms implemented or exercised

- Visual frame sweeps persist atomic progress journals and resumable `next_index` state.
- Face and expression work uses finer-grained checkpoint surfaces so accepted work is not unnecessarily repeated.
- Source/configuration signatures guard checkpoint reuse.
- Persisted in-flight records are normalized into an interrupted/resumable state after process loss.
- Bounded status-summary loading avoids materializing very large analysis payloads during monitoring and initial selection.
- Interactive annotation writes remain small and atomic while heavyweight analysis is active.
- Heavy analysis admission reserves memory headroom for the analyst-facing workspace.
- Valid completed branches are reused after restart instead of being blindly recomputed.
- Backend-only recovery leaves the frontend available when possible.
- The queue launcher records atomic heartbeat/state data, cooling deadlines, backend failures, and terminal stop reasons.
- The delivery watchdog compares governed progress signatures, snapshots affected analyses before recovery, performs bounded recovery attempts, and uses cooling periods instead of rapid restart loops.
- Stale errors from superseded failed attempts must be cleared only after canonical output and checkpoint evidence prove successful recovery.

### Monitoring and recovery tools

The following local tools exist for this runtime stream:

- `scripts/vaa1_queue_backup_launcher.py`
- `scripts/run_remaining_science_queue_macos.sh`
- `scripts/vaa1_delivery_checkpoint_watchdog.py`
- `scripts/com.datascene.delivery-watchdog.plist`

The general queue launcher monitors persisted analyses, resumes uploaded/resting/interrupted work, observes cooling periods, retries temporary backend outages, and stops on genuine terminal failures.

The delivery watchdog was configured for a specific recovery episode involving Videos 3 and 2. Its embedded analysis IDs and absolute macOS paths make it an incident-specific operational artifact, not a universal production supervisor. Review and generalize its configuration before reuse.

Runtime state and logs are written beneath local `outputs/runtime/`; recovery snapshots are written beneath local `backups/`. These directories are operational evidence and were not pushed as part of the robustness commit.

### Runtime documentation map

- `docs/bug_report_analysis_interruption_checkpoint_loss_2026-08-03.md` — interrupted Video 4 diagnosis, root cause, monitoring rules, and recovery acceptance criteria.
- `docs/bug_report_2026-08-05_coupled_service_outage.md` — coupled frontend/backend exit incident and service-isolation requirements.
- `docs/bug_report_2026-08-05_stale_visual_error_retry_loop.md` — stale failure state retained after successful checkpoint recovery.
- `docs/vaa1_analysis_queue_backup_launcher_2026-08-04.md` — governed queue-launcher operation and state record.
- `docs/vaa1_checkpoint_surface_and_resume_practice_2026-08-05.md` — durable cursor, signature, and continuation practice.
- `docs/working_handover_handout_2026-08-05_analysis_recovery_interactive_commits.md` — recovery, bounded loading, and interactive annotation behavior.
- `docs/working_handover_handout_2026-08-05_E_delivery_lockdown_annotation_source_media_watchdog.md` — incident-specific delivery watchdog and snapshot boundary.

### Delivery status of the runtime stream

Commit `4c8b866` includes the runtime-facing portions that were inseparable from the sustainable completeness implementation in `api_server.py`, the hydration loader, the macOS startup adjustment, and the scoped UI/API behavior.

However, the older runtime-recovery scripts, incident reports, checkpoint producers, annotation changes, and watchdog materials listed above were intentionally left uncommitted because they were pre-existing dirty-worktree work and were not safely reviewable as part of the 28-file robustness commit.

Therefore:

- full-analysis completeness and parity are delivered and pushed;
- the current local runtime contains additional monitoring and recovery improvements;
- that additional runtime stream must receive its own review, validation, and scoped Git delivery before a fresh clone can be assumed to contain every local watchdog and recovery capability.

## Runtime startup rule

Do not use `.venv` for Datascene/VAA1.

Use the documented macOS launcher from the repository root:

```bash
bash scripts/start_vaa1_macos.sh
```

For a deliberate backend replacement:

```bash
bash scripts/start_vaa1_macos.sh --backend-only --replace
```

Runtime environments:

- backend and core analysis: Conda `vaa1_core`
- face-specific capability: Conda `vaa1_face`
- frontend: Node/Next workspace under `src/frontend`

Dashboard:

```text
http://127.0.0.1:3001/dashboard
```

Backend health:

```text
http://127.0.0.1:8000/api/health
```

## Git delivery

The robustness sprint was committed and pushed through the repository’s established route: direct plain Git from local `petteri` to `origin/petteri`.

```text
Commit: 4c8b866be22cb7c904c3afa1abf02a97d433cf66
Message: Deliver sustainable full-analysis robustness
Branch: petteri
Remote: origin/petteri
```

At delivery, local `petteri` and `origin/petteri` resolved to the same commit.

## Worktree safety boundary

The repository remains intentionally dirty because unrelated user work was kept outside the robustness commit. Do not bulk-stage, delete, reset, or overwrite it.

Known excluded groups include:

- investor and board presentation files and generators;
- `node_modules/.package-lock.json`;
- the malformed deleted `run_vaa1_lite.sh"` path;
- root-level untracked `AudioPanel.tsx`;
- `backups/`;
- `docs/.Rhistory`;
- `docs/board_meeting/`;
- older recovery, watchdog, annotation, and publication work not reviewed as part of this commit.

This exclusion does not mean those features are unimportant or absent locally. It means their Git delivery status differs from the completed and pushed full-analysis parity sprint.

Always inspect `git status --short` before staging future work.

## Recommended fresh-thread opening

Use this prompt in the next thread:

> Please read `docs/working_handover_handout_2026-08-28_full_analysis_robustness.md`. Treat commit `4c8b866` on `origin/petteri` as the completed full-analysis robustness baseline. Preserve all unrelated dirty-worktree changes. Distinguish the pushed completeness/parity sprint from the still-local runtime-monitoring and recovery stream. Start by confirming the documented macOS runtime health, then help me select and deliver the next Datascene sprint stepwise, using percentages and clear, uplifting language.

## Closure

The full-analysis robustness sprint is complete. The next thread should treat the 100.0% seven-video manifest result and the sustainable parity architecture as the baseline, not as unfinished remediation work.
