# Datascene/VAA1 B1 Foundation Services Delivery

Date: 2026-07-15
Status: vocabulary and source-clock services operational; taxonomy persistence and source-policy mutation probes pending

## Delivered vertical slice

### Canonical vocabulary service

- Loads and validates the versioned repository vocabulary registry.
- Resolves vocabulary/version/term identities.
- Preserves requested deprecated identity while following a validated replacement path.
- Supports language-specific labels with a preferred-label fallback.
- Exposes vocabulary listing and term-resolution API routes.

### Governed taxonomy applications

- Resolves the term before application.
- Writes a scoped, idempotent analyst decision through the existing canonical ledger.
- Persists term ID, vocabulary version, requested identity, replacement path, evidence references, authority, maturity, validity, and decision lineage.
- Does not create a parallel taxonomy truth store.

### Source-policy gate

- Persists source policy inside Source Media user annotations.
- Evaluates local analysis, provider use, CVAT transfer, and report/data export purposes.
- Keeps local work available with a quiet `policy_incomplete` state when legacy metadata has no policy.
- Requires explicit permission for external transfer and export, and honors purpose/provider restrictions.
- Records evaluations as operational analysis events, not empirical claims.

### Source-clock authority

- Normalizes seconds and milliseconds against the source duration.
- Orders explicit correction, verified anchor, VAD-verified anchor, measured, candidate, inherited, degraded, and unknown timing.
- Uses precision to resolve candidates at equal authority.
- Returns only dependents overlapping the corrected interval.
- Leaves persistence and canonical invalidation to the existing ledger boundary.

## API bindings

- `GET /api/vocabularies`
- `POST /api/vocabularies/resolve`
- `POST /api/analysis/{analysis_id}/taxonomy-applications`
- `POST /api/source-media/{analysis_id}/policy/evaluate`
- `POST /api/analysis/{analysis_id}/source-clock/resolve`
- Existing `POST /api/source-media/{analysis_id}` now accepts `source_policy`.

## Verification

The focused suite proves registry validation, versioned term resolution, multilingual replacement lineage, idempotent canonical application, calm legacy-policy behavior, restricted external use, clock normalization, authority ordering, and local overlap planning.

The implementation is recorded as `implemented_awaiting_runtime_probe`. Promotion to `operational` requires starting the backend against a real saved analysis and proving:

1. Vocabulary route readback.
2. Taxonomy application persistence through close/reopen.
3. Source-policy readback and allowed/blocked evaluations.
4. Source-clock resolution and forwarding of affected refs to canonical dependency invalidation.

Runtime correction note (2026-07-15): an attempted `.venv` launch was invalid and is not accepted as a Datascene/VAA1 runtime probe. The documented program uses the two Mac Conda environments: `vaa1_core` for the main API/core pipeline and `vaa1_face` for face/DeepFace capability. Both must be present and verified through `scripts/start_vaa1_macos.sh`; `.venv` is not a supported substitute. No saved analysis was mutated by the invalid attempt. Operational promotion therefore still requires a probe through the documented two-environment startup.

Supported runtime result (2026-07-15): both `vaa1_core` and `vaa1_face` passed launcher import verification. The stale backend was restarted with `bash scripts/start_vaa1_macos.sh --backend-only --replace`. Live vocabulary listing and term resolution succeeded. A non-mutating source-clock probe on an existing saved analysis selected `anchor_verified` over `inherited` timing and returned only the overlapping dependent. The vocabulary and source-clock graph stages are therefore operational. Taxonomy application persistence and source-policy evaluation remain `implemented_awaiting_runtime_probe` because this verification deliberately did not add decisions or policy events to the user’s saved analyses.

## Next implementation slice

After the runtime probe, continue B1/B2 with graph validation and affected-branch planning in the application, then evidence-quality and cross-modal source-clock closure. B3 statistical execution must not consume domain evidence until those gates are met.
