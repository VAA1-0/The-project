# Stage 2 Accepted-State Operating Contract

Date: 2026-10-14
Status: Governing delivery refinement; implementation remains incremental

This contract refines Stage 2 of the General Sprint Regime. It does not declare
all Stage 2 capabilities delivered. A capability is delivered only when its
backend persistence, frontend interaction, navigation, hydration, reopen and
regression evidence pass.

## Authority balance

The analyst is the highest operational authority. Datascene should nevertheless
do useful analysis before asking for a decision: it may detect, group, track,
rank, suggest and preselect review candidates. A candidate becomes accepted
truth by either:

1. an explicit analyst confirmation/correction; or
2. governed constellational proof with a calibrated score of at least `0.99`.

The second route is deliberately narrower than “a detector reports 99%.” It
requires a typed proof envelope, independent evidence modalities, source/time
anchors, visual coordinates when visual evidence is used, project-bound scope,
no unresolved contradiction and complete traceback. An uncalibrated similarity
score, repetition, visualization or a single model confidence can never satisfy
this route. Any doubt remains a review candidate.

Continuity is not needless re-identification. Within a bounded source and valid
track/scene context, an accepted identity may propagate along an object track.
Across a cut or broken track it needs governed persistence evidence. Audio,
visual appearance, body movement, lip motion, transcript and contextual evidence
may jointly establish constellational proof; ambiguity or conflict returns the
claim to review.

## S2 delivery interpretation

- **S2.1 — Authority and suggestions.** Preserve analyst supremacy while
  surfacing automated candidates. Permit automatic accepted state only through
  the governed 99% constellational-proof route above.
- **S2.2 — Compound and batch decisions.** Store typed decisions systematically,
  without requiring one gesture per attribute. One review action may confirm a
  governed bundle—for example visual identity, linked voice sample and transcript
  segment—while retaining separate evidence refs and reversible facets.
- **S2.3 — Saloon doors and Global Clock.** Video and every applicable leaf share
  the canonical source beat. Selection on either side automatically prepares and
  reveals the corresponding beat, record and overlay without stealing leaf focus,
  duplicating panels or creating an event loop.
- **S2.4 — Durable append-only decisions.** Corrections, confirmations,
  rejections, merges and splits are revisioned; superseded state remains in
  traceback.
- **S2.5 — Idempotency and concurrency.** Retries do not duplicate decisions;
  stale editors cannot overwrite a newer revision and receive a recoverable
  conflict response.
- **S2.6 — One accepted-state projection.** Master Schema coordinates one
  versioned accepted view. Panels cache/project it but do not become independent
  truth stores.
- **S2.7 — Relations and graph projection.** Accepted nodes, edges and relation
  types project to both Meaning/Plot and Narrative Agent knowledge graphs with
  source anchors, direction, maturity, authority and traceback.
- **S2.8 — Scalable review.** Support grouped review, track/interval propagation,
  similarity clusters, keyboard traversal, confirm-all-except and explicit scope.
  Datascene must not make the analyst repeat the original analysis.
- **S2.9 — Confidence as a service.** Expose calibrated components, modality
  independence, conflicts, missingness and the reason a claim is candidate or
  accepted. Confidence assists decisions; it does not conceal authority changes.
- **S2.10 — Master Schema UI.** Make Master Schema available as an inspectable
  governance workspace and drill-down: accepted/candidate/history views,
  evidence, dependencies, projections and traceback. Keep it out of the critical
  path for ordinary confirmations; progressive disclosure avoids schema labor.
- **S2.11 — Pattern work remains possible.** Candidate pattern recognition,
  groups, tracks, packs, Narrative Agent paths and path dependencies may be
  computed and explored before confirmation. Their status must remain visible;
  inference does not silently become accepted identity or fact.
- **S2.12 — Persist before broadcast.** A decision is durable before consumers
  receive its revisioned update; failed persistence cannot create UI-only truth.
- **S2.13 — Hydration.** Every applicable panel loads accepted state on open,
  refresh and project reopen. Stale responses cannot replace newer state, and
  unavailable artifacts surface a typed reason rather than an empty panel.
- **S2.14 — Source and geometry fidelity.** Carry source id, clock interval,
  frame/sample references and BBox/ROI coordinates through decisions,
  projections, graphs, exports and traceback. Associated panels receive the same
  canonical record.
- **S2.15 — Growing vocabularies.** Category, attribute and relation vocabularies
  are versioned and extensible. Unknown/new terms can be proposed and mapped
  without data loss or a closed-enum dead end.
- **S2.16 — Canonical correction propagation.** A saved correction automatically
  projects to every applicable current consumer; raw substrate remains only for
  provenance and cannot overrule it.
- **S2.17 — Hermetic project boundary.** Project scope is inviolable. No evidence,
  identity memory, vocabulary override or accepted decision from another project
  may surface unless explicitly admitted through reference-data utilities with
  provenance and policy.
- **S2.18 — Reopen and interruption recovery.** Accepted state, alternatives,
  geometry, compound facets and projection revisions rebuild deterministically
  after interruption or restart.
- **S2.19 — Dependency invalidation.** Corrections invalidate only affected
  dependents, preserve unrelated evidence and block stale derived results from
  active projection.
- **S2.20 — Portable minimum fixture.** Export/import preserves project/source
  identities, clocks, decisions, coordinates, dependencies, accepted/candidate/
  history distinctions and checksums.
- **S2.21 — Learning-ready corrections.** With project policy and consent,
  corrections emit versioned training/evaluation examples containing inputs,
  prior prediction, analyst decision, scope and provenance. Learning artifacts
  never mutate operational authority and must not cross project boundaries by
  default.
- **S2.22 — Test-first operational delivery.** Backend contracts and frontend
  rendered/navigation tests precede implementation. A schema, source assertion or
  hidden route is not delivery: the feature must be visible, navigable, usable,
  persistent and compliant with Datascene design principles.

## First vertical slice and current evidence

The active first slice is S2.16–S2.18 through BBox/ROI identity correction,
because it exercises analyst authority, time/geometry, persistence, propagation,
hydration and reopen behavior together.

Delivered in this increment:

- matcher tests prove raw detector confidence cannot qualify as constellational
  proof;
- a calibrated `>=0.99` proof needs at least three independent modalities,
  anchors, visual geometry when applicable, project-scope agreement and no
  unresolved conflicts;
- the matcher no longer grants mature triangulated authority from a naked
  high-probability score.
- verified BBox saves invalidate cached derived projections before broadcasting
  the canonical associated-memory envelope;
- analyst BBox correction labels outrank backend, Narrative Agent and detector
  projections at the corrected interval;
- Objects installs the canonical committed correction immediately, while
  Meaning/Plot and Master Schema refresh their accepted-state projections;
- a disk reopen fixture preserves the exact analyst label, interval, normalized
  visual coordinates, authority and traceback reference;
- Saloon Doors navigation preserves a fresh leaf-supplied Global Clock beat when
  opening another analysis, while an ordinary project open still starts at zero;
- rendered Chromium acceptance proves normalized analyst BBox geometry, drag,
  resize and source-video origin across panel resizing.

The S2.16-S2.18 BBox vertical slice is complete at its bounded acceptance gate.
The following are subsequent Stage 2 increments, not conditions silently folded
into that completed slice:

- compound audiovisual/transcript confirmation and batch-review controls;
- graph edge/relation projection and learning-example emission.
