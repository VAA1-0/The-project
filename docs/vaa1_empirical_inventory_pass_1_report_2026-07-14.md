# Datascene/VAA1 Empirical Inventory Pass 1 Report

Date: 2026-07-14
Scope: Operational core, BBox/ROI correction vertical
Decision: **NO-GO for Canonical Decision Ledger pilot implementation**

## Outcome

The first empirical phase is complete as an evidence-backed repository and representative-runtime audit. The existing BBox/ROI correction workflow is real: it creates source-scoped manual annotations, persists them through backend or local fallback routes, reloads them through analysis state, preserves raw detections, and is covered by a focused frontend governance suite that passed 49 tests.

It is not yet the target four-layer architecture. The current durable authority record is a bundled `ManualVisualAnnotation` inside `annotation_corrections.json`; display resolution remains substantially frontend-side; the representative Master Schema has correction records in its review layer but no projected object or track annotations; and no separate append-only Decision Ledger or backend Projection Engine exists.

## Empirical vertical trace

1. Raw observations are persisted in `tracked_objects.json`. The representative analysis contains 2,289 records. Fallback records use string time/geometry fields, raw detector classes, `untracked_*` identifiers, and `not_tracked_yolo_detection_fallback` status.
2. `VideoPanel.saveSelectedIndication` determines target, interval, normalized geometry, scope, and label.
3. `buildManualBBoxRoiAnnotation` creates a bundled manual correction with authority/maturity metadata, geometry keyframes, confirmation event, supersession reference, and traceback hints.
4. `VideoService.saveAnnotationCorrections` posts the entire correction collection to FastAPI and falls back to the local Next route.
5. FastAPI writes `annotation_corrections.json`, refreshes dependent scene-card material, appends an event, and persists `analysis_record.json`. The local route writes the corrections and analysis record directly.
6. Frontend helpers resolve manual, Master Schema, Narrative Agent, candidate, and raw labels for BBox display.
7. Master Schema rebuild functions exist, but the representative artifact contains 23 manual visual corrections only through `review_layer`; `object_annotations` and `track_annotations` are empty.
8. Project bundles include correction artifacts, but no stable canonical decision ID can yet be asserted across correction, projection, export, and traceback.

## Principal findings

- Observation, fallback track, semantic assignment, and Narrative Agent are conflated by generic IDs in several paths. The inventory now defines them separately, but runtime enforcement remains outstanding.
- Raw detector classes are preserved, which is correct.
- Time and geometry scoping for current manual BBox correction is comparatively mature.
- `apply_scope` can broaden effects beyond an interval, but there is no backend projection policy engine enforcing the consequence consistently.
- Authority and maturity metadata exist, but validity is not an independent operational state.
- The API replaces correction arrays in a mutable version-1 aggregate; it is not an append-only ledger with explicit supersession semantics.
- Local fallback persistence bypasses backend refresh/event behaviour, creating two non-identical save processes.
- Frontend authority helpers reduce duplication but remain a panel/client authority resolver.
- Candidate artifacts record confirmation needs and blocked promotions, but the absence of a canonical write boundary prevents a complete proof that candidates cannot mutate mature state elsewhere.
- The focused test suite is strong source-contract coverage, but it is primarily static/source-pattern testing rather than a rendered end-to-end save/restart/export test.

## Gate blockers

Four blockers prevent `GO`:

1. Define and validate the registry with a formal JSON Schema and contract test.
2. Implement explicit validity/invalidation evaluation for track split/merge, clock change, geometry correction, and source replacement.
3. Implement a read-only backend projection endpoint for the existing correction records and prove parity with current frontend label resolution.
4. Prove a hard candidate-service write boundary and a save/restart/reopen/export/traceback test using one stable decision/projection reference.

The third item should be implemented as a compatibility projection over existing data before introducing the new ledger. This creates an empirical baseline and avoids migrating into an unverified resolver.

## Recommended bounded next slice

Deliver a **Projection Compatibility Slice** without changing the source artifacts:

1. Add schemas and validators for the Pass 1 registry and typed subject references.
2. Add a backend `projected-state` read endpoint that resolves one BBox subject and time from raw observations plus current corrections.
3. Return raw value, projected value, authority, maturity, validity, scope, evidence refs, and correction refs.
4. Compare endpoint results with existing `bbox-authority.ts` results in contract fixtures.
5. Add one integration test covering save, server-state reload, projection, bundle inclusion, and traceback reference.
6. Re-evaluate the four failed/partial gates. Only then begin writing new canonical decisions.

## Deliverables

The populated evidence artifacts are under `docs/inventory/`. They distinguish semantic definitions from implementation bindings and record the current `NO-GO` without treating missing information as evidence.
