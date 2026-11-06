# Stage 9 — Release qualification working handover

Date: 22 October 2026

Stage 8 is delivered and manually accepted. Stage 9 qualifies a truthful,
governed release candidate; it does not expand every embedded design into an
operational feature.

## Reconciled slices

### 9.1 — Release inventory and explicit deferrals

Produce one authoritative capability register. Each feature is classified as
operational, limited, experimental or deferred. Core local operation is kept
separate from licensed, remote and optional providers. Git delivery is scoped;
unrelated decks, experiments, backups and generated material are not bulk-staged.

#### Delivered 9.1 freeze-register increment — 6 November 2026

`config/release_capability_register.json` is now the versioned authority for the
`#0.1` product boundary. It distinguishes the `#0.1` product release from an
“Analysis 1.0” immutable analysis edition and permits exactly `supported`,
`experimental`, `disabled` and `deferred` states. Every capability carries an
owner, supported inputs, visible limitations, acceptance evidence and a runtime
consequence. `GET /api/release/capabilities` exposes the validated account and
fails closed when the register is invalid. Deferred expansion is not silently
reintroduced as a release blocker merely because an older sprint document lists
it; an incomplete disposition or a false supported claim remains blocking.

The human boundary and remaining release-contract qualifications are recorded
in [the #0.1 release-freeze capability register](release_freeze_capability_register_2026-11-06.md).

#### Delivered release-contract increment — project-format compatibility

Project bundles now declare `vaa1.project_manifest.v1` and format version `1`
in both backend and local-fallback exports. Import accepts the current format,
routes the historical unversioned bundle through one governed migration, and
fails closed on newer, foreign, malformed or undeclared older formats. Legacy
manifest bytes are backed up before interpretation and receive a SHA-256
migration receipt; the uploaded archive and analyst data are not rewritten.
Automatic downgrade is explicitly unsupported. Scope, test evidence and the
remaining artifact-level boundary are recorded in the
[project-format compatibility and migration contract](project_format_compatibility_and_migration_contract_2026-11-06.md).

#### Delivered release-contract increment — atomic changes and background races

Shared catalogue persistence now uses a cross-thread/process locked JSON
transaction with reload-under-lock, validation, `fsync`, atomic replacement,
token-checked release and bounded dead-owner recovery. This closes the observed
lost-update window when different analyses save concurrently. Annotation and
saved-projection background threads now carry their requesting correction
generation and re-check canonical state only after entering the heavy-analysis
slot; superseded jobs exit without writing. Forty concurrent catalogue writes
retained forty entries in acceptance testing. Guarantees and the deliberately
separate crash-recovery boundary are recorded in the
[atomic changes and background-race contract](atomic_changes_and_background_race_contract_2026-11-06.md).

#### Delivered release-contract increment — interrupted writes and restoration

The canonical analysis record now retains its exact previous committed bytes,
rotates that backup under the record transaction lock, verifies the replacement
after `fsync` and records primary/backup checksums. Startup and saved-work
collection use a recovery loader that quarantines an unreadable primary,
atomically restores a valid backup, records the restoration in both a receipt
and the analysis event history, and rejects cross-analysis identity mismatches.
If both generations are invalid, loading fails closed without overwriting either
file. Scope and residual multi-artifact limitations are recorded in the
[interrupted-write and backup-restore contract](interrupted_write_and_backup_restore_contract_2026-11-06.md).

#### Delivered release-contract increment — source integrity and relinking

New uploads and readable imported sources now retain a SHA-256/byte-length
identity independent of path and filename. The identity is surfaced through
Source Media and status contracts and travels in backend and local-fallback
saved-work manifests. The new integrity endpoint exposes missing-source and
relink eligibility; the relink endpoint accepts a new local path only after an
exact content match inside the analysis execution boundary. An identical
renamed copy is accepted, while a same-named different file and a source-less
legacy record without a captured identity fail closed with no path mutation.
The governed behavior and acquisition exclusions are recorded in the
[source-integrity and relink contract](source_integrity_and_relink_contract_2026-11-06.md).

#### Delivered persistence increment — project reopen and missing-source notice

Every backend and local-fallback saved analysis now includes a SHA-256/size
inventory mapping semantic output keys to archive files. Import verifies and
restores this inventory before registration, so unfamiliar mature artifacts no
longer survive inside the ZIP while disappearing from reopened application
state; missing, tampered and path-traversing entries fail explicitly. Source
locators preserve the saved ID, original filename, last known location and
expected fingerprint. Project reopen returns structured missing-source notices,
and Datascene lists the current analysis ID, filename and last location while
asking the analyst to bring forward the original or an exact copy. Details and
the browser-picker limitation are recorded in the
[project save/reopen and missing-source notice contract](project_save_reopen_and_missing_source_notice_2026-11-06.md).

#### Delivered release-contract increment — numerical reproducibility

Datascene now produces an on-demand reproducibility receipt binding governed
source identity, effective parameters, model/provider versions, declared seeds
and determinism flags to checksums for every available registered output. A
comparison endpoint distinguishes exact reproduction, tolerance-bounded numeric
equivalence, configuration/input changes and output drift. Unseeded declared
stochastic components and incomplete controls remain visible states and cannot
masquerade as deterministic runs; semantic equivalence is never inferred from
numeric proximity. Scope, tolerances, verification and the third-party kernel
boundary are recorded in the
[numerical reproducibility contract](numerical_reproducibility_contract_2026-11-06.md).

#### Delivered release-contract increment — evaluation independence

Release evidence now distinguishes internal functional/regression acceptance
from independent accuracy, generalization, comparative-performance and
population-benchmark evidence. A governed evaluator requires a frozen system
revision, predeclared metrics, a holdout frozen before evaluation, zero overlap
with development/training/calibration sources and an evaluator outside the
implementation actor set. The current evidence register truthfully classifies
existing tests as internal functional evidence and withholds Narrative Agent
generalization and exploratory-clustering accuracy claims pending an actual
independent holdout. This does not withdraw their bounded functional or
experimental availability. Policy, endpoints and residual corpus work are
recorded in the
[evaluation independence contract](evaluation_independence_contract_2026-11-06.md).

### 9.2 — First-run consent and data-location disclosure

Disclose source, annotation, cache, credential and export locations. Persist an
inspectable agreement state. Require user-visible permission before media,
metadata, prompts, screenshots or derivatives leave the local environment.

### 9.3 — Analysis setup, dependencies and licensed tools

Tools owns a first-class `Analysis setup` category containing:

1. scan choice;
2. morphology choice;
3. a model-choice matrix with model/script name, role, license, isolation
   information and linked peer-reviewed literature where a verified reference
   is declared; and
4. navigation to other setup controls.

The matrix records project-scoped preferences. Selection does not silently
install, license or activate a runtime. Missing and deferred providers remain
typed unavailable states. The core workflow must run with optional keys and
providers disabled.

### 9.4 — Installation, startup and recovery after configuration freeze

Fresh-location Mac and Windows installation is intentionally gated. The runtime
configuration is not frozen and both environments are still being configured.
Until freeze, work is limited to startup topology, writable-path, restart,
saved-state and recovery preparation in the existing governed environments.

### 9.5 — Canonical analysis-record and resource model

Inventory existing analysis records before inventing a new telemetry shape.
Canonize one versioned record used for every run, covering source identity,
scan and modality, runtime/model/provider/version, effective settings, clocks,
duration, responsiveness, memory, storage, cache/reuse, recovery, candidate and
confirmation yield, analyst effort, missingness and fallback reasons.

### 9.6 — Representative workflow and source-type ladder

Begin with Quick sweep and build sectional Science scan and Forensic scan from
the same governed record. Exercise multimodal media plus bounded imports for:

- text-only material;
- a single-frame photograph;
- music/audio;
- graphics;
- a web-page capture/import; and
- reference data.

Every input type must declare its source clock or non-temporal coordinate
contract, provenance, consent boundary, applicable panels, missing features and
export behavior. A web import does not authorize live crawling or transfer.

#### First delivered 9.6 increment — governed admission preflight

`vaa1.source_import_preflight.v1` now classifies video, audio, single-frame
image, graphics, text, saved web-page capture and reference-data sources. Every
classification returns:

- its temporal, spatial, textual, document or record coordinate contract;
- the default scan and applicable panels;
- provenance and network-transfer boundaries;
- missing capabilities; and
- truthful admission and export states.

The existing video/Quick Sweep path is operational. The other six requested
families are presently `declared_not_operational` and cannot pass admission or
publication merely because the UI contains a matching modality label. Exact
file extensions take precedence over broad MIME families, preventing SVG
graphics from being silently treated as raster photographs. The next 9.6
increments operationalize these declared contracts one source family at a time,
beginning with text-only and single-frame image imports.

#### Datascene design-principle audit

The word `operational` is now reserved for a complete source-to-consumer
workflow. A successful upload/preflight is only `admission_operational`.
`vaa1.source_consumer_acceptance.v1` requires all of the following before a
source family or representative run can be accepted as operational:

| Datascene principle | Enforced acceptance evidence |
| --- | --- |
| Source-linked data first | Canonical source identity plus coordinate anchors appropriate to the medium |
| Hermeneutic space remains private | Valid project/analysis context for every projection and navigation payload |
| Saloon doors swing both ways | Every eligible panel hydrates the governed record and returns to the same source coordinate |
| Raised here, navigable here | The originating panel retains selection, queue, filters and working context during synchronization |
| Confirm once, mature everywhere | Canonical confirmations project through Master Schema without panel-local reconfirmation |
| Persistence and portability | The same source links and panel projections survive save/reopen and export/restore |
| Operational means actual | UI presence, a modality label or an eligible-panel list cannot satisfy an acceptance gate |

Preflight panel names are therefore eligibility declarations only. Each begins
with `requires_post_analysis_verification` for hydration and reciprocal source
return. If even one eligible panel fails, the workflow state remains
`not_operational` and the failed gate is named. This prevents the new source
families from becoming documentation-only or toolbar-only features.

The first real audit did not receive a blanket pass. Quick Sweep analysis
`dbd6b19c-c791-4a1f-89be-985d3cbba765` completed, but its full manifest remained
partial: its language artifacts lacked verified consumer projection and several
Science/Forensic branches disabled by Quick Sweep were still assessed as though
they were required. The source admission path is operational; the complete
source-to-all-associated-panels workflow remains unaccepted pending the
[Quick Sweep consumer-parity mitigation](bug_report_2026-10-22_quick_sweep_consumer_parity.md).

The next mitigation slice repaired the artifact/consumer manifest layer.
Requirements now follow normalized effective settings; disabled Quick Sweep
branches are `not_applicable`; and valid empty Transcript/POS/Quant/linked
transcript artifacts receive zero-row parity rather than looking unprojected.
Re-evaluating the same run produced `full`, with 8/8 required branches delivered
and no blocking reasons. This does not yet certify rendered saloon-door
navigation, save/reopen or export/restore; those human-visible gates remain open.

### 9.7 — Analysis 1.0 completion and scoped delivery

Add an analyst-governed `Analysis 1.0 complete` decision. It freezes a versioned
edition rather than preventing later correction. The completed-analysis
dashboard must provide a human-readable account of source and scope, methods,
confirmed findings, candidates and withheld claims, corrections/history,
limitations/missingness, evidence navigation, clocks, provenance, runtime
record, and publication/export routes.

The release gate then runs backend, frontend, governance, persistence,
publication and representative packaged workflows; records manual acceptance;
documents limitations; and delivers only the coherent verified Git scope.

## Pre-freeze disposition register (formerly optional deferrals)

These items are not permitted to disappear behind an `optional` label. Before
the 1.0 configuration freeze, each item must be implemented and accepted, or
receive an explicit product-authority disposition with its runtime consequence,
fallback, evidence impact and visible disabled state. An unexamined item or an
open mitigation blocks the freeze.

- Golden Retriever and other remote acquisition connectors;
- CVAT round-trip expansion;
- music/lyrics service expansion beyond bounded local audio import;
- Goffmanian, Morenoan and Latourian runtime lenses;
- Behavioral Lens UI;
- operationalization of embedded schemas not already activated;
- additional Stage 7 interpretation constructs;
- licensed or remote providers outside the local evidence core; and
- runtime-environment feature upgrades not required by the frozen release core.

The same freeze gate applies to every open bug report and mitigation schema.
Runtime-environment updates must be inventoried, versioned and exercised in the
Mac and Windows target environments before clean-location installation begins.

## Mandatory pre-9.6/9.7/9.8 operational audit

Before the remaining representative-workflow, completion and packaged-release
slices are accepted, revisit the delivered Stage 1–8 patches as running
features. The audit must include frontend/backend restart, canonical save and
reopen, reciprocal source navigation, detached-panel return, export/restore and
project isolation. Residual dependency work explicitly includes:

- Meaning Knowledge Graph and Narrative Agent graph hydration, editing and
  parity;
- all associated perspectives and interpretation lenses;
- Narrative Agent evidence-clustering practice, source boundaries and review
  state;
- Mature Data Proliferation from one user confirmation through Master Schema to
  every eligible consumer without a second confirmation request; and
- all recorded bug-report mitigations and runtime dependency upgrades.

Cluster exploration is judged by analyst usability, not by the presence of a
clustering function. Purity, representatives and problems, threshold preview,
merge/split/reassignment, temporal distribution, exclusions, batch-review
economics, representative quality, propagation reliability and correction
impact must pass the
`datascene_cluster_exploration_usability_contract_2026-10-24.md` contract.

The first empirical taxonomy increment is rendered in Data Maturation for all
currently registered Visual, Audio and Textual detection families. Audio owns
the first detailed cluster-review implementation. This is an iteration of the
existing sample-cloud, matcher and proliferation tooling; it is not a new truth
store. Interpretive clustering remains a later, separately governed stage.

A passing source-code contract is supporting evidence, not a substitute for the
rendered operational checks.

## First delivered Stage 9 increment

The Tools panel now promotes `Analysis setup` as a primary workspace. Its scan,
modality and morphology configuration is joined by a project-scoped model-choice
matrix that exposes candidate name, analytical role, license, core/isolation
status and literature. Peer-reviewed links are labelled as such; candidates
without a declared peer-reviewed reference say so instead of receiving a false
citation. The matrix is a configuration record, not a false activation claim.

The surface is protected by a focused frontend contract covering the four
Analysis setup groups, project-scoped persistence, licence disclosure and the
distinction between selecting and activating a model.

## 9.5 existing-record inventory

The first inventory covered the 13 persisted `outputs/api_results/*/analysis_record.json`
records available on 22 October 2026:

- 12 records report `completed`; one reports `uploaded`;
- all 13 report the legacy `full` pipeline profile;
- six belong to `bond-cop30-helsinki`, six to
  `research-test-2-20226-cop30-vids`, and one to `research-test-2026`;
- their common contract preserves analysis/source/project identity, lifecycle
  timestamps, progress/status, event log, output paths, results, source-media
  maturity and the Master Schema; and
- they do not uniformly preserve analysis tier, modality focus, normalized
  effective settings, chosen models, provider/method versions, resource use,
  recovery receipts, missingness or fallback reasons.

Therefore the current large `analysis_record.json` remains a compatibility
record, not the canonical Stage 9 run receipt. The next 9.5 increment will add
one versioned, bounded `vaa1.analysis_run_record.v1` envelope to every start,
resume and completion path. Existing evidence arrays remain referenced by
checksum/path instead of being copied into that envelope.

That increment is now implemented. `analysis_run_record.json` is written beside
the compatibility record through the shared persistence boundary. It preserves
source/project identity, lifecycle state, scan and modality, normalized effective
settings, language policy, declared model/provider versions, source clock,
resource observations, recovery state, fallback reasons and bounded artifact
references. Unavailable legacy values are declared in `missing_fields`; they are
not inferred.

## 9.5 model-transition user journeys

The scan choices are progressive analytical commitments over one source and one
governed evidence history, not three unrelated analyses.

| Journey | Entry | Analyst intent | System behavior | Return state |
| --- | --- | --- | --- | --- |
| Quick Sweep → Science Scan | A broad candidate, missing branch or selected interval | Measure a promising region more closely | Show changed settings, estimated work and reusable artifacts; recompute only added or invalidated branches | Return to the same source time, panel and selected evidence with new results identified |
| Science Scan → Forensic Scan | A disputed or precision-sensitive interval/region | Inspect a bounded question at higher temporal/spatial resolution | Require an interval/ROI and reason; preserve all prior evidence; add a child run receipt linked to its parent | Return to the originating ticket and display the forensic evidence beside its warrant |
| Forensic Scan → Science Scan | Precision question resolved | Resume the wider analytical flow | Keep forensic findings source-linked without applying forensic cost to the entire source | Restore the parent view, filters and scroll position |
| Any scan → changed model | Model is unavailable, unsuitable or deliberately compared | Re-run an eligible branch with a disclosed alternative | Present licence, locality, provider/version and invalidation impact before launch; never silently replace accepted evidence | Preserve both run receipts and expose comparison/provenance |
| Completed Analysis 1.0 → new run | New question or correction arrives after publication | Create a later edition | Fork a revision; do not rewrite the frozen edition | Open the new edition with a visible relationship to 1.0 |

### Navigation sketch

```text
Tools / Analysis setup
  Scan: [Quick Sweep ▾]  Material: [Multimodal ▾]
  Models: [3 configured · 1 unavailable]  [Review matrix]
  Effective change: 4 reused · 2 added · 0 invalidated
  [Run analysis]

Originating evidence panel
  Candidate / relation / interval
  [Open in Science Scan] [Open bounded Forensic Scan]
                       │
                       ▼
Local scan drawer within the same panel
  Scope · changed settings · licence · estimated work · reuse
  [Confirm and run] [Cancel]
                       │
                       ▼
Run receipt indicator
  Processing / completed / partial · provider · version · fallbacks
  [Inspect receipt] [Compare run] [Return to originating evidence]
```

The navigation follows the Datascene panel-locality principle: a transition is
configured and launched from the panel where the analytical question arose.
The application may open a supporting drawer or detached comparison, but it
must retain a source-return handle and must not throw the analyst into an
unrelated panel. Source time, artifact, selection, filters and scroll position
form the return context.

### Transition rules

1. A higher-resolution scan does not demote, duplicate or reconfirm mature user
   evidence.
2. Reuse and invalidation are shown before the analyst commits the transition.
3. Model selection must disclose licence and local/remote execution status.
4. A scan may be sectional: the receipt records its interval/ROI and parent run.
5. Results hydrate associated consumers through canonical projections; each
   consumer links back to the producing receipt.
6. Switching models creates comparable provenance, never an invisible overwrite.

## Current acceptance state

- 9.1 scope and explicit deferrals: documented;
- 9.3 Analysis setup surface and model/licence preference matrix: implemented,
  type-checked and covered by a focused contract;
- 9.4 clean-location Mac/Windows install: deliberately waiting for configuration
  freeze; and
- 9.5 existing-record inventory, canonical envelope and model-transition journey:
  implemented. A two-second Quick Sweep acceptance run proved model selection,
  installed provider versions, effective settings, bounded resource telemetry,
  fallback disclosure and artifact references. Its first execution ended
  truthfully as `partial` because the configured application runtime did not
  expose its sibling `ffprobe` on `PATH`. Runtime media-executable discovery was
  consequently added. The final post-fix run
  `dbd6b19c-c791-4a1f-89be-985d3cbba765` completed at 100% with no audio error,
  resolved `ffmpeg`/`ffprobe` paths, no canonical-receipt missing fields, 27
  artifact references and bounded start/peak memory observations. Core 9.5 is
  accepted.

## 9.6 verification result — 23 October 2026

The operational video workflow has completed its bounded source/consumer
verification. The rendered sixteen-surface source-clock matrix passed, and the
current No Time To Die record passed Transcript → Video and Audio → Video
navigation, Audio detach, panel close/reopen and cross-analysis isolation.

Verification exposed and closed one genuine defect: imported/restored analyses
with an empty summary transcript projection did not fall back to their populated
authoritative transcript artifact. Empty projection now triggers governed
artifact hydration and canonical correction application. The bug report is
`docs/bug_report_2026-10-23_imported_transcript_consumer_hydration.md` and the
acceptance record is
`docs/verification_2026-10-23_stage9_6_source_consumer_acceptance.md`.

Publication and portability checks also passed: deterministic archive checksum,
source-chain navigation, tamper rejection and isolated video/corpus restore.
The six non-video source classes remain explicitly non-operational; this result
does not promote them without their own rendered acceptance.

## First 9.7 slice — governed Analysis 1.0 edition

The Download panel now includes a human-readable `Completed Analysis 1.0`
account for the active artifact. It reports source/scope/clock, confirmed,
candidate and withheld decision counts, available artifacts, retained decision
history, limitations/missingness, and the governed publication path.

The analyst may explicitly confirm completion. That action writes an immutable,
versioned `vaa1.analysis_edition.v1` receipt with explicit analyst authority and
a canonical content identity. A later correction is not prohibited and does
not rewrite the receipt: the next confirmation creates the next edition.

Non-video rendered checks are deferred, not forgotten. Their manual acceptance
protocol is recorded in
`docs/manual_test_checklist_non_video_sources_2026-10-23.md`.

### Analysis Report usability increment

The completion account now has a first-class `Analysis Report` workspace,
available from `Window → Analysis Report` and from the completion card. It uses
one governed evidence set in two reading modes: `Fast scan` for orientation and
`Evidence review` for provenance-led inspection. The panel provides summary,
scene, narrative structure, Narrative Agent, statistical, Quant/POS,
selected-lens and maturity views. Each available view returns to its associated
operational panel; unavailable evidence is reported as missing.

A project-bound comparison matrix follows the Quant/POS matrix pattern. The
analyst explicitly selects rows and compares confirmed, candidate, withheld and
artifact counts without treating those counts as normalized effect sizes. The
design contract is recorded in
`docs/datascene_analysis_report_panel_design_2026-10-23.md`.

## Object provider and measured appearance increment — 25 October 2026

The former implicit YOLOv8 dependency now has an operational permissive path.
Meta DETR ResNet-50 is the local default and Datascene Native Object Appearance
v1 provides measured source-crop similarity for object-cluster exploration.
Licensed or restricted providers may be used for research only by explicit
analyst selection; the backend rejects licence-sensitive choices without the
analyst-authority receipt. Delivery boundaries and remaining packaged-runtime
work are recorded in
`docs/datascene_object_appearance_detector_delivery_2026-10-25.md`.

## Supply-chain security increment — 6 November 2026

The release contract now exposes an offline, machine-readable supply-chain
assessment at `GET /api/release/supply-chain`. npm locks are checked for
resolved artifact integrity, and local models are checked against immutable
revision, licence, local-only policy, file size and SHA-256 evidence. Python
requirements are assessed separately for exact version and distribution
identity.

The initial assessment deliberately returned `blocked`: 114 mixed pip/runtime
entries had exact versions but no distribution hashes. The subsequent
mitigation separated runtime/system authority, removed the unavailable deferred
`dejavu-audio` pin from the core, and generated a non-yanked PyPI SHA-256 lock
for 109 exact distributions. Both npm lockfiles and the installed DETR model's
three artifacts also verify. Supply-chain qualification remains blocked only on
clean Mac/Windows installation, startup and installer-integrity receipts bound
to the lock. The contract and closure criteria are in
`docs/supply_chain_security_contract_2026-11-06.md`.

## Retention and complete-deletion increment — 6 November 2026

Analysis deletion now previews and executes an explicit managed-data plan. It
removes the entire analysis directory, imported copies,
thumbnails, embeddings, indexes, backups, generated bundles, video/corpus
publications and affected project-continuity derivatives, then removes catalogue
membership. Every execution returns a deletion receipt; partial filesystem
failure is not reported as success, and processing analyses cannot be deleted
while uncancellable writers remain active.

Both individual and bulk analysis deletion require two user confirmations with
a five-minute, single-use backend intent between them; direct destructive calls
without the intent fail. All original files—including managed uploads and
browser IndexedDB media—are preserved because source deletion is a separate
navigation and authority. Stored paths outside Datascene's declared roots are
also retained, and downloaded exports remain outside application control.
Shared rotating logs may retain the opaque analysis ID
until rotation but no source or derived content; physical secure wiping remains
an operating-system/storage concern. The complete boundary is recorded in
`docs/retention_and_complete_deletion_contract_2026-11-06.md`.

## Independent export-verification increment — 6 November 2026

Video and corpus publications can now be assessed by a standalone
standard-library reader that imports no Datascene exporter, importer, restore
routine or canonicalization helper. It independently validates ZIP safety,
complete manifest coverage, hashes, sizes, content identity, schema/package
identity, source clocks and units, Data Book/report links, missingness,
provenance, maturity and decision/publication history. Corpus verification also
opens and verifies each nested video edition.

The CLI emits a portable JSON reader account and non-zero rejection status; a
managed API endpoint launches it in a separate process. Fresh video and
two-video publications pass, while a changed report payload is rejected. This
is independent structural and traceability verification, not independent
scientific review. The contract is recorded in
`docs/independent_export_verification_contract_2026-11-06.md`.

## Representative workload and usability qualification — 6 November 2026

The release now has eight frozen workload scenarios with executable thresholds:
many short clips, dense detections, multilingual material, VFR sources,
feature-length media, sustained sessions, constrained resources and the main
workflow completed by independent analysts without developer intervention.
Evidence receipts bind the frozen revision, dataset edition, executor,
environment, metrics and artifacts; the evaluator recomputes every criterion
and fails missing or mistyped metrics.

Every scenario also carries a mandatory project-boundary account: admitted
project IDs, one project binding for every analysis, and zero unbound analyses,
foreign-project reads or boundary violations. Project isolation is a preceding
gate, so otherwise passing performance or usability metrics cannot conceal a
cross-project leak.

The current result is truthfully `blocked`. Existing six-analysis multilingual
work, VFR contracts and historical disk-pressure evidence are useful fragments
but do not meet the declared scenario thresholds. Dense, sustained-session,
controlled constrained-resource and independent-analyst receipts are absent.
The matrix, exact thresholds and closure boundary are recorded in
`docs/representative_workload_and_usability_qualification_2026-11-06.md`.

## Release ownership and maintenance increment — 6 November 2026

One fail-closed maintenance register now governs accountable roles, P0–P3
severity and blocker rules, known issues, diagnostic redaction, patch/rollback
sequencing and model promotion. P0/P1 issues remain blockers until closed;
project-boundary breach, data loss, source corruption and secret disclosure are
P0 conditions. Rollback may restore application code but never overwrite newer
user project data.

The diagnostic projection is deny-by-default: it admits bounded runtime,
version, error-class and issue-reference fields while redacting credentials,
withholding source/transcript/prompt/screenshot/embedding content and reducing
paths to basenames. Model updates require immutable artifacts, independent
evaluation, project-boundary evidence, staged rollout and rollback material and
create new method editions when findings may change.

The present result remains `blocked`: accountable human assignees are not
authorized, and supply-chain plus representative-workload P1 issues remain
open. The contract and draft release notes are recorded in
`docs/release_ownership_and_maintenance_contract_2026-11-06.md` and
`docs/release_notes_0.1_draft.md`.
