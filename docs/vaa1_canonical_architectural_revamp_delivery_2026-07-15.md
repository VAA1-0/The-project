# VAA1 Canonical Architectural Revamp — Delivery

Date: 2026-07-15
Status: operational architecture delivered

## Outcome

Datascene/VAA1 now has one governed route from evidence and analyst review to canonical decisions and projected operational state. The earlier BBox/ROI pilot has been generalized across manual visual assignments, object/cinematic/other label overrides, drop decisions, Narrative Agent confirmations, Meaning Network relationship reviews, and proliferation candidate decisions.

The architecture retains compatibility data while removing its role as an independent truth island. Existing panels can continue operating during incremental UI cleanup, but authoritative writes, validity, and shared projection now have backend contracts.

## Operating architecture

1. Raw and interpreted pipelines create evidence or candidates only.
2. Analyst work may continue through existing correction interfaces.
3. The backend correction boundary atomically converts governed records into typed canonical events.
4. Canonical write policy rejects automatic and candidate-service attempts to declare accepted truth.
5. Decisions are immutable, append-only, content-idempotent, and superseded by reference.
6. Removal and dependency changes append invalidation events rather than altering history.
7. Projection selects the highest valid authority in scope and retains full traceback.
8. Canonical projections are included in the standard analysis response and available through bounded specialist APIs.
9. Video, Meaning Network, and Master Schema consume canonical projections operationally.
10. Existing saved analyses backfill their governed corrections when canonical state is first accessed.

## Canonicalized compatibility sources

- `annotation_corrections.manual_visual_annotations`
- `annotation_corrections.label_overrides`, including drop decisions
- `annotation_corrections.proliferation_decisions`, including confirm, reject, defer, and review actions

Compatibility artifacts are retained for rollback, export continuity, and comparison. Panels no longer perform a second independent canonical write after saving corrections.

## Validity and dependency behavior

- Annotation removal invalidates linked decisions atomically.
- Transcript/media clock-offset changes mark time-scoped decisions stale and reviewable.
- Track split/merge, geometry, evidence, and taxonomy changes use the shared dependency-change endpoint with affected decision, subject, property, or evidence references.
- Invalidated canonical decisions and linked legacy corrections cannot silently reappear through fallback.
- Source evidence remains visible when reviewed authority is stale or invalid.

## APIs and artifacts

- `GET/POST /api/analysis/{analysis_id}/decisions`
- `POST /api/analysis/{analysis_id}/decisions/invalidate`
- `POST /api/analysis/{analysis_id}/decisions/dependency-change`
- `POST /api/analysis/{analysis_id}/claims/projected`
- `GET /api/analysis/{analysis_id}/projected-state`
- `POST /api/analysis/{analysis_id}/projected-state/batch`
- `outputs/api_results/{analysis_id}/decision_ledger.json`
- `analysis_record.json.canonical_decision_ledger`
- Standard analysis response fields `canonical_decision_ledger` and `projected_canonical_claims`

## Runtime evidence

The validation command

```text
python3 scripts/validate_canonical_architecture.py 56e2273e-3338-4b93-ae2e-f6f644e4d773
```

processed a validation copy of real saved work while preserving the source artifact. Results:

- 23 manual visual annotations and one label override read.
- 24 append-only canonical events created.
- 24 canonical claims projected.
- 22 Narrative Agent assignments and two semantic label assignments resolved.
- Every canonical event retained evidence or correction traceback.
- Every projected decision reference resolved to the ledger.
- A candidate-service authoritative write was actively rejected.

Artifacts are under `outputs/api_results/architecture-revamp-validation-2026-07-15/`.

## Verification

- 29 targeted architectural backend contracts passed.
- 85 complete frontend tests passed.
- TypeScript `npx tsc --noEmit` passed.
- Python compilation for all changed backend modules passed.
- Runtime validation checks passed.
- JSON and diff-integrity checks passed.

A broader Python contract discovery run executed 150 tests. It exposed no additional revamp regression after correcting one new test matcher. Six unrelated tests could not initialize because the active system Python lacks FastAPI/Pydantic or uses an existing OpenCV test stub without `VideoWriter.isOpened`; one test was skipped. These environment limitations are recorded rather than represented as product failures.

## Calm interface behavior

No new banner, toast, blocking alert, or repeated missing-data notification was introduced. Projection and ledger unavailability retain quiet compatibility fallback. Stale or invalid authority is described only through compact operational indications where useful.

## Remaining compatibility cleanup

The architectural revamp is delivered. Remaining work is ordinary migration and feature extension rather than a missing architecture:

- Individual secondary panels may replace direct compatibility reads with the already available `projectedCanonicalClaims` field.
- Trackers and taxonomy editors may call the existing dependency-change contract automatically at more producer sites.
- Additional scientific attribute families may add adapters and projection consumers using the same contracts.
- The compatibility correction bundle can be deprecated only after export and older-project support windows are intentionally closed.

These items do not require another authority architecture. They extend or retire surfaces on the delivered one.

## Runtime-load alignment delivered

The post-delivery manual test identified eager panel initialization, repeated full-status reads,
and unstable source-media URLs as the main response-time costs. The runtime regime now:

- keeps source-video URLs stable so browser byte-range caches remain reusable;
- coalesces concurrent status and reusable-artifact reads;
- uses `GET /api/status/{analysis_id}/summary` for bounded shell and media bootstrap data;
- defers hidden GoldenLayout panel initialization until first activation;
- invalidates bounded caches after governed correction writes;
- uses inactivity for one-at-a-time, Pareto-ranked warming of compact status, shared analysis,
  Master Schema, Scene Cards, and Meaning Network data.

Idle work is interrupted before launch by user input, reset after corrections, and never invokes
the SOM/open-topology refresh path. Foreground interaction retains computational priority.
