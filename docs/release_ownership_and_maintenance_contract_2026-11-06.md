# Release ownership and maintenance contract — 6 November 2026

## Outcome

Datascene now has one governed maintenance authority at
`config/release_maintenance_register.json`, exposed by
`GET /api/release/maintenance`. It defines accountable roles, severity and
blocker rules, the known-issues register, diagnostic redaction, patch and
rollback sequencing, and model-update governance.

The current result is **blocked**. Human assignees have not been authorized for
release owner, incident owner, data steward or model steward, so the register
leaves those roles explicitly unassigned. Python artifacts are now hash-locked,
but clean Mac/Windows install and installer-integrity receipts and the eight
representative workload receipts remain open P1 release blockers. This contract
does not invent accountability or turn an unapproved draft into a release.

## Severity and known issues

- **P0 critical:** one-hour response target; always blocks release. Data loss,
  project-boundary breach, source corruption and secret disclosure belong here.
- **P1 high:** 24-hour response target; blocks release. Core workflow loss,
  false mature findings and unrecoverable analysis state belong here.
- **P2 moderate:** five-day response target; may ship only with a bounded,
  visible workaround and owner.
- **P3 low:** fifteen-day response target; cosmetic or documentation defects.

Every known issue requires a stable ID, severity, state, accountable role,
summary, evidence and mitigation. An open or merely mitigated P0/P1 remains a
blocker; only closure removes that gate. Project-boundary and data-loss incidents
cannot be severity-downgraded because a later run happens to pass.

## Diagnostics and privacy

`POST /api/release/diagnostics/redact` creates a deny-by-default
`vaa1.redacted_diagnostic_bundle.v1`. Only runtime, component-version, error
class and known-issue sections are admitted. Credentials and authorization
fields are redacted, source content/transcripts/prompts/screenshots/embeddings
are withheld, absolute paths become basename-only, and all other top-level
sections are dropped. The bundle contains a redaction account and content hash;
the raw input is never embedded.

## Patch, rollback and model updates

A patch begins from a frozen reproduction, receives severity and redacted
diagnostics, passes affected and release regression suites, receives independent
review, updates release notes, and rolls out in stages. Project-boundary breach,
data loss, source-identity drift, mature-evidence corruption or excessive
startup failure triggers distribution halt and restoration of the last verified
build. Application rollback never overwrites newer user project data.

Model promotion is never automatic. It requires immutable revision and hashes,
licence/redistribution status, independent holdout evidence, reproducibility
comparison, project-boundary verification, staged rollout, rollback artifact and
an analyst-visible change note. A finding-changing update creates a new
model/method edition and does not rewrite an accepted analysis edition.
