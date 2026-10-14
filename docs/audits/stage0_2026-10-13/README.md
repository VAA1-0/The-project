# General Sprint Stage 0 delivery record

Date: 2026-10-13
Branch: `petteri`
Baseline commit: `ffac6be4c69cfb70f9e91b9d64efaf625eb40ccd`
Fixture project: `research-test-2-20226-cop30-vids`

## Verdict

Stage 0 is **delivered for the selected six-analysis workshop baseline**. This
is a bounded foundation gate, not a full-suite, packaging or release
certification. Existing unrelated worktree material was preserved.

The repeatable verifier is `scripts/verify_stage0_baseline.py`. It is read-only
and fails closed on project/analysis identity mismatch, shared or missing source
media, missing or corrupt manifests, absent artifacts, checksum drift,
correction ownership mismatch, or canonical-ledger ownership mismatch. Its
output includes source, record, correction and ledger fingerprints suitable
for a later recovery comparison without copying analyst content.

## Real-project evidence

- six analyses selected; six completed;
- six distinct source-media files present and fingerprinted;
- six analysis-directory IDs agree with their persisted analysis IDs;
- six embedded canonical decision ledgers agree with their analyses;
- the existing correction sidecar is valid and analysis-bound;
- 90 of 90 registered full-analysis branch artifacts are present;
- 90 of 90 registered artifact checksums verify;
- final gate result: `pass`, zero issues.

The first gate run failed on all six transcript checksums. The timeline-language
refresh had rewritten each governed transcript without rebuilding the
full-analysis manifest. Both the external manifest and embedded projection were
therefore consistently stale. No source, transcript, correction or analyst
decision was missing.

The six pre-repair records and manifests were copied to
`backups/stage0-manifest-repair/20261013T103741Z/`. The repair rebuilt manifests
from the current artifacts and updated their embedded record projections. The
language-profile refresh now refreshes the manifest before persisting the
analysis record, preventing recurrence.

## Reproduction

```bash
conda run -n vaa1_core python scripts/verify_stage0_baseline.py \
  --project research-test-2-20226-cop30-vids
```

The repair command is deliberately dry-run unless `--apply` is supplied:

```bash
conda run -n vaa1_core python scripts/repair_project_full_analysis_manifests.py \
  --project research-test-2-20226-cop30-vids
```

## Automated acceptance

- Stage 0 verifier and repair-safety contracts: 3 passed;
- Stage 0 plus current language/project/transcript boundary contracts: 11 passed;
- frontend TypeScript: passed;
- canonical Datascene runtime remained healthy before this delivery;
- broad frontend source-contract status remains 212/225 passing, with 13
  pre-existing source-shape failures. It is not represented as green.

## Exact Stage 1 residual qualification

Existing M1–M5 Global Clock deliveries and the M6 core round trip are retained
as historical acceptance; they are not reopened by Stage 0. The remaining
qualification checks are:

1. classify or fix the observed media normalization from `1:11.001` to
   `1:11.000` against declared source precision;
2. repeat the M1 agreement observation on a real source longer than 1,000
   seconds;
3. repeat M6 portable restoration using the selected isolated project and
   recheck M1 landmarks plus M3 correction/history after import;
4. verify that the repaired transcript checksum remains stable after the next
   governed language-profile refresh and service restart.

Project isolation, Global Clock authority, mature-data precedence, canonical
artifact precedence and fail-closed hydration remain mandatory throughout.
