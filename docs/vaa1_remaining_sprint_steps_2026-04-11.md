# VAA1 Remaining Sprint Steps 2026-04-11

## Current Position

The branch now has:

- a working local CVAT connection baseline
- VAA1-to-CVAT workflow documentation
- an annotation exchange protocol
- a first normalized annotation master schema
- analyst-facing taxonomy dropdown improvements in VAA1
- browser-local custom taxonomy persistence with manual removal
- a green frontend webpack production build

The next sprint work should move from stabilization and handoff into governance, ingestion, and analyst flow completion.

## Remaining Sprint Priorities

### Priority 1. Shared taxonomy governance

Current state:

- taxonomy learning is browser-local only

Sprint target:

- move learned labels to backend persistence
- distinguish:
  - local draft label
  - approved shared label
  - deprecated / retired label
- allow admin-side rename, merge, remove, and approval actions

Why this matters:

- analysts should not be stuck with isolated personal taxonomies
- the system needs a governed shared vocabulary for scale

### Priority 2. VAA1 annotation ingest from CVAT

Current state:

- protocol and schema are written
- CVAT can be opened and used
- the return path into the master schema is not yet complete

Sprint target:

- ingest CVAT annotation output into a normalized VAA1 artifact
- map CVAT working objects/tracks/intervals into:
  - object annotations
  - track annotations
  - temporal segments
  - review / correction layer
- expose validation and import status to the user

Why this matters:

- VAA1 must not stop at "export from CVAT"
- it needs a trustworthy round-trip

### Priority 3. First-time connect and reconnect UX

Current state:

- local workflow is proven, but user session behavior is still too operational

Sprint target:

- guided first-time annotation workspace connection
- reconnect flow for expired sessions
- clearer handling of permission and login mismatches

Why this matters:

- real analysts should not have to understand ports, task IDs, or CVAT internals

### Priority 4. Duplicate-task and linkage governance

Current state:

- reopen stability was improved
- duplicate creation during retries had been observed earlier in the day

Sprint target:

- ensure analysis items reliably reuse stored `cvatID`
- prevent accidental duplicate task creation during repeated opens
- surface linkage state in a more transparent way

Why this matters:

- operational cleanliness
- less analyst confusion
- better auditability

### Priority 5. Parallel VAA1 + CVAT analyst workspace

Current state:

- the product direction is clear, but the experience is still partly split

Sprint target:

- keep VAA1 as the command center
- make the relationship between:
  - CVAT annotation actions
  - VAA1 metadata
  - VAA1 master schema
  visible during work

Why this matters:

- analysts should understand what they are producing and why
- the workflow should feel integrated, not stitched together

### Priority 6. Audio strategy for annotation

Current state:

- CVAT remains primarily visual
- audio matters for VAA1 interpretation and annotation quality

Sprint target:

- decide whether to:
  - keep CVAT visual-only and provide audio/transcript context in VAA1
  - or build a synchronized audio-support layer beside annotation

Why this matters:

- this affects workflow design and annotation quality expectations

### Priority 7. Test hardening

Current state:

- frontend webpack build is green
- contract test stubs were improved
- Python combined unittest run still hits an OpenMP shared-memory runtime abort

Sprint target:

- make the backend contract test execution reliable in the test environment
- separate true code failures from environment/process failures
- reduce test-stub drift

Why this matters:

- future changes need cleaner automated feedback

## Recommended Sprint Order

1. shared taxonomy governance design
2. CVAT-to-VAA1 annotation ingest implementation
3. first-time connect / reconnect UX
4. duplicate-task and linkage hardening
5. parallel VAA1 + CVAT analyst workspace design
6. audio strategy decision
7. backend test runtime hardening

## Suggested Immediate Next Session

Start with:

1. a short manual verification pass of the saved-label remove/re-add behavior
2. a decision note for shared taxonomy governance
3. the first implementation slice of annotation ingest into the VAA1 master schema

## Summary

The sprint is no longer fighting basic connection alone. The remaining work is now mostly about turning a working technical path into a governed, explainable, analyst-safe workflow.
