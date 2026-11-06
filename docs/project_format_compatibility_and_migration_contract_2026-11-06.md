# Project-format compatibility and migration contract

Date: 6 November 2026
Release boundary: `#0.1`
Current manifest: `vaa1.project_manifest.v1` / format `1`

## Release decision

Project bundles now carry an explicit schema and integer format version. Import
is fail-closed: a bundle is never interpreted merely because it contains a file
named `project_manifest.json`.

| Input | Import disposition | Data treatment |
| --- | --- | --- |
| Current schema/version | Accepted | Read without migration |
| Legacy unversioned VAA1 project bundle | Accepted through the one governed migration | Original manifest bytes are backed up before an in-memory v1 projection is used |
| Newer version | Rejected with the supported version in the error | No guessed downgrade and no analysis registration |
| Malformed, ambiguous or foreign manifest | Rejected | No analysis registration |
| Older numbered version without a declared migration | Rejected | No speculative transformation |

Downgrade is not automatic. The `#0.1` reader does not promise to write an
older format or reinterpret a newer one. A future downgrade route requires its
own named transformation and acceptance evidence.

## Non-destructive migration evidence

The only admitted legacy shape is the previously exported, unversioned
`project_type: vaa1_project_bundle` manifest. Before projecting it to v1, the
importer writes the exact original bytes beneath
`IMPORTED_WORK_DIR/_project_format_migrations/`. It also writes a receipt with:

- source and target versions;
- SHA-256 of the original manifest;
- byte-preservation verification;
- timestamp and migration identifier;
- applied field additions; and
- explicit downgrade policy.

The migrated representation is used in memory. The uploaded archive and its
legacy manifest are not rewritten. Analyst data inside analysis folders is not
transformed by this migration.

## Export boundary

Both backend-prepared bundles and the local frontend fallback now emit:

```json
{
  "schema": "vaa1.project_manifest.v1",
  "format_version": 1,
  "project_type": "vaa1_project_bundle",
  "compatibility": {
    "minimum_reader_version": 1,
    "downgrade_policy": "unsupported_fail_closed"
  }
}
```

Backend and local-fallback exports both retain an explicit `project_id`. These
fields supplement the existing project identity, analysis inventory,
skips, matrices and timestamps.

## Verification performed

- Seven focused migration tests passed: current acceptance, legacy backup and
  migration, future-version rejection, and four malformed/ambiguous cases.
- Nine frontend project-bundle/search contract checks passed after the local
  exporter was versioned.
- Python compilation passed for the migration module and API integration.
- The selected broader API contract could not reach application assertions:
  its isolated FastAPI fixture does not stub `fastapi.responses.Response`, which
  `api_server.py` imports. This harness gap is not counted as passed evidence.

## Remaining boundary

This slice governs `project_manifest.json`. It does not yet version every
analysis artifact inside the bundle, validate archive extraction safety, or
prove restoration across every historical application release. Those require
separate evidence and must not be inferred from the manifest migration pass.
