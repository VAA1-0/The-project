# Numerical reproducibility contract

Date: 6 November 2026
Release boundary: `#0.1`

## Decision

Datascene now separates four questions that were previously easy to conflate:

1. Were the same source bytes used?
2. Were the same parameters, models, provider versions, seeds and determinism
   flags used?
3. Were the produced artifact bytes identical?
4. If artifact bytes differ, are selected numerical results equal within an
   explicitly declared tolerance?

No semantic equivalence is inferred from numerical proximity.

## Reproducibility receipt

`GET /api/analysis/{analysis_id}/reproducibility` computes
`vaa1.numerical_reproducibility_receipt.v1` on demand. The receipt contains:

- governed source fingerprint;
- effective analysis parameters and their canonical execution signature;
- model choices and runtime/provider versions;
- stochastic-component inventory, random seeds and determinism flags;
- SHA-256 and byte length for every available registered output;
- unavailable output roles;
- one output signature over the artifact account; and
- missing controls and a truthful reproducibility state.

The states are:

- `controlled_exact_replay_eligible`: the declared controls are complete;
- `uncontrolled_stochastic_components`: a declared stochastic component lacks
  a seed; or
- `incomplete_reproducibility_evidence`: source, parameters, versions or output
  checksums are missing.

“Eligible” is not a promise that every hardware/backend combination is bitwise
deterministic. It means the receipt contains the controls required to test that
claim.

## Comparison

`POST /api/analysis/{analysis_id}/reproducibility/compare` compares a supplied
baseline receipt with the current state and returns exactly one classification:

- `exact_reproduction`;
- `numerically_equivalent_within_tolerance`;
- `configuration_or_input_changed`; or
- `output_drift`.

Absolute and relative tolerances default to `1e-9`, must be finite and
non-negative, and are returned in the comparison. Numeric differences retain
their structured value paths and absolute deltas. Output drift is never hidden
merely because a caller omitted numerical metrics.

## Verification

- Repeated controlled receipts produced stable execution and output signatures.
- A missing seed prevented a stochastic component from being labelled
  reproducible.
- Parameter changes were distinguished from output drift.
- Small numeric drift was accepted only under an explicit tolerance while the
  differing artifact checksum remained visible.
- 34 focused reproducibility, run-record, persistence, source-integrity and
  project-format tests passed.
- Python compilation and `git diff --check` passed.

The older combined `test_reproducible_measurement.py` suite could not collect in
the active virtual environment because its StatsKit import requires `nltk`,
which is not installed there. This dependency failure is not counted as passed
evidence and did not affect the dependency-free receipt contract tests.

## Remaining boundary

The receipt records declared seeds and flags; it does not automatically force
every third-party GPU/ML provider into a deterministic kernel mode. Each
stochastic provider must still expose and honor its recorded control before it
can claim controlled exact replay eligibility in production.
