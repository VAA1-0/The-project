# VAA1 Canonical Decision and Invalidation Pilot — Delivery

Date: 2026-07-14
Scope: BBox/ROI label correction vertical slice

## Delivered operating path

1. The analyst saves a BBox/ROI label correction through the existing editor.
2. The verified legacy annotation remains the compatibility record.
3. The frontend dual-writes a typed `correct_assignment` event to the append-only canonical ledger.
4. Later overlapping assignments supersede earlier decisions by reference; no accepted record is overwritten.
5. The backend projection resolves active canonical authority before legacy correction and raw detection authority.
6. Removing the linked annotation appends an `invalidate` event during the same backend correction-save operation.
7. Projection suppresses the invalidated canonical assignment and its linked legacy correction, then uses source evidence when available.
8. Missing or replaced authority is communicated only through quiet operational indications.

## Persistent artifacts and APIs

- Ledger: `outputs/api_results/{analysis_id}/decision_ledger.json`
- Persisted status mirror: `analysis_record.json.canonical_decision_ledger`
- Decision API: `GET/POST /api/analysis/{analysis_id}/decisions`
- Invalidation API: `POST /api/analysis/{analysis_id}/decisions/invalidate`
- Projection API: `GET /api/analysis/{analysis_id}/projected-state`
- Batch projection API: `POST /api/analysis/{analysis_id}/projected-state/batch`

## Scientific and governance properties

- Raw detector evidence is retained and is not rewritten as semantic truth.
- Canonical decisions are append-only and idempotent by decision ID.
- Supersession and invalidation preserve the complete decision history.
- Invalidation suppresses linked compatibility authority, preventing stale fallback resurrection.
- Evidence, correction, decision, and invalidation references remain available for traceback.
- UI fallback is calm and operational; no new warning banner, toast, or alert is introduced.

## Validation evidence

- Backend decision, projection, and API contract tests: 14 passing.
- Frontend governance tests: 51 passing.
- TypeScript: `npx tsc --noEmit` passing from `src/frontend`.
- Python source compilation passing.
- Inventory and schema JSON parsing passing.
- `git diff --check` passing.

## Rollback and compatibility

The legacy annotation-correction path remains operational throughout the pilot. If canonical creation is unavailable, the verified legacy save remains usable. Canonical artifacts are additive and can be excluded from projection without modifying raw evidence or historical decisions.

## Deliberately deferred

- Runtime artifact capture from a new live analyst session.
- Clock-change and retiming invalidation.
- Track split/merge and geometry recomputation governance.
- Taxonomy version/deprecation invalidation.
- Canonical writers and projection migration outside BBox/ROI.
- Hard architectural enforcement preventing candidate services from writing authoritative decisions.

This phase is complete within its stated BBox/ROI pilot boundary. The broader empirical-system gate remains intentionally `no_go` until the deferred items are implemented and evidenced.
