# Source integrity and relink contract

Date: 6 November 2026
Release boundary: `#0.1`

## Problem boundary

A saved analysis can outlive the filesystem path from which its media was
analysed. A filename, extension, size or user-selected replacement is not
sufficient evidence that a new path contains the same source. Relinking the
wrong bytes would make existing timestamps, detections, corrections and claims
appear source-linked when they are not.

## Persisted identity

New uploads and imports with readable source media now capture
`vaa1.source_integrity.v1`:

- SHA-256 content fingerprint;
- byte length;
- original filename;
- verified bound path;
- identity and relink status; and
- the policy `exact_content_match_only`.

The file is checked before and after hashing. If its filesystem signature
changes during verification, capture fails and must be retried. Source identity
is exposed with Source Media metadata and bounded status summaries, and is
preserved in backend and local-fallback saved-work manifests.

## Relink protocol

`GET /api/analysis/{analysis_id}/source-integrity` reports whether the current
source is available and whether exact-match relinking is possible. For a legacy
record whose source still exists, this boundary can capture its governed
identity before it is lost.

`POST /api/analysis/{analysis_id}/source-relink` accepts a local candidate path
and performs verification inside the analysis execution boundary:

1. require an existing governed source identity;
2. resolve and require a regular candidate file;
3. hash the candidate while detecting concurrent modification;
4. compare SHA-256 and byte length;
5. reject mismatches with no status/path mutation; or
6. atomically persist the verified path, integrity record, metadata and event.

Filename and extension are deliberately irrelevant to acceptance. An identical
renamed copy is valid; a different file with the original name is not.
Derived artifacts remain reusable only after exact content equality has been
proved, because their source bytes and source clock have not changed.

## Legacy and failure behavior

- If a legacy record still has its original source, the fingerprint can be
  captured before relinking.
- If both source and governed identity are absent, relinking fails closed. The
  system will not bless a replacement based on name, metadata or analyst intent.
- A mismatch returns a typed assessment with `none_candidate_rejected` and does
  not alter the analysis record.
- Relinking does not copy, delete or modify the selected source file.

## Verification

- An identical copy at a new path and with a new extension was accepted.
- A same-named file with different content was rejected.
- A legacy record without a governed identity failed closed.
- Fingerprint and byte-length capture were stable across repeated reads.
- Source-clock and prior recovery/transaction contracts remained green in the
  final focused run: 42 tests passed.

## Explicit remaining boundary

This slice verifies local file identity and path rebinding. It does not implement
remote object-store retrieval, partial-file repair, content acquisition, or
automatic searching of disks. Those operations require separate consent,
credential and retention contracts.
