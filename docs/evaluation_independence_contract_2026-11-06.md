# Evaluation independence contract

Date: 6 November 2026
Release boundary: `#0.1`

## Release distinction

Internal regression tests remain legitimate evidence that a function behaves as
specified. They are not independent evidence of accuracy, generalization,
comparative performance or population-level validity. Datascene now records
these evidence classes separately.

The present release disposition is frozen in
`config/release_evaluation_register.json`. Current functional tests and manual
acceptance documents are classified as `internal_functional_evidence_only`.
Narrative Agent generalization and exploratory-clustering accuracy claims are
`withheld_independence_not_proven`; the absence of an independent study does not
erase their bounded functional or experimental availability.

## Cohort contract

Evaluation cohorts must declare one role:

- development;
- training;
- calibration;
- internal regression; or
- independent holdout.

Membership is represented by stable source IDs and a verified cohort
fingerprint. For accuracy, generalization, comparative-performance or
population-benchmark claims, the assessor requires:

- an independent-holdout cohort;
- no source overlap with development, training or calibration;
- a holdout freeze timestamp preceding evaluation;
- predeclared metrics;
- a frozen system revision; and
- an evaluator outside the implementation actor set.

Failing any gate withholds the independence claim and returns named blocking
reasons. Development and calibration material can never be relabelled as a
holdout merely by changing the cohort name.

## API boundary

- `GET /api/release/evaluation-policy` exposes the roles, claim classes, rule
  and current release evidence dispositions.
- `POST /api/release/evaluation/assess` validates a proposed evaluation and
  returns its overlap account, independence state and claim disposition.

An internal functional assessment returns
`internal_functional_evidence_only`, not “failed.” An unsupported performance
claim returns `withheld_independence_not_proven`, not an invented negative
accuracy result.

## Verification

- A frozen, non-overlapping holdout with an independent evaluator passed.
- Development/holdout overlap was detected by source ID.
- Implementer self-certification was rejected for performance claims.
- Internal functional evidence retained its useful bounded disposition.
- Post-evaluation holdout freezing and absent predeclared metrics were rejected.
- False cohort fingerprints were rejected.
- The current release register was verified not to present internal tests as
  independent performance evidence.
- 31 focused evaluation, release, reproducibility, project-format and
  source-integrity tests passed.
- Python compilation and `git diff --check` passed.

## Remaining boundary

This contract prevents evidence-category substitution; it does not create an
independent evaluator or a representative holdout corpus. Those must be supplied
and governed separately before withheld accuracy/generalization claims can be
promoted.
