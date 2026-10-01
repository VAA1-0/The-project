# Datascene/VAA1 program map — current operating shape

Date: 2026-08-30
Supersedes as a current map: `docs/vaa1_program_map_current_2026-04-19.md`

## 1. System purpose and authority model

Datascene is a local, multimodal video-research workstation. It measures source media, links evidence on a canonical media clock, supports analyst review, computes governed statistical findings, and publishes provenance-complete research artifacts.

```text
Source media
  → measured modality artifacts
  → source-linked evidence / Scene Cards
  → candidate patterns and propositions
  → Data Maturation + analyst decision ledger
  → reversible governed projections
  → Narrative Agents | Meaning Network | Master Schema | StatsKit | Search
  → Data Book / Scientific Report / portable publication
```

Authority order:

```text
manual correction / confirmation
  > governed accepted proposition
  > mature measured result
  > candidate inference
  > raw detector output
```

Automated results do not overwrite source evidence. Datascene calls persons or characters **Narrative Agents** in analyst-facing surfaces; legacy “identity” fields are compatibility vocabulary only.

## 2. Runtime topology

```text
Browser or Electron / Next.js (`src/frontend`)
  ↕ HTTP + shared selection/navigation events
FastAPI (`api_server.py`)
  ↕ orchestration, status, review, correction, repair, export APIs
Analysis services (`src/backend/analysis`)
  ↕ atomic JSON/artifact persistence
uploads/ + outputs/api_results/ + outputs/audio/ + outputs/transcripts/
  ↕ optional exchange
CVAT bridge (`src/cvat/backend`)
```

Canonical startup on macOS: `bash scripts/start_vaa1_macos.sh`.

- Core backend/analysis: Conda `vaa1_core`
- Face capability: Conda `vaa1_face`
- Frontend: Node/Next.js under `src/frontend`
- Persistence: local filesystem JSON and media artifacts

## 3. Governed data plane

Primary measured layers include source metadata, video frames, objects/tracks, OCR, expressions, shots, spatial/adaptive visual measures, audio waveform/events, prosody, diarization, transcript, POS/dependency/SFL, quantitative language analysis, and scene intervals.

Every mature record should retain:

- analysis and source-media identifiers;
- canonical source interval;
- BBox/ROI where spatial evidence exists;
- producer, method/version, schema, and artifact reference;
- maturity and authority;
- evidence links and lineage;
- append-only analyst decisions and projection status.

Scene Cards are both consumers and evidence containers. They aggregate scene-local measurements and participate in correction, statistical aggregation, Narrative Agent review, Meaning Network projection, and Traceback.

## 4. Narrative Agent and Digital Twin path

```text
manual confirmed occurrence
  + visual evidence
  + audio / speaker evidence
  + transcript and spoken relation
  + OCR
  + music-theme context
  + Source Media metadata
  + Scene Card context
  → Narrative Agent Digital Twin sample
  → source-linked candidates across the array
  → analyst confirm / reject / defer
  → canonical decision
  → governed consumer refresh
```

A Digital Twin is a multimodal confirmed reference, not a first-frame face sample. Transition frames, cross-dissolves, occlusion, filters, weak geometry, missing modality evidence, and conflicting labels reduce or block propagation. A corrected interval/BBox supersedes stale anchors.

Operational review surfaces: Video/BBox right-click, Narrative Agent, Scene Cards, Data Maturation, Meaning Network, Search, Master Schema, and Traceback.

## 5. Matching and pattern discovery

The former open-topology “SOM” is retained as a diagnostic source-linked similarity graph; it is not a trained Kohonen map. The separately measured audio topology uses standardized 34-dimensional acoustic vectors and K-means with silhouette-based cluster-count selection, producing anonymous speaker clusters.

Governed proliferation uses explicit pairwise features (text, time, spatial geometry, track, modality, sample-cloud, and cross-scene support), conflict evidence, thresholds, and analyst decisions. Its weighted similarity score is not presumed to be a calibrated probability.

Native statistical pattern finding uses:

- median/MAD robust standardized deviations for scene salience;
- multi-family temporal concurrence on the canonical clock;
- Spearman rank correlation for eligible paired-scene relationships;
- explicit refusal states for inadequate baselines, zero MAD, missing evidence, clock/source conflict, and unestimable relationships.

SOM/graph proximity is diagnostic; statistical findings are candidate evidence; the analyst ledger remains promotion authority.

## 6. StatsKit and interpretation

StatsKit owns statistical plans, populations, analytical units, variables, baselines, estimates, diagnostics, limitations, and evidence navigation. Its taxonomy exposes both operating measures and future capabilities but keeps readiness separate from results.

The canonical empirical taxonomy contains 47 categories across method, source, visual, audio, language, scene, institution, audience, narrative, research, analytics, governance, external integration, and delivery. The complete table, including the dated readiness state and scientific boundary of every category, is maintained in `docs/datascene_major_changes_since_may_2026_report_2026-08-30.md`; its machine-readable authority is `docs/inventory/design_attribute_coverage_matrix.json`. Subordinate situation, annotation, linguistic and interpretive vocabularies provide permissible values within this category architecture and must not be mistaken for measured results.

```text
analysis question / plan
  → validate persisted variables and eligibility
  → compute descriptive or association result
  → source-linked visualization
  → candidate significance/relevance proposition
  → Data Maturation decision
  → report-eligible governed record
```

Current native motors are descriptive robust salience and scene-paired Spearman association. Salience is not significance; association is not causation; missing/unimplemented is not zero. Meaning/Plot consumes reviewed propositions but does not own statistical results.

Principal implementation:

- `src/backend/analysis/statskit_agent.py`
- `src/backend/analysis/native_statistical_interpretation.py`
- `docs/schemas/vaa1.statskit_schema.v1.json`
- `docs/schemas/vaa1.native_statistical_interpretation.v1.schema.json`

## 7. Completeness, monitoring, and recovery

The runtime monitoring layer records environment, source properties, stage events, input/output volumes, resources, cache/database behavior, provenance integrity, bottlenecks, and operational verdicts.

The control plane adds:

- atomic progress journals and resumable cursors;
- source/configuration signatures for checkpoint reuse;
- heartbeat and event movement;
- child-worker and sleep/wake-aware diagnosis;
- queue cooling, bounded retry, and terminal stop reasons;
- memory headroom for interactive use;
- recovery snapshots and independent backend restart;
- bounded status hydration and atomic manual writes.

Runtime vocabulary: `running`, `sleep-suspended`, `cooling`, `worker-timeout`, `stalled`, `interrupted`, `completed`.

The full-analysis gate verifies 15 required branches and the parity chain:

```text
producer → artifact → registration → Master Schema → frontend hydration → StatsKit
```

An analysis is `full` only when the manifest derives that state. The current seven-video cohort is 7/7 full, each at 15/15 verified branches with no blockers.

Principal implementation and operations:

- `src/backend/analysis/full_analysis_manifest.py`
- `src/backend/analysis/performance_observability.py`
- `docs/schemas/vaa1.full_analysis_manifest.v1.schema.json`
- `docs/schemas/vaa1.performance_observability_layer.schema.json`
- `scripts/vaa1_queue_backup_launcher.py`
- `scripts/vaa1_delivery_checkpoint_watchdog.py` (incident-specific configuration; generalization pending)

## 8. Publication and portability

Publication resolves governed decisions and source evidence into Data Book records, Scientific Report candidates, per-analysis bundles, and a corpus package. Publication must preserve checksums, provenance, source routes, authority, maturity, and limitations. Technical readiness does not replace privacy, consent, licensing, copyright, or substantive analyst sign-off.

The current seven-video publication audit passes all manifests with no technical warnings. It records eight confirmed Digital Twin decisions across the cohort; unconfirmed recognition candidates remain outside canonical confirmation.

## 9. Current boundaries

- Local research workstation, not yet a hardened multi-user service.
- Similarity scores require labelled-corpus calibration before probabilistic interpretation.
- Native statistical inference currently does not claim p-values, causal effects, or general-population validity.
- Diarization capability may be degraded depending on the installed provider and must be disclosed.
- Current seven-run observability snapshots are lineage evidence, not clean timing benchmarks; source duration and stage-clock capture require correction.
- The recovery watchdog contains incident-specific paths/IDs and is not yet a universal supervisor.

## 10. Near-term program direction

1. Calibrate Narrative Agent matching on held-out, transition-stratified analyst labels.
2. Operationalize saved analysis plans, uncertainty, missingness, and multiplicity policy.
3. Validate observability records at write time and benchmark child-process resource use.
4. Generalize and deliver the watchdog/recovery stream.
5. Keep the 15-branch manifest and parity verifier as mandatory publication gates.
6. Preserve one canonical decision ledger across every review surface and consumer.
