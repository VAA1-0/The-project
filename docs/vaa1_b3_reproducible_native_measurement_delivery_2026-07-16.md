# B3 reproducible native measurement delivery

Date: 2026-07-16

## Outcome

Datascene/VAA1 now has an operational first measurement-run slice rather than a mock StatsKit demonstration. It measures the actual saved analysis artifacts for transcript extent, acoustic speaker-turn extent, voice activity and silence, and governed scene intervals.

The balance between usefulness and scientific rigour is explicit: measurements remain visible for inspection and descriptive work; independent evidence-quality evaluations determine whether comparative, proposition, or mature use is supported. Low fitness does not erase results, and computed output is not silently promoted into interpretation.

## Delivered contracts

- `vaa1.measurement_run.v1`: method/version, parameters, analytical unit, hashed input manifests, exclusions, measurements, limitations, evidence-quality use modes, deterministic content fingerprint, native-finding references, and affected-branch plan.
- `vaa1.native_finding.v1`: descriptive measurement value, run reference, source artifact traceback, quality reference, computed authority, native maturity, and explicit `not_interpreted` status.
- Atomic persistence under `outputs/api_results/{analysis_id}/stats_runs/{run_id}/`.
- Preview or persistence through `POST /api/analysis/{analysis_id}/measurement-runs/native-core` using `{"persist": false}` for a non-writing probe.

## Scientific safeguards

- Overlapping VAD intervals are unioned before speech duration is calculated, preventing double counting.
- Invalid or out-of-scope rows are listed with reasons.
- Speaker labels remain acoustic clusters and are not represented as people without separate confirmation.
- Scene boundaries are measured as registered intervals and are not treated as narrative meaning.
- Artifact hashes and method versions make input or method change visible.
- Correlation and network branches that previously returned fabricated demonstration values now return no result until governed observed inputs exist.

## Verification

- Isolated reproducibility, persistence, VAD union, finding traceback, use-mode, mock-retirement, and recomputation-plan cases are specified in `tests/test_reproducible_measurement.py`.
- The dependency-light Conda validation in `scripts/validate_b3_measurement_vertical_slice.py` passed in `vaa1_core` without modifying a saved analysis.
- A non-persisting live route probe through the canonical Conda launcher passed against analysis `0b16df1c-bc47-4b24-b90f-4d34e53c68e4`: all five inputs were available; 35 transcript segments, 39 speaker turns, 165 VAD intervals, and 6 scenes were measured; 4 findings and an 8-node downstream plan were returned.
- Python compilation and both JSON schema parses passed.
- `vaa1_core` does not currently contain the optional `pytest` package, so the isolated validator is the executable environment gate; no `.venv` or new dependency was introduced.

## Remaining after this slice

- Object, OCR, expression, prosody, and shot measurements were delivered in B4; camera composition still requires a saved measured artifact.
- Implement governed claim, proposition, relation, and state-transition services over native findings.
- Complete Meaning Network, Narrative Agent, and Boje 5B projections.
- Execute, rather than only plan, affected-branch local recomputation.
- Prove the complete correction, invalidation, recomputation, save/reopen, export, and source-traceback cycle.
