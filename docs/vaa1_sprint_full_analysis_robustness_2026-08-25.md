# Datascene/VAA1 Full Analysis Robustness Sprint

Date: 2026-08-25
Prepared: 2026-08-24
Status: Scheduled — release-blocking mitigation round

## Sprint purpose

Make `completed · full profile` an evidence-backed system state rather than a loose pipeline label.
The sprint converts the 24 August StatsKit recovery into a repeatable, enforced analysis process so
new analyses cannot silently omit computation, persistence, projection, hydration, or consumption.

No new analytical features enter the sprint until the full-analysis gate passes.

## Incident basis

The sprint is governed by:

- `docs/bug_report_2026-08-24_statskit_maturity_radar_partial_analysis.md`
- the repaired seven-video corpus
- the Video 2 resume and completion evidence from 2026-08-24

Confirmed exposure:

1. historical `full profile` analyses lacked required adaptive and relationship branches;
2. persisted spatial evidence could be stranded outside bounded frontend hydration;
3. missing, not-run, unhydrated, and unimplemented states were rendered like measured zeros;
4. contradiction resolution was presented as a selected-video deprivation despite lacking a
   governed platform aggregate;
5. completion did not atomically verify producer, artifact, Master Schema projection, frontend
   hydration, and StatsKit consumption;
6. the main runtime reports limited diarization because `pyannote.audio` is unavailable;
7. eight pre-existing frontend governance-contract tests remain failing.

## Sprint outcome

At sprint close, Datascene must either:

- certify an analysis as `full` with machine-verifiable evidence for every required branch; or
- label it `completed_with_gaps`, `partial`, or `failed`, with exact missing states and recovery
  actions.

Silence, generic zero values, and optimistic completion labels are forbidden outcomes.

## Definition of full analysis v1

The versioned full-analysis contract covers these branches:

### Source and timing

- source media exists and is readable;
- source duration and canonical source clock are recorded;
- transcript timing authority and coverage quality are recorded.

### Language and audio

- transcript;
- linked transcript;
- POS analysis;
- Quant analysis;
- audio prosody;
- audio-event intervals;
- diarization, with provider capability explicitly recorded;
- audio sample clouds.

### Visual

- object detections and tracked objects;
- OCR;
- expression analysis;
- shot-boundary intervals;
- canonical spatial-tone measurements;
- canonical adaptive-visual measurements;
- source-linked scene/temporal projections.

### Cross-modal and governance

- native statistical relationship interpretation;
- Master Schema projection;
- annotation-correction preservation;
- source-media metadata projection;
- StatsKit hydration/consumption verification;
- required artifact integrity and schema-version verification.

Contradiction resolution is recorded as `unsupported_platform_capability` until a governed
aggregate is implemented. It is not counted as a failed video branch and cannot be drawn as a
measured zero.

## Required state model

Every branch uses one of these explicit states:

- `computed`
- `computed_degraded`
- `not_run`
- `failed`
- `stale`
- `artifact_missing`
- `projection_missing`
- `hydration_missing`
- `consumer_missing`
- `unsupported_platform_capability`
- `not_applicable`

Each state records producer, method/version, artifact path, schema, row count, error, retryability,
projection status, consumer verification, and timestamp.

## Work packages

### WP1 — Full-analysis completion manifest

Priority: P0
Gate: Blocks every later acceptance decision

Implement `vaa1.full_analysis_manifest.v1` and persist it beside each analysis record.

Required fields:

- analysis ID and requested profile;
- required and optional branch registry;
- branch states and errors;
- artifact path, checksum/schema/version, and row count;
- Master Schema projection state;
- frontend hydration state;
- StatsKit consumer state;
- degraded-capability disclosures;
- overall state and blocking reasons.

Acceptance criteria:

1. `full` is derived from the manifest and cannot be set directly.
2. Missing required artifacts prevent `full`.
3. A failed or unhydrated required branch produces a named blocking reason.
4. Existing seven-video analyses can be audited into manifests without losing raw evidence.
5. Manifest survives restart and is available to backend and frontend catalogues.

### WP2 — Integrate required measurement branches into the normal pipeline

Priority: P0

Move canonical spatial tone, adaptive visual measurement, shot boundaries, and native statistical
relationships into the governed full-profile execution graph.

Acceptance criteria:

1. A new full analysis produces all canonical sidecars automatically.
2. Branch execution is checkpointed and resumable.
3. Atomic writes prevent incomplete files from appearing computed.
4. Re-running a valid branch is idempotent or explicitly versioned.
5. Branch failures preserve completed work and produce a truthful partial state.

### WP3 — End-to-end artifact/projection/hydration parity gate

Priority: P0

Add a verifier that compares:

```text
producer result
-> canonical artifact
-> output_files registration
-> Master Schema projection
-> frontend artifact route
-> AnalysisData hydration
-> StatsKit source-layer count
```

Acceptance criteria:

1. Row-count parity is verified for spatial, adaptive, shot, transcript, POS, Quant, audio-event,
   diarization, and native relationship outputs.
2. A parity mismatch blocks `full`.
3. The verifier emits a concise recovery action for each mismatch.
4. Corpus audit passes for all seven current videos.

### WP4 — Truthful UI states and scoped badges

Priority: P0

Replace ambiguous completion and zero-value language.

Acceptance criteria:

1. Project catalogue shows manifest-derived `full`, `degraded`, `partial`, or `failed`.
2. StatsKit differentiates measured zero from not-run, failed, missing, unsupported, and not
   applicable.
3. Badges name their scope, for example `44/44 workbench descriptors` and
   `8/8 required source layers`.
4. Unsupported contradiction resolution is visibly a platform limitation, not a video defect.
5. Panel refresh cannot reintroduce stale progress details after completion.

### WP5 — Datascene in-UI diagnosis and recovery

Priority: P0

Add a recovery surface reachable from the project catalogue, analysis status, and affected StatsKit
view. It must turn every retryable manifest or parity failure into a precise, governed repair flow.

Required controls:

- `Inspect completeness` opens the full-analysis manifest with affected branch, last successful
  checkpoint, producer/version, error, missing layer, downstream consumers, and evidence counts;
- `Repair missing analyses` queues only branches that are missing, failed, stale, or invalid;
- branch-level `Retry` is available when a targeted rerun is safe;
- `Refresh projections` rebuilds registrations, Master Schema projections, and frontend hydration
  from valid canonical artifacts without recomputing them;
- `Verify analysis` reruns artifact-to-consumer parity and refreshes the manifest-derived status;
- progress survives navigation/reload and exposes queued, running, verifying, succeeded, and failed
  states;
- unrecoverable or unsupported states explain the required operator action instead of offering a
  non-functional retry.

Safety requirements:

1. Repair actions are idempotent, analysis-scoped, and never delete valid evidence.
2. The UI shows the exact branches and downstream projections affected before confirmation.
3. Duplicate clicks cannot enqueue duplicate work; the active job ID remains visible.
4. A repair cannot mark the analysis `full` until the manifest and parity verifier both pass.
5. Failures preserve logs, checkpoints, and prior valid outputs, and offer a copyable diagnostic ID.
6. Permissions and audit records identify who initiated the repair, when, and what was recomputed.

Acceptance criteria:

1. Removing a POS, Quant, adaptive visual, spatial, shot, or relationship projection causes the UI
   to name the deprivation and offer the correct scoped recovery action.
2. Artifact-present/projection-missing cases use projection refresh, not expensive recomputation.
3. Artifact-missing cases queue only the required producer branch and its dependent projections.
4. After repair, all affected panels—including POS, Quant, and StatsKit maturity views—update without
   a manual browser restart.
5. An intentionally failed repair remains visibly partial and provides an actionable diagnostic.
6. The flow is covered by backend job/API tests and frontend recovery-state tests.

### WP6 — Resume and unattended completion hardening

Priority: P0

Acceptance criteria:

1. Resume tests cover absent derivative video writers and unique atomic checkpoint files.
2. Completed branches are not recomputed unless stale or version-incompatible.
3. Stale errors and progress details are cleared only after verified success.
4. A resumed full analysis reaches the same manifest state as an uninterrupted run.
5. Video 2 remains the regression fixture for checkpoint recovery and completion.

### WP7 — Runtime capability decision for diarization

Priority: P1

Decide whether full-profile delivery requires `pyannote.audio` or permits a governed degraded
provider.

Acceptance criteria:

1. Runtime capability is checked at startup and recorded in the manifest.
2. If mandatory, install and verify the dependency in `vaa1_core` or establish an explicit service
   boundary with `vaa1_face`/another governed environment.
3. If degraded mode is permitted, UI and exports name the provider and limitation.
4. No full analysis silently claims unrestricted diarization while the dependency is absent.

### WP8 — Frontend governance-contract test closure

Priority: P1, release blocking

Baseline on 2026-08-24: 121 tests, 113 passing, 8 failing.

Acceptance criteria:

1. Classify every failing test as product regression, stale contract, or invalid fixture.
2. Fix implementation regressions; update tests only when the governing contract has intentionally
   changed and the change is documented.
3. `npm test` passes with zero failures.
4. `npx tsc --noEmit` passes.
5. Focused StatsKit full-analysis readiness tests remain green.

### WP9 — Governed contradiction-resolution design decision

Priority: P2; design gate, not required implementation in this one-day sprint

Produce a decision record defining:

- contradiction/counter-evidence unit of analysis;
- eligible evidence and authority states;
- resolved, unresolved, disputed, and not-applicable states;
- denominator and aggregation semantics;
- analyst review requirement;
- provenance and report eligibility.

Until implemented, keep the capability excluded from video maturity scoring.

## Sprint sequence — 25 August 2026

### Opening gate

1. Reconfirm backend/frontend health and seven-video artifact parity.
2. Freeze unrelated feature changes for the sprint window.
3. Record the current eight failing frontend tests.

### Morning block

1. WP1: manifest schema, evaluator, persistence, and catalogue projection.
2. WP2: integrate required measurement branches into the execution graph.
3. Add recovery/checkpoint tests while changing execution flow.

### Midday verification

1. Run one fresh controlled analysis or a representative fixture through the full graph.
2. Restart and reopen it.
3. Confirm manifest and parity gate behavior for both success and intentionally removed-artifact
   failure cases.

### Afternoon block

1. WP3: finish cross-layer parity verifier.
2. WP4: manifest-derived UI states and scoped badges.
3. WP5: deliver the diagnosis/recovery surface and targeted repair API.
4. WP7: diarization capability decision and implementation/disclosure.
5. WP8: close frontend governance-contract failures.

### Closing gate

1. Type check.
2. Backend targeted tests.
3. Full frontend suite.
4. Seven-video manifest/parity audit.
5. Fresh-analysis save, restart, reopen, and StatsKit verification.
6. Inject representative missing-artifact and missing-projection failures, repair both through the
   Datascene UI, and verify live consumer refresh.
7. Publish a sprint resolution note with passed/failed evidence.

## Release gate

The mitigation sprint is `GO` only if:

1. no analysis is labeled `full` without a passing manifest;
2. all required implemented branches run automatically for the full profile;
3. parity verification passes from artifacts through StatsKit;
4. measured zero and missing-state semantics are distinct;
5. resume completion is verified;
6. diarization capability is explicit;
7. TypeScript and the full frontend suite pass;
8. all seven current analyses pass the manifest audit.
9. retryable deprivation states can be diagnosed and repaired through the Datascene UI without
   shell or database intervention.

Any failed condition results in `NO-GO` with the precise blocker recorded. Schedule pressure cannot
convert a failed gate into a full-profile claim.

## Sprint evidence package

At close, retain:

- manifest schema and seven generated manifests;
- parity-audit output;
- fresh-analysis and resumed-analysis evidence;
- test output;
- runtime capability report;
- UI screenshots showing truthful state distinctions;
- UI recovery evidence for one recomputation case and one projection-only repair case;
- repair audit records and diagnostic IDs;
- contradiction-resolution decision record;
- final GO/NO-GO statement.

## Working principle

Robustness means the system notices, names, preserves, and recovers from incomplete work. A solid
analysis is not one that merely reaches 100%; it is one whose required evidence can be traced from
source computation through persistence, governance, hydration, consumption, restart, and review.
