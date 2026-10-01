# Datascene Project, Analysis, and Hermeneutic Context Boundary

Date: 2026-10-01

Status: Project and analysis entity boundary operational in the interactive Datascene local surface; hermeneutic ticket expansion defined

## Governing invariant

No analysis, source, artifact, cache entry, clock ticket, panel state, interpretation, or mutation may become active unless its project and analysis identities agree with the governed active context.

## Operational boundary delivered

- The active project catalogue supplies the analysis membership allowlist.
- Foreign live selections are rejected before subscriber panels receive them.
- Foreign restored panel props are stripped before render.
- A foreign context already resident during membership loading is evicted.
- Record, artifact, source-media, correction, and bundle routes validate project membership server-side.
- A context analysis identity that differs from the route entity is rejected.
- Missing context fails closed.
- Analysis hydration and in-flight caches are partitioned by project and analysis.
- Golden Layout workspace state is stored under a project-specific key.
- An explicit catalogue view may aggregate projects, but an ordinary dashboard may not.
- Violations raise a visible alarm and return machine-readable boundary codes.

## Hermeneutic context ticket

The next expansion of the same boundary must carry:

- `project_id`;
- `analysis_id`;
- canonical source identity and source edition;
- Global Clock context and revision;
- evidence/correction generation;
- active analytical lens and research question;
- scene or interval membership;
- interpretation authority and provenance;
- analyst/session identity where mutations are permitted.

The ticket is not descriptive metadata. It is authorization for an interpretation to enter a surface, cache, computation, Narrative Agent prompt, meaning network, report, or export.

## Failure behavior

Any disagreement must:

1. stop hydration or computation;
2. clear the affected surface rather than retain stale meaning;
3. block writes and exports;
4. raise a visible project-boundary alarm;
5. record the rejected identities and entry path;
6. require a newly validated ticket before resuming.

No automatic cross-project reconciliation is permitted. Semantic similarity, shared participants, matching filenames, prior assistance, aliases, and imported editions do not grant project authority.

## Current machine-readable rejection contract

- `PROJECT_CONTEXT_REQUIRED` → HTTP 428
- `PROJECT_MEMBERSHIP_MISMATCH` → HTTP 403
- `ANALYSIS_CONTEXT_MISMATCH` → HTTP 409
- `ANALYSIS_NOT_CATALOGUED` → HTTP 404

All responses identify the `project_analysis_entity` boundary and disable caching.

## Next implementation layer

Apply the same validated ticket to direct FastAPI reads and mutations, background jobs, search, Global Clock context resolution, Meaning/Plot and Narrative Agent computations, StatsKit inputs, traceback, and publication/export. The ticket must be propagated—not reconstructed independently—across those consumers.
