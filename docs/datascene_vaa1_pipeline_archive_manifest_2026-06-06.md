# Datascene/VAA1 Pipeline Archive Manifest

Date: 2026-06-06

Archive target:

```text
datascene_vaa1_windows_pipeline_handoff_2026-06-06.tar.gz
```

Purpose: transfer the working Datascene/VAA1 pipeline state from the Mac development machine to a Windows development/testing machine.

This archive is intended to include:

- current working project code,
- current uncommitted handout/development files,
- Windows setup scripts and handouts,
- environment files,
- frontend and backend source,
- docs,
- models present in the project,
- uploads and outputs present in the Mac workspace,
- representative local analysis artifacts that may explain why the Mac machine has richer capability than a thin GitHub clone.

This archive intentionally excludes:

- `.git/`,
- `node_modules/`,
- frontend `.next/`,
- Python caches,
- pytest caches,
- build/dist caches,
- logs,
- prior `.tar.gz` and `.zip` handoff archives,
- operating-system metadata.

Important:

- This is not a packaged `.exe`.
- This is not a clean public source release.
- This is a development/test handoff bundle.
- Uploaded media and generated outputs may include rights-sensitive or private material. Review before sharing outside the team.
- The Windows user should still run diagnostics and recreate dependencies locally; Mac `node_modules` and caches are not useful for Windows parity.

Pair this archive with:

```text
docs/datascene_vaa1_windows_full_operation_handoff_2026-06-06.md
WINDOWS_DEV_QUICKSTART.md
```
