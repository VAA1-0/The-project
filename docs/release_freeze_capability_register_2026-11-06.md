# Datascene #0.1 Release-Freeze Capability Register

Date: 2026-11-06

Authority: `config/release_capability_register.json`

This record closes the moving-scope problem for the `#0.1` product release.
“Analysis 1.0” remains the name of an analyst-governed immutable analysis
edition; it is not the product version. Product packaging remains `#0.1`.

Only four capability states are permitted:

- **supported** — part of the frozen local release core with acceptance evidence;
- **experimental** — usable for governed research, with visible limitations and
  no general performance claim;
- **disabled** — present in code or design but unavailable by default; and
- **deferred** — explicitly outside the `#0.1` operational scope.

Deferred and disabled work is not a hidden backlog condition for the local core.
It blocks freeze only if its disposition, limitation or runtime consequence is
missing, or if the product still presents it as supported.

The backend endpoint `GET /api/release/capabilities` exposes the same register
and its status counts to release tooling and future UI consumers. Validation
fails closed for unknown statuses, duplicate identities, missing ownership,
missing runtime consequences and active capabilities without evidence.

## Current boundary

Supported core:

- admitted local video analysis;
- revision-bound source-clock navigation;
- canonical analyst corrections and mature projections;
- governed Meaning Knowledge and Narrative Agent workflows;
- accepted publication and portability workflows.

Experimental research surfaces:

- exploratory clustering; and
- individually evidenced StatsKit motors.

Disabled or deferred from `#0.1`:

- non-video source-family admission beyond typed preflight;
- remote acquisition;
- external CVAT round trip;
- music/lyrics service expansion;
- offline relational-lens packages; and
- licensed or remote providers by default.

This register is the input to the remaining release-contract slices. It does not
declare project migration, interrupted-write recovery, stale-job rejection,
source relinking, supply-chain verification or independent export verification
complete.
