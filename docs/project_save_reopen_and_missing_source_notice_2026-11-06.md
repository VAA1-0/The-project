# Project save/reopen and missing-source notice

Date: 6 November 2026
Release boundary: `#0.1`

## Save/reopen guarantee

Backend and local-fallback project exports now write an
`output_file_inventory` into every analysis saved-work manifest. Each entry
binds the semantic output key to:

- its archive filename;
- exact byte length; and
- SHA-256 checksum.

On reopen, the importer restores output mappings from that inventory rather
than relying only on a historical list of recognized filenames. This means a
new or uncommon mature artifact can survive save/reopen with its original
semantic key even when an older filename heuristic does not know it.

Every declared file is checked before analysis registration. Missing, truncated,
tampered or path-traversing entries fail the import explicitly. Datascene does
not silently open a partially disconnected project and call it complete.
Legacy bundles without an inventory retain the existing bounded filename
inference path.

## Source locator persistence

Saved-work manifests also retain a source locator containing:

- saved analysis ID;
- original source filename;
- last known source location; and
- expected source fingerprint, when available.

The locator is descriptive evidence, not authority to trust a replacement.
Actual relinking continues to require the exact-content integrity contract.

## User notification on reopen

Project and analysis import responses now return `missing_sources` and
`source_restore_required`. Each missing-source notice contains:

- current imported analysis ID;
- original filename;
- last known source location;
- expected SHA-256 and size where available;
- required action; and
- `exact_content_match_only` relink policy.

After opening a project, Datascene presents these records in the import notice
and directs the analyst to **File → Locate Media…** for each affected analysis.
The notice distinguishes a successfully reopened analytical project from
complete source playback/evidence navigation: missing media does not erase the
analysis, and reopening the analysis does not pretend the media was restored.

## Verification

- An artifact with a semantic key unknown to filename inference was restored
  from its manifest inventory.
- Checksum tampering and archive traversal were rejected.
- Missing-source notices retained analysis ID, filename, last location and
  expected identity.
- Available sources did not produce false missing-file notices.
- 34 focused backend persistence, integrity, recovery and concurrency tests
  passed.
- Modified frontend routes and notification UI passed ESLint.
- Python compilation and `git diff --check` passed.

## Remaining boundary

Browser-local **Locate Media** currently restores playback in the current
browser. Persisting an operating-system path from a browser file picker is not
portable or generally available to web code. Backend path relinking remains the
durable exact-match route; a future desktop bridge may connect the picker to
that route without weakening content verification.
