# Representative workload and usability qualification — 6 November 2026

## Outcome

Datascene now has a fixed, machine-readable release matrix for representative
workloads and developer-free analyst use. The authoritative scenarios and
thresholds are in `config/release_workload_qualification.json`; the current
assessment is exposed at `GET /api/release/workload-qualification`.

The present release state is **blocked**. Existing evidence fragments are not
promoted into workload passes. Six project-isolated multilingual COP30 analyses
are useful operational evidence but remain below the declared multilingual and
many-short-clips sample thresholds. VFR unit/consumer contracts are not three
rendered VFR source runs. The historical low-disk incident is not a controlled
constrained-resource qualification. No accepted dense-detection, eight-hour
session, feature-length save/reopen, or developer-free analyst receipt exists.

## Frozen scenario matrix

| Scenario | Minimum release observation | Current state |
| --- | --- | --- |
| Many short clips | 50 sources; ≥98% completion; zero project contamination or unrecoverable loss | Insufficient scale |
| Dense detections | ≥100,000 detections; ≥99% source navigation; ≤500 ms p95 interaction; zero loss | Not executed |
| Multilingual material | ≥3 languages across ≥12 completed sources; complete disclosure; zero cross-analysis leak | Partial, below threshold |
| Variable frame rate | 3 VFR sources; ≤1-frame anchor error; 100% save/reopen navigation | Unit contract only |
| Long source | ≥2 hours; completed pipeline; verified save/reopen; zero loss | Manual gate open |
| Sustained session | ≥8 hours; ≥10 save/reopen cycles; zero uncaught errors or loss | Not executed |
| Constrained resources | ≤8 GB RAM and ≤20 GB free storage; complete or clean refusal; zero loss | Incident evidence only |
| Independent analyst workflow | 2 analysts; 100% main-task completion; no developer intervention or critical usability failure | Not executed |

## Evidence receipt contract

Each run supplies `vaa1.workload_evidence_receipt.v1` with a frozen system
revision, dataset edition, executor role, environment, measured metrics and
evidence artifacts. The evaluator recomputes every criterion; a receipt does
not pass merely because it labels itself successful. Missing metrics, wrong
types and below-threshold values fail closed. Duplicate scenario receipts are
rejected so a release cannot silently choose the more favorable run.

Project boundaries are mandatory in every scenario. A receipt must enumerate
the admitted project IDs and bind every analysis ID to exactly one of them. It
must report zero unbound analyses, foreign-project reads and boundary
violations, and carry an explicit verified boundary state. This gate is
evaluated before workload thresholds: a fast, complete run with any project
leak still fails qualification.

This slice freezes the qualification question and prevents overclaiming. It
does not fabricate the expensive empirical runs. Release closure requires
executing all eight scenarios in the declared environments and retaining the
machine observations plus human-visible evidence.
