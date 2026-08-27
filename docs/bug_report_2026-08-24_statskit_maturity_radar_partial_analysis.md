# Bug report: StatsKit maturity radar presents full analyses as analytically deprived

Date: 2026-08-24

## Summary

StatsKit's **Exploratory maturity radar** shows zero or unassessed axes for analyses that are
presented elsewhere as `Completed · full profile`. The display currently collapses three distinct
conditions into the same center-point result:

1. persisted evidence exists but is not hydrated into the frontend `AnalysisData` projection;
2. an analytical producer is implemented but was not run or persisted for that video; and
3. the radar dimension has no implemented governed aggregate and is hard-coded as unassessed.

This makes a full pipeline completion label look like a guarantee of full StatsKit readiness even
though no such completion contract is enforced.

## Reported example

Video 4, `4MarcellaPhd_VHealth BLS F20.mp4`

- analysis ID: `e9cffc4c-275b-4dcb-b475-600b3c9ac2d7`
- persisted status: `completed`
- screenshot labels: `Saved analysis · full profile` and `44 computed / 0 missing`
- radar symptoms:
  - Multimodal coverage: Adaptive visual measurements = `0`
  - Multimodal coverage: Color / brightness / contrast = `0`
  - Analytical maturity: Cross-modal agreement = `0`
  - Analytical maturity: Contradiction resolution = unassessed/center
  - Analytical maturity: Relational connectivity = `0`

## Empirical findings

### Video 4 contains visual evidence that StatsKit does not surface

The saved `analysis_record.json` contains:

- 9,990 `results.visual_analysis.spatial_tone_scan.samples`
- 20 `results.visual_analysis.shot_boundaries.intervals`
- 54 audio-event intervals
- no adaptive-visual samples

The saved Master Schema independently records the spatial-tone producer as `available`, with
`row_count: 9990`, and records the shot-boundary producer as active. StatsKit nevertheless reports
the color/brightness/contrast layer as missing because its layer builder reads only
`analysisData.metadata.spatialToneScan.samples`.

The bounded frontend bootstrap route does not read the large analysis record. The normal completed
analysis path expects spatial-tone samples under `status.summary.spatial_tone_scan`, but Video 4's
live `/api/status/{analysis_id}/summary` response does not expose those samples. There is also no
canonical `spatial_tone_scan.json` sidecar for the frontend artifact loader to use. Therefore the
persisted rows are stranded inside the heavyweight analysis record while the Master Schema carries
only their availability/count metadata.

Shot boundaries happen to surface because the frontend reconstructs them from Master Schema
temporal segments. No equivalent reconstruction or artifact hydration exists for spatial-tone
samples. This asymmetry explains why the shot-boundary axis is ready while the color axis is zero.

### Adaptive visual measurement was not part of the corpus-wide completed run

Only Video 6 has persisted adaptive-visual output (2,065 samples and an
`adaptive_visual_scan.json` sidecar). Videos 1–5 and 7 have zero adaptive-visual samples and no
sidecar. The producer and API endpoint exist, but the historical `full` analyses did not execute or
backfill that producer. This is a true missing analytical branch, not only a display problem.

### Relationship axes depend on an on-demand artifact, not the 44 computed workbench rows

StatsKit calculates both axes from:

```text
(nativeStatisticalInterpretation.relationships || []).length
```

Video 4 has no `native_statistical_interpretation.json`, so:

- Cross-modal agreement = `min(1, relationship_count / 5)` = `0`
- Relational connectivity = `min(1, relationship_count / 10)` = `0`

Only Videos 2 and 6 currently have persisted native statistical interpretation artifacts (3 and 9
relationships respectively). The other five videos have none. The badge `44 computed / 0 missing`
describes StatsKit workbench rows, not delivered cross-modal relationships, but the UI does not make
that distinction visible.

### Contradiction resolution is not implemented as a measured aggregate

The radar source sets this axis to `value: null` unconditionally with the basis:

```text
No governed contradiction-resolution aggregate is recorded
```

Consequently this axis cannot surface for any video, regardless of pipeline completeness or
available counter-evidence. The present UI makes an unimplemented corpus-wide capability look like
a deficiency of the selected analysis.

## Corpus audit

| Video | Spatial-tone rows | Adaptive rows | Shot intervals | Native relationships |
|---|---:|---:|---:|---:|
| 1 Spirituality | 15,166 | 0 | 95 | absent |
| 2 Business | 14,472 | 0 | 9 | 3 |
| 3 Technology | 14,286 | 0 | 15 | absent |
| 4 Health | 9,990 | 0 | 20 | absent |
| 5 Time | 7,694 | 0 | 43 | absent |
| 6 Space | 5,700 | 2,065 | 16 | 9 |
| 7 Vision | 5,418 | 0 | 15 | absent |

All seven analyses have spatial-tone evidence, but none has a canonical spatial-tone sidecar.
Only Video 6 has adaptive-visual measurements. Only Videos 2 and 6 have persisted relationship
runs.

## Root cause

There is no single enforced definition of **full analysis** spanning pipeline execution, persisted
artifacts, hydration, and StatsKit readiness.

More specifically:

1. **Persistence/hydration gap:** legacy spatial-tone arrays remain embedded in large analysis
   records; StatsKit's bounded loading path neither reads them nor reconstructs them from Master
   Schema counts.
2. **Pipeline coverage gap:** adaptive visual measurement and native statistical interpretation are
   callable/on-demand stages rather than required branches of the historical full-profile run.
3. **Product-state gap:** `completed`, `full profile`, and `44 computed / 0 missing` refer to
   different scopes, but are displayed together without qualification.
4. **Implementation gap:** contradiction resolution has no producer or persisted aggregate; its
   radar value is deliberately always null.
5. **Readiness-model gap:** radar zeros do not encode whether a value is missing, unavailable,
   unhydrated, not run, failed, unsupported, or genuinely measured as zero.

## Required fix

### 1. Define and enforce a full-analysis manifest

Add a versioned completion manifest per analysis with every required producer and consumer surface:

- producer status: `computed`, `not_run`, `failed`, `unsupported`, `stale`
- artifact path/schema/version and row count
- Master Schema projection status
- frontend hydration status
- StatsKit consumption status
- retry/backfill action

The public `completed/full profile` label must be derived from this manifest. A record with missing
required branches must be labeled `partially complete` or `completed with gaps`.

### 2. Canonicalize and hydrate existing visual measurements

- Extract embedded spatial-tone payloads to `spatial_tone_scan.json` sidecars for all seven videos.
- Register those paths in `output_files`.
- Make the bounded analysis loader fetch the sidecar explicitly.
- Keep Master Schema row counts as an audit/availability projection, not as a replacement for the
  measured samples.
- Apply the same rule to shot-boundary and adaptive-visual artifacts so all three use a consistent
  persistence and hydration path.

### 3. Backfill missing implemented producers

- Run and persist adaptive visual measurement for Videos 1–5 and 7.
- Run and persist native statistical interpretation for Videos 1, 3, 4, 5, and 7 after required
  source layers have been hydrated.
- Rebuild Master Schema projections and StatsKit readiness after each backfill.
- Record failures explicitly; do not convert a failed/missing producer to numeric zero.

### 4. Implement contradiction-resolution governance

Define a governed aggregate from contradiction/counter-evidence decisions, including denominator,
review state, provenance, and unresolved count. Until implemented, label the axis
`Capability not implemented` and exclude it from selected-analysis deprivation and overall scoring.

### 5. Correct radar semantics

Represent states independently from values:

- measured value (including a legitimate numeric zero)
- data available but not hydrated
- not run
- failed
- unsupported/not implemented
- not applicable

Do not draw all non-measured states at the center as though they were measured zeros. Tooltips and
the detail table should name the exact state and remediation.

### 6. Make badges scope-explicit

Replace ambiguous labels with scoped labels such as:

- `44/44 workbench descriptors computed`
- `6/8 radar source layers available`
- `0/5 relationship families delivered`
- `1 capability not implemented`

## Acceptance criteria

1. Video 4's color/brightness/contrast axis consumes its 9,990 persisted spatial-tone rows after a
   normal dashboard refresh without loading the full analysis record.
2. Every saved analysis exposes canonical sidecars for spatial tone, shot boundaries, and adaptive
   visual measurement, or an explicit non-success state in its completion manifest.
3. A `full profile` label is impossible while a required producer is `not_run`, `failed`, or
   unhydrated.
4. Relationship axes state whether the native interpretation run is absent, failed, or computed;
   absence is not displayed as a measured zero.
5. Contradiction resolution is either computed from a governed artifact or visibly marked as an
   unimplemented capability and excluded from analysis completeness.
6. Corpus regression tests cover all seven analyses and verify parity between persisted row counts,
   Master Schema projections, frontend hydration, and StatsKit source-layer counts.

## Severity and impact

Severity: **High** for research-readiness and analytical completeness.

No source evidence appears to have been lost in the Video 4 spatial-tone case. The principal risk is
false analytical deprivation, misleading completeness claims, and downstream reports treating a
partially executed or partially hydrated array as a full analysis.

## Resolution update — 2026-08-24

The affected corpus has been backfilled and the frontend hydration defect has been repaired.

### Persisted corpus results

| Video | Canonical spatial samples | Adaptive samples | Native relationships | Native observations |
|---|---:|---:|---:|---:|
| 1 Spirituality | 506 | 4,208 | 11 | 8 |
| 2 Business | 483 | 2,576 | 3 | 11 |
| 3 Technology | 477 | 2,126 | 13 | 9 |
| 4 Health | 333 | 2,134 | 13 | 12 |
| 5 Time | 308 | 3,323 | 11 | 5 |
| 6 Space | 190 | 2,065 | 9 | 12 |
| 7 Vision | 360 | 2,267 | 11 | 8 |

Every analysis now has readable canonical sidecars for:

- `spatial_tone_scan.json`
- `adaptive_visual_scan.json`
- `native_statistical_interpretation.json`

Video 4 frontend-route parity was verified at 333 spatial samples, 2,134 adaptive samples, and 13
relationships.

### Code repair

- Completed-analysis hydration explicitly loads the three canonical sidecars rather than depending
  on the bounded status summary to carry large arrays.
- The local artifact route recognizes all three sidecar types.
- The hard-coded contradiction-resolution null axis is excluded from the measured selected-video
  radar. StatsKit now labels it as a platform capability gap rather than a measured zero attributed
  to the analysis.
- A regression contract verifies sidecar hydration and contradiction-capability gating.

### Verification

- TypeScript: `npx tsc --noEmit` — passed.
- Focused StatsKit readiness regression tests — 2 passed, 0 failed.
- Corpus artifact parity — 7/7 spatial, 7/7 adaptive, 7/7 native relationship artifacts.
- Full existing frontend suite — 113 passed and 8 pre-existing governance-contract tests failed.
  These broader failures are not introduced by this repair and remain separate release-quality
  work; they must not be hidden when assessing overall repository readiness.
