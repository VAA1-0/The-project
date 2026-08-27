# Governed Contradiction Resolution Decision

Date: 2026-08-25
Status: Accepted design boundary; implementation pending

Contradiction resolution is a platform-level governed interpretation, not a video detector score.
The unit is a source-linked claim and its counter-evidence set. Eligible evidence must carry an
analysis ID, source interval or explicit source-pending state, authority, maturity, and validity.

States are `unresolved`, `disputed`, `resolved`, and `not_applicable`. Resolution requires an
analyst decision; automated agreement may organize candidates but cannot resolve them. The
denominator includes only eligible claim sets reviewed for the selected scope. Unsupported,
missing, and not-applicable sets are excluded rather than scored as zero.

Every decision records claim and counter-evidence references, analyst identity, timestamp,
reasoning, superseded decisions, and traceback. Only analyst-resolved, source-linked decisions are
eligible for mature reporting. Until the aggregate and review workflow are implemented,
contradiction resolution remains `unsupported_platform_capability` and is excluded from maturity
radars and selected-video deprivation language.
