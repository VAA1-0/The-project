# VAA1 governed audio sample economics and scene membership delivery

Date: 2026-07-30
Branch: `petteri`

## Delivery objective

This sprint operationalizes two reusable evidence-governance capabilities:

1. governed audio sample maturation with computational economics; and
2. defensible scene membership for source-timed Meaning Network evidence.

The implementation is analysis-agnostic. A representative persisted analysis was used
for runtime acceptance, but no rule, threshold, scene count, character name, duration, or
source-specific interval is hard-coded into the delivery.

## Governing principles

### Audio sampling

- Samples are reusable evidence windows, not automatic voice identities.
- Stable fingerprints and subject references prevent silent duplication.
- Analyst-confirmed identity remains distinct from measured diarization clusters and
  transcript mentions.
- Dense analysis must be justified by measured yield and authority gaps.
- A full dense pass is not the default response to incomplete maturation.
- Targeted windows must be bounded and deduplicated.

### Scene membership

- Scene membership is a governed temporal relationship, not an admission gate.
- Evidence remains visible and source-navigable when scene timing is unavailable.
- A provisional scene interval may create provisional membership, but not mature scene
  truth.
- Scene cuts use half-open intervals so evidence at a cut is not assigned to both scenes.
- Interval evidence is assigned by maximum positive temporal overlap.
- Evidence outside governed scene coverage remains unresolved.
- Synthetic full-media scenes and equal-band stretching are not accepted timing
  authorities.

## Governed audio sample maturation

Audio sample-cloud records now include:

- stable sample fingerprints;
- stable speaker-cluster or Narrative Agent candidate subject references;
- reusable sample keys;
- exact start, end, and duration;
- source-turn and supporting-evidence references;
- source-navigation targets for Video;
- timing, staleness, and confirmation eligibility;
- reusable/source-linked sample counts; and
- authority-preserving review state.

The audio sample data-cloud schema was updated to declare these fields and the existing
Narrative Agent voice-pattern candidate type.

## Computational economics

Every rebuilt audio sample-cloud artifact now receives a canonical economics projection
with:

- measured build time;
- retained artifact bytes and megabytes;
- remote API and GPU use recorded by the local build;
- cloud, sample, unique, reusable, confirmed, and confirmation-eligible counts;
- source-linked count;
- duplicate count;
- sampled duration and source-coverage ratio;
- reuse and waste ratios;
- bounded dense-analysis target windows; and
- an explicit economic verdict.

The current policy outcomes are:

- `baseline_sampling_required` when no reusable samples exist;
- `targeted_dense_pass` when samples exist but timing or identity authority blocks
  confirmation;
- `stop_and_reuse` when duplicate yield makes another pass uneconomic; and
- `baseline_sufficient` when reusable governed samples already support the next step.

The policy never recommends a full dense pass automatically. Target windows prioritize
Narrative Agent candidate evidence, lower-confidence material, and useful duration while
deduplicating identical source intervals.

Analyst attention remains `not_observed` until the system has a real review-duration
record. It is not estimated or silently converted to zero.

## Product surfaces

### Data Maturation

The audiovisual source-sampling lane remains the governance home for sample readiness.
It now also exposes:

- reusable versus unique samples;
- duplicate/waste count;
- source coverage;
- measured build and storage cost;
- dense-pass recommendation;
- recommendation rationale; and
- bounded target-window count.

### StatsKit

StatsKit consumes the same canonical economics object. Its source-layer audit distinguishes:

- total sample rows;
- reusable samples;
- unique samples;
- duplicates;
- analyst-confirmed Audio annotations; and
- the governed next-action recommendation.

StatsKit does not merge measured sample availability with confirmed identity.

## Defensible scene-time resolution

The Meaning Network scene resolver now evaluates available timing sources in authority
order:

1. visual scene intervals carrying valid start/end coordinates;
2. persisted summary scene intervals;
3. governed scene-card intervals; and
4. Master Schema scene temporal segments.

Sources without valid positive-duration intervals are skipped. Selected scene intervals
carry their source, authority, and review state into scene nodes and evidence membership.

When the selected source is candidate-governed, scene nodes and memberships remain
candidate/provisional. They do not become confirmed scene truth merely because an overlap
can be calculated.

## Meaning Network projection

Source-timed audio events, diarization turns, transcript lines, visual detections, and
confirmed audio anchors receive:

- one stable evidence-node identity;
- provisional resolved scene ID when supported;
- `maximum_temporal_overlap` as the membership method;
- the governing scene timing authority;
- a scene relationship edge; and
- retained one-click source navigation.

Evidence outside coverage receives:

- `scene_id: null`;
- `scene_membership_status: unresolved`; and
- no fabricated scene edge.

The graph summary reports:

- scene timing source and authority;
- timing review state;
- coverage start and end;
- provisional resolved node count;
- unresolved node count; and
- the membership algorithm.

## Corrective safeguards

Regression work during the sprint caught and removed:

- zero-length non-overlaps being accepted as membership;
- evidence at a cut being claimed by the preceding and following scenes;
- the legacy synthetic full-media scene fallback;
- final-scene stretching beyond governed coverage; and
- duplicate nodes caused by scope-dependent fallback IDs.

Stable source IDs are now independent of whether scene membership resolves.

## Verification

Automated verification passed:

- audio sample-cloud contract tests;
- Meaning Network scene-membership contract tests;
- live mature-data proliferation integration tests;
- visual integration contracts;
- frontend TypeScript validation; and
- the complete frontend manual-annotation governance suite.

Runtime acceptance confirmed that:

- the economics artifact is rebuilt and persisted;
- target windows are bounded and interval-deduplicated;
- full dense analysis remains disabled by policy;
- governed scene timing produces provisional scene membership;
- out-of-coverage evidence remains unresolved and navigable; and
- the Meaning Network contains no duplicate node IDs.

## Remaining program work

- Capture real analyst review duration and decision yield for subsequent economics
  comparisons.
- Compare successive maturation runs to measure marginal yield and diminishing returns
  over time, not only within one artifact.
- Add analyst scene-boundary confirmation, correction, merge, and split workflows.
- Promote provisional memberships only when their governing scene intervals are reviewed
  or otherwise reach the required maturity.
- Continue improving scene coverage through governed detection or analyst work without
  making any single acceptance source the architectural template.
