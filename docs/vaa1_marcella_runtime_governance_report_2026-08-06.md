# Datascene/VAA1 Marcella Runtime Governance Report

Date: 2026-08-06  
Coverage window: Monday 2026-08-03 to Thursday 2026-08-06  
Scope: Marcella corpus analysis delivery, save/export assurance, bug/fix review, and runtime economics

# Part I: Marcella Runtime Postmortem

## Executive Summary

During the Monday-Thursday Marcella analysis process, Datascene/VAA1 encountered four main classes of failure:

1. Long-running analysis interruption and incomplete checkpoint surfacing.
2. Runtime supervision weaknesses around frontend/backend process coupling and missing diagnostic logs.
3. Mature human annotation ledgers being hidden by stale or sparse analysis-status records.
4. Storage pressure caused by duplicate staging/export artifacts, which blocked analysis resumption until capacity was restored.

The incident review contains five incident records because the stale visual-error retry loop is separated as its own operational incident. Taxonomically, it belongs under the broader interruption/checkpoint-state class: stale branch residue made the orchestration layer treat old failure state as current branch state.

The most important finding is economic as well as technical: the expensive work is visual/science-scan computation and source-media packaging, while the most valuable analyst data is lightweight row-level annotation data. Transcript corrections, Narrative Agent/role selections, BBox confirmations, and presence intervals are KB-scale governance data. They must never be gated by heavy analysis completion, stale `analysis_record.json` snapshots, or export staging volume.

The repair direction is now clear: human annotation ledgers must be canonical, mirrored into the Master Schema, hydrated into all panels, included in Databooks and bundles, and protected by regression tests across `completed`, `processing`, and `interrupted` states.

Important limitation: this report establishes operational recovery and mature-data preservation better than it establishes analytical validity. It does not yet prove that every Marcella analysis branch is complete, every source-linked timestamp is correct, every cross-panel projection is synchronized, or every export can be reopened into an equivalent clean Datascene state.

## Runtime Environment

Observed system basis supplied by the operator:

| Component | Profile |
|---|---|
| CPU | 2.4 GHz 8-Core Intel Core i9 |
| GPU | AMD Radeon Pro 5500M 4 GB |
| Integrated graphics | Intel UHD Graphics 630 1536 MB |
| Memory | 32 GB 2667 MHz DDR4 |
| OS | macOS 26.5.2 |
| Runtime model | Local workstation, governed single-analysis execution |

This machine is suitable for governed Quick sweep and sequential Science scan work. It is not an unlimited batch workstation. Science scan visual branches can run for hours per source, and staging duplicated full bundles can exhaust local disk quickly.

## Evidence Base

This report is based on the active repo state, canonical sidecars under `outputs/api_results`, export directories under `/Users/admin/Desktop/Marcella Vids/Datascene_exports_2026-08-06`, and the following incident documents:

- `docs/bug_report_analysis_interruption_checkpoint_loss_2026-08-03.md`
- `docs/bug_report_2026-08-05_coupled_service_outage.md`
- `docs/bug_report_2026-08-05_source_media_user_data_overwrite_without_traceback.md`
- `docs/bug_report_2026-08-05_stale_visual_error_retry_loop.md`
- `docs/bug_report_2026-08-06_annotation_ledgers_hidden_by_stale_status_records.md`
- `docs/vaa1_bug_report_mature_annotations_hidden_during_interrupted_analysis_2026-08-06.md`
- `docs/datascene_analysis_time_effort_estimation_regime_2026-08-03.md`
- `docs/schemas/vaa1.performance_observability_layer.schema.json`

Evidence labels used in this report:

| Label | Meaning |
|---|---|
| Observed | Found in the current repo, sidecars, runtime status, export directory, or incident documentation |
| Inferred | Reasoned from observed evidence, but not directly proven by a dedicated test |
| Implemented | Code path or artifact route exists |
| Unit-tested | Isolated automated behavior was tested |
| Integration-tested | Multiple components were tested together |
| Manually observed | Operator or direct file inspection confirmed behavior in the current environment |
| Corpus-verified | Confirmed across all seven Marcella analyses |
| Recovery-proven | Confirmed under a controlled failure/recovery drill |
| Not yet demonstrated | Requirement, hypothesis, or design target still awaiting proof |

## Current Corpus State

Observed and corpus-verified at row-count level: canonical annotation sidecars exist for all seven Marcella analyses and are mirrored into the annotation Master Schema review layer.

| Corpus order | Source title | Analysis ID | Source SHA-256 | Status | Stage | Progress | Text corrections | Transcript entries | Visual annotations | Presence intervals |
|---:|---|---|---|---|---|---:|---:|---:|---:|---:|
| 1 | `1MarcellaPhd_VSpirituality BLS S20.mp4` | `00c22625-82e8-4ddc-bb36-317422664214` | `16a4cc00563ec02b7feae877e33fccd27ab4b510bb342a0f218a60f0eb733e05` | completed | completed | 100.0 | 30 | 7 | 18 | 18 |
| 2 | `2MarcellaPhd_VBusiness BLS S20.mp4` | `c034341f-3fba-495e-a7d1-0af03a46cb6c` | `97e4a2eb5edf1d188767ec96fb82a722fb2904d75b6d70279e0472b6f73eadf3` | processing | visual_scan | 26.7 | 74 | 30 | 8 | 8 |
| 3 | `3MarcellaPhd_VTechnology BLS S20.mp4` | `ca6d0ebf-cbb5-4f7e-8502-f8b0693daf33` | `651cfaf79b4ff76d47bba4f9e2c99734c6f3d75fde5ef69dcf8e03498b112247` | completed | complete | 100.0 | 61 | 5 | 6 | 6 |
| 4 | `4MarcellaPhd_VHealth BLS F20.mp4` | `e9cffc4c-275b-4dcb-b475-600b3c9ac2d7` | `18490dd9b105159549be38dee41bc04c281e995bcc86ff5f4bf9bdfe283dbee0` | completed | complete | 100.0 | 57 | 21 | 3 | 3 |
| 5 | `5MarcellaPhd_VTime BLS F20.mp4` | `2368228a-f46d-4339-bf7b-5f1966a33ee5` | `76845cacd189a99c053c253cb3bdd46adea3e89bccd5b5a3483f1ae5adf7db90` | completed | complete | 100.0 | 26 | 7 | 10 | 10 |
| 6 | `6MarcellaPhd_VSpace BLS F20.mp4` | `fe2c60ec-94b2-4fcd-82d4-34ea7a4f4dd8` | `41b9331bb5916c2f1eb76441301ef3b1a6f6c65cf16dd6a1691c9e6bce426803` | completed | complete | 100.0 | 18 | 10 | 6 | 6 |
| 7 | `7MarcellaPhd_VVision BLS F20.mp4` | `ac1af180-df4a-41cd-aed9-c79b91329197` | `b0e24a04f57f288eda000742d7d13e98aa1cd148e6d782cde24e952748ed74b5` | completed | complete | 100.0 | 22 | 4 | 24 | 24 |

Video 2 currently reports `processing`, `visual_scan`, `26.7%`. Its prior observed visual branch message reported `5180/14472` frames. The top-level error is clear, but a nested stale `results.visual_error` still contains `'NoneType' object has no attribute 'write'`. That stale nested error is not currently the top-level analysis state, but it remains a governance risk because stale branch errors previously caused retry-loop behavior.

There is also an immediate progress-accounting inconsistency: `5180/14472` visual frames is approximately `35.8%`, while the analysis-level progress was observed at `25.6%` and later persisted at `26.7%`. This may be legitimate if overall progress and visual-branch progress use different denominators or stage weights. It is not yet explained by the record itself.

Required reconciliation rule:

`checkpoint work units -> canonical branch progress -> weighted overall progress -> public status projection`

Public progress, resume position, queue decisions, completion, and time estimates should be derived from canonical branch state. They should not be stored independently without an explanation record. The investigation must also define whether `14472` means total source frames, frames eligible for analysis, sampled frames, scheduled work units, or remaining work after an earlier checkpoint.

## Export And Storage State

Verified export copies were produced under `/Users/admin/Desktop/Marcella Vids/Datascene_exports_2026-08-06`:

| Export class | Count | Size |
|---|---:|---:|
| Corpus Databook | 1 ZIP | 399 MB |
| Full Project bundle | 1 ZIP | 7.4 GB |
| Individual video analysis ZIPs | 7 ZIPs | 3.7 GB |
| Individual video Databooks | 7 ZIPs | 395 MB |

Disk pressure was operationally significant. After export staging, local free space dropped to roughly 498 MB. The analysis resume guard required an 8 GB reserve and correctly blocked Video 2 resume. Duplicate repo-side staging artifacts were removed after export verification, restoring approximately 20 GB free disk.

## Incident Review

### 1. Analysis Interruption And Checkpoint Loss

The 2026-08-03 incident affected Video 4 while macOS sleep/darkwake and manual backend termination interrupted long-running visual work. The application did not yet provide enough heartbeat/liveness classification to distinguish suspended, slow, idle, and dead work. The result was repeated computation risk and uncertainty about whether the analysis should be stopped.

Fix direction:

- Atomic visual checkpoint journal.
- Normalized checkpoint payload.
- Source/config signature validation.
- Heartbeat and progress-detail visibility.
- Guarded shutdown behavior for active analysis work.

### 2. Coupled Service Outage

On 2026-08-05, both frontend and backend were down. The launcher treated either child process exit as terminal and cleanup killed the sibling service. Missing dated stdout/stderr logs prevented exact reconstruction of the initiating fault.

Fix direction:

- Separate frontend and backend lifetimes.
- Dated logs with PID, exit code, signal, and timestamp.
- Bounded restart policy.
- UI service health indicator.
- Contract test: frontend failure must not kill a healthy backend, and backend failure must not erase frontend diagnostic access.

### 3. Source Media User Data Overwrite Risk

Source Media annotations disappeared after empty mutable status/metadata projections overwrote valid user selections. The missing control was an append-only revision ledger and readback-before-ack persistence.

Fix direction:

- Foreground Source Media route.
- Atomic `source_media_annotations.json`.
- Empty stale fields cannot erase non-empty user data.
- Readback before save acknowledgement.
- Generated metadata may read user ledgers but must not clear them.
- Explicit tombstones required for deletion.

### 4. Stale Visual Error Retry Loop

A stale `visual_error` value persisted after visual recovery. Completion logic treated the stale required-branch error as still active, which could trigger repeated analysis attempts even after useful outputs existed.

Fix direction:

- Successful branch completion must atomically remove stale branch errors.
- Artifacts, completed-stage flags, checkpoint, public status, and queue decision must agree.
- Nested stale errors must be surfaced as diagnostic residue, not as authoritative branch state.

### 5. Mature Annotation Ledgers Hidden By Stale Records

Human annotations existed on disk but did not reliably surface in panels because stale `analysis_record.json` or lightweight processing-state payloads displaced richer sidecars.

Fix and proof state:

| Claim | Evidence state | Meaning |
|---|---|---|
| Recovered and merged canonical `annotation_corrections.json` ledgers | Corpus-verified at row-count level | Seven sidecars exist with expected row counts |
| Mirrored ledgers into `vaa1_annotation_master_schema.json` under `review_layer.annotation_corrections` | Corpus-verified at row-count level | Master Schema correction counts match sidecar counts |
| Backend hydration prefers richer persisted annotation corrections | Unit-tested | `tests/test_saved_analysis_hydration_loader.py` covers sidecar hydration behavior |
| Frontend reads overlay canonical sidecars and Master Schema artifacts | Unit-tested for selected contracts | Frontend correction concurrency and transcript span edit contracts passed |
| Databook publication overlays canonical sidecars and can publish saved/interrupted analyses | Unit-tested | `tests/test_data_book_publication.py` passed |
| Recovered data is semantically identical across sidecar, Master Schema, panel, Databook, and export | Not yet demonstrated | Requires record-level digest and clean-reopen audit |
| Data survives controlled crash/recovery scenarios | Not yet demonstrated | Requires recovery drills |

Permanent rule:

If human annotations exist on disk, they must surface. `processing`, `interrupted`, or partial automatic analysis state is not permission to hide mature human evidence.

## Computational Economics

### High-Cost Work

The expensive work is multimodal Science scan computation:

- Visual scan and sampled frame/object work.
- Face/expression sampling.
- OCR and visual artifact generation.
- Export packaging when source media and derived artifacts are duplicated.

The project estimation regime records Science scan expectations of roughly 15-35 processing minutes per source minute on this workstation, with visually complex or recovery-prone material using the upper end.

Video 2 illustrates the economic pressure: at 25.6% progress, it remains in visual scan with 5180/14472 frames recorded. This kind of work must be resumable, checkpointed, and protected from service restarts and disk exhaustion.

### Low-Cost, High-Value Work

Human annotation data is lightweight and high-authority:

- Transcript corrections.
- Manual transcript entries.
- Narrative Agent and role selections.
- BBox/visual annotation rows.
- Presence intervals.

Across all seven analyses, the recovered human annotation payload contains hundreds of small rows, not large media artifacts. This data belongs in canonical sidecars and the Master Schema. It must save immediately, survive analysis interruption, and surface ahead of raw machine outputs.

### Storage Economics

The verified export set is materially large:

- Full Project bundle: 7.4 GB.
- Individual analysis ZIPs: 3.7 GB.
- Databooks: about 794 MB total.

The storage risk was not the human annotation layer. It was duplicated export/staging artifacts and large media/package replication. Sustainable delivery requires lifecycle rules for generated staging folders and an explicit distinction between verified external copies and disposable local build intermediates.

## Vulnerabilities Found

| Vulnerability | Why it matters | Sustainable control |
|---|---|---|
| Stale `analysis_record.json` treated as authoritative | Can hide richer canonical sidecars | Hydrate sidecars over snapshots; snapshot may cache but not govern mature data |
| Missing append-only edit ledger in some routes | User work can be overwritten without traceback | Ledger-first writes, revision IDs, explicit tombstones |
| Long-running workers lack robust liveness taxonomy | Slow/suspended work can be mistaken for dead work | Heartbeat state: running, idle, suspended, stale, failed |
| Coupled frontend/backend lifecycle | One service fault can cause total outage | Independent supervision and logs |
| Stale nested branch errors | Can drive retry loops or false UI alarms | Branch-state atomics and stale-error cleanup |
| Export staging duplicates source packages | Can exhaust disk and block analysis | Capacity preflight, staging TTL, one verified-copy policy |
| Mature data hidden during interrupted analysis | Violates data maturity principle | Corpus-wide tests for completed/processing/interrupted states |
| Insufficient runtime observability | Diagnosis costs exceed compute cost | Performance observability layer populated per stage |

## Governance Metrics To Track

The performance observability schema already defines the right direction. The Monday-Thursday process shows the following metrics should be mandatory:

- Per-stage start/end/duration.
- Active stage and completed/total governed work units.
- Recent throughput, such as frames/minute or samples/minute.
- Checkpoint age and checkpoint write cadence.
- Top-level error and branch-level error, with stale/cleared state explicit.
- Save acknowledgement latency for human annotation writes.
- Readback verification status after every human edit.
- Master Schema projection status and correction-ledger row counts.
- Disk free space at analysis start, before export, and before resume.
- Export package size, staging size, and verified destination path.
- Repeated-work count after interruption or retry.
- Service PID, exit code, signal, and dated log path.

## Sustainable Operating Rules

1. Canonical human annotation ledger first.
   - Save to sidecar.
   - Read back.
   - Mirror to Master Schema.
   - Then project to panels, Databooks, bundles, and traceback.

2. Most mature data always wins.
   - Manual correction outranks automatic outputs.
   - Canonical sidecar outranks stale embedded snapshots.
   - Processing state must not hide completed human work.

3. Heavy computation must be restartable.
   - Visual, OCR, face, expression, and audio branches need atomic checkpoints.
   - Branch success must clear obsolete branch errors.
   - Queue decisions must read canonical branch state, not stale residue.

4. Services must fail independently.
   - Backend and frontend need separate logs and lifecycle supervision.
   - The UI should expose service health without destroying active analysis context.

5. Exports must be governed artifacts.
   - External verified copy is durable.
   - Repo-side staging is disposable after verification.
   - Capacity guard should remain strict.

6. Databook must be a mature-data artifact.
   - It should publish the best available saved data.
   - Interrupted analyses can publish with warning if mature sidecars exist.
   - Databook download must not depend only on `completed` status.

## Verification Completed

Tests passed during the stabilization work:

- `conda run -n vaa1_core python -m pytest tests/test_data_book_publication.py tests/test_saved_analysis_hydration_loader.py -q`
- `node --test src/frontend/tests/annotation-correction-concurrency.test.mjs src/frontend/tests/transcript-span-edit-contract.test.mjs`
- `python3 -m py_compile api_server.py src/backend/analysis/data_book_publication.py src/backend/analysis/saved_analysis_hydration_loader.py`

Manual verification confirmed:

- Seven canonical `annotation_corrections.json` sidecars exist.
- Master Schema correction counts match sidecar counts for all seven analyses.
- Export ZIP files were copied to `/Users/admin/Desktop/Marcella Vids/Datascene_exports_2026-08-06`.
- Disk capacity was restored after deleting duplicate verified staging artifacts.

Verification limitation: row-count equality proves numerical correspondence, not record-level equivalence. `py_compile` proves syntax validity, not functional correctness. The current verification does not yet prove that correction IDs, revision IDs, target object IDs, prior values, corrected values, evidence intervals, authority states, maturity states, and deletion/tombstone states are identical across every projection.

Required stronger proof: generate a normalized mature-record digest for each video and corpus. The digest should canonicalize mature correction records and compare sidecar, Master Schema, panel projection, Databook, export, and reopened-import state.

## Interim Operational Verdict

The system is now closer to a professional governed tool, but the Monday-Thursday process exposed a release-critical rule: human annotation data must be treated as authoritative operational evidence, not as optional metadata attached to a completed automatic analysis.

The computational economy is workable if the system separates:

- heavy, restartable, long-running machine analysis;
- lightweight, immediately saved human correction ledgers;
- disposable export staging;
- durable project/databook bundles;
- and explicit runtime observability.

That separation is the sustainable path forward.

# Part II: Marcella Assurance And Release Plan

## Assurance Gap Assessment

The Monday-Thursday process proves that valuable annotation data was recovered and that persistence routes were strengthened. It does not yet prove that the Marcella corpus is analytically complete, scientifically dependable, reproducible, or free from silent analytical loss.

Current defensible assessment:

- Operational recovery: substantially demonstrated.
- Annotation preservation: partially demonstrated and materially improved.
- Analytical completeness: not yet demonstrated.
- Global time/source-link integrity: not yet demonstrated corpus-wide.
- Reproducibility: not yet demonstrated.
- End-to-end proliferation: not yet demonstrated across every consumer.
- Export reopenability: not yet demonstrated.

### A. Completeness Of The Actual Analysis

`completed` must not mean only that orchestration ended. Each video needs a feature-by-feature matrix:

| Branch | Expected | Attempted | Completed | Validated | Empty by evidence | Failed | Deferred |
|---|---:|---:|---:|---:|---:|---:|---:|
| Transcript/ASR | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit |
| Speaker turns | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit |
| Prosody | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit |
| Scene segmentation | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit |
| OCR | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit |
| Face/person | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit |
| Objects/actions | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit |
| BBox/presence intervals | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit |
| SFL/POS/dependency | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit |
| Narrative/Boje interpretations | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit |
| Meaning Network | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit |
| Stats/report generation | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit | pending audit |

A governed empty state must be distinct from `not run`, `failed`, `deferred`, and `silently absent`.

### B. Global Time Integrity

The earlier transcript/audio timing crisis makes timing a P0 assurance item. Marcella needs a cross-modal timing audit proving that source time, transcript time, audio time, frame time, scene time, speaker turns, prosody, BBox presence, and exported source links point to the same media moments.

Required audit:

- At least three temporal anchors per video: beginning, middle, and end.
- Anchors around interruption and checkpoint boundaries.
- All manually corrected high-authority intervals.
- A stratified random sample from every enabled analysis branch.
- Verification that source-linked rows seek to the correct video moment.
- Confirmation that manual corrections preserve original Whisper/source time unless explicitly time-corrected.
- Detection of duplicate, overlapping, missing, or shifted intervals.
- Zero broken source links.
- Zero orphaned mature annotations.
- Zero unexplained cross-panel value differences.
- Documented tolerance for frame and audio timing.

### C. Source And Configuration Identity

The current report references source/config signatures as a control, but does not yet provide a run manifest. A defensible Marcella run needs one canonical manifest containing:

- Source-media SHA-256.
- Duration, frame rate, resolution, audio stream properties.
- Analysis ID and source ID.
- Repository commit.
- Python, Node, ffmpeg, OpenCV, Torch, and frontend versions.
- Model names, versions, and weights.
- Taxonomy and schema versions.
- Analysis profile, feature flags, sampling rules, and random seeds.
- Annotation-ledger revision and Master Schema projection revision.
- Archive checksums.

### D. Silent Corruption And Partial Artifacts

Visible errors are only part of the risk. The more dangerous class is successful-looking but semantically incomplete output:

- Truncated JSON accepted as valid.
- Output from a previous run retained under a current analysis ID.
- Duplicate or missing intervals.
- Overlapping scene boundaries.
- Orphaned BBoxes or annotations.
- References to nonexistent Narrative Agents, scenes, or evidence.
- Expected files existing with zero or implausibly few records.
- Cached frontend state disagreeing with persisted state.

Schema validation is necessary but insufficient. Datascene needs semantic invariants and cross-artifact referential-integrity tests.

### E. Analytical Quality

Row counts do not establish quality. A stratified human-reviewed sample should assess:

- Transcript word accuracy.
- Speaker attribution.
- Scene-boundary precision.
- BBox subject continuity.
- OCR accuracy.
- False positives and false negatives.
- Presence-interval accuracy.
- Narrative Agent assignment.
- Provenance of generated interpretations.

Human annotations also require provenance: who changed what, from which prior value, on what evidence, and whether the correction was later superseded.

Acceptance threshold does not need to claim high precision for every machine feature. It must explicitly characterize reliability and limitations. For a branch to be accepted, the review should state its sample size, observed error types, source-link tolerance, and whether the branch is publication-grade, exploratory-only, or unavailable.

### F. Mature-Data Conflict Resolution

`Most mature data wins` is the right principle, but it needs operational rules for conflicts between:

- Two human corrections.
- A human correction and a later human deletion.
- Two browser sessions.
- Recovered and newly written sidecars.
- Sidecar and Master Schema revisions.
- Scene-local and corpus-level Narrative Agent selections.

Required controls:

- Revision ordering.
- Actor/session attribution.
- Optimistic concurrency.
- Conflict records.
- Explicit tombstones.
- Non-destructive rollback.

### G. End-To-End Proliferation Coverage

The current tests cover hydration and Databook publication, but Datascene's promise is broader. Corrected data must stand corrected everywhere except in traceback history.

Required consumer audit:

- Source Media.
- Transcript and speaker panels.
- Audio/prosody panels.
- Narrative Agent panel.
- Scene cards.
- BBox/ROI views.
- Meaning Network.
- Boje workbench.
- Statistical views.
- Natural-language report.
- Per-video Databook.
- Corpus Databook.
- Individual export.
- Full-project export.
- Reopen/import state.

### H. Export Integrity And Reopenability

Copying ZIP files, or confirming that they can be listed, is not semantic export verification. The export layer needs four distinct guarantees:

| Guarantee | Meaning |
|---|---|
| ZIP structural integrity | Archive can be opened/listed/extracted |
| Cryptographic checksum integrity | Archive and contained artifacts match recorded SHA-256 values |
| Manifest completeness | Expected sources, artifacts, schemas, ledgers, and Databooks are present |
| Semantic state equivalence after reopen | Clean import reproduces the governed pre-export state |

Archive equivalence should mean:

- Identical normalized mature-ledger digest.
- Identical source/config identifiers.
- Identical governed branch-state matrix.
- Identical entity, scene, and evidence references.
- Identical Databook claim-to-evidence references.
- Permitted differences only for import timestamps, storage paths, and runtime-local IDs.

The corpus Databook is 399 MB while all seven individual Databooks total 395 MB. That may be correct, but it suggests substantial duplication and should be explained by the packaging manifest.

### I. Measured Runtime Economics

The current economics section uses observed states and the existing estimation regime, but it does not yet provide full measured Marcella runtime economics. A complete runtime report should include:

- Wall-clock time and active-compute time per branch.
- Interruption and idle time.
- CPU, GPU, RAM, and VRAM utilization.
- Thermal throttling.
- Disk-write rate and peak temporary storage.
- Throughput over time.
- Time lost to repeated work.
- Checkpoint overhead.
- Export compression time.
- Operator intervention time.

Without these measurements, workstation suitability remains a well-informed operational judgment rather than a complete benchmark.

### J. Failure Chronology And Causality

The incident reports are grouped by type. The next report iteration should add one unified event timeline with:

- Timestamp.
- Process and PID.
- Active analysis/stage.
- Last successful checkpoint.
- Disk and memory state.
- Initiating event.
- Observed consequence.
- Recovery action.
- Data potentially affected.

Each entry should separate confirmed root cause, contributing condition, observed symptom, inferred explanation, and unresolved hypothesis.

### K. Recovery Proof

Several controls are design requirements rather than proven recovery drills. Required drills:

- Kill backend during each expensive branch.
- Restart after sleep/darkwake.
- Fill disk during checkpoint and export.
- Crash between sidecar write and Master Schema projection.
- Open two editing sessions.
- Inject stale nested errors.
- Corrupt the latest checkpoint.
- Remove one exported artifact.
- Reopen interrupted analysis.

Acceptance criteria:

- No mature-data loss.
- Bounded repeated computation.
- Explicit degraded state.
- Deterministic recovery route.

### L. Privacy, Security, And Deletion Governance

Marcella includes faces, voices, transcripts, and source media. Runtime governance should include:

- Access permissions.
- Sensitive-data classification.
- Local and exported encryption.
- Retention and disposal policy.
- Deletion propagation.
- Audit access.
- Model/API data exposure.
- Separation of source media from lighter research artifacts.
- Redacted/shareable export profiles.

Append-only ledgers must also support governed redaction without destroying traceback authority.

## Release Decision Register

| Priority | Item | Current state | Acceptance test | Release consequence |
|---|---|---|---|---|
| P0 | Cross-modal source-time integrity | Not corpus-proven | All audited links resolve within defined tolerance across all videos and panels | Cannot claim scientific source-linked correctness |
| P0 | Mature annotation durability and conflict safety | Partially demonstrated | Concurrent/recovered edit tests pass and conflict records are non-destructive | Cannot trust continued annotation work |
| P0 | Export checksum and clean reopen | Not demonstrated | Clean instance import matches normalized pre-export state except permitted runtime-local fields | Cannot treat bundle as archival delivery |
| P0 | Referential and semantic integrity | Not demonstrated | No unexplained orphan, duplicate, impossible, or cross-source records | Cannot trust cross-panel analytical claims |
| P1 | Checkpoint recovery and service independence | Partially designed | Recovery drills pass for sleep, kill, stale error, and restart | Long Science scans remain operationally fragile |
| P1 | Stale-state reconciliation | Known residual nested error | Stale branch residue cannot drive public status or queue decisions | Risk of false retry/false failure |
| P1 | Branch completeness | Not demonstrated | Every expected branch has a governed terminal state | Cannot interpret `completed` as analytically complete |
| P1 | Analytical quality characterization | Not demonstrated | Stratified review completed and limitations recorded | Cannot state branch reliability |
| P1 | Reproducible run identity | Not demonstrated | Manifest binds source, configuration, models, schemas, ledgers, and outputs | Cannot reproduce or compare the run confidently |
| P1 | Corpus-wide proliferation | Partially demonstrated | Selected correction IDs trace through every consumer | Risk of cross-panel inconsistency |
| P2 | Runtime optimization and staging efficiency | Early evidence only | Stage metrics and storage lifecycle are measured | Cost estimates remain broad |

## Remaining Work

1. Freeze and hash current sources, ledgers, checkpoints, and configurations.
2. Reconcile Video 2 source identity, progress denominators, checkpoint state, and stale nested error state.
3. Protect current annotations with record-level mature-ledger digest verification.
4. Resume and complete Video 2 using canonical checkpoint state.
5. Construct the feature-completeness matrix for all videos.
6. Run global-time and referential-integrity audits.
7. Trace selected corrections through every consumer.
8. Generate deterministic exports with manifests and checksums.
9. Reopen into a clean Datascene instance and compare normalized states.
10. Run destructive recovery drills on copies or dedicated fixtures, not the only Marcella corpus.
11. Measure runtime economics during controlled runs.
12. Produce the final Marcella assurance verdict.

## Revised Operational Verdict

Operational recovery is substantially demonstrated. Annotation preservation is materially improved but still needs conflict and clean-reopen proof. Analytical integrity, reproducibility, complete data proliferation, and export reopenability are not yet demonstrated.

Video 2 should not simply be resumed and then declared complete. First reconcile its progress denominators and source/config/checkpoint identity. After completion, the Marcella corpus should undergo timing, completeness, integrity, and clean-reopen audit before being described as a defensible analysis delivery.
