# Retention and complete-deletion contract — 6 November 2026

## Outcome

Datascene analysis deletion is now a bounded data-lifecycle operation rather
than removal of a catalogue card. `GET /api/analysis/{analysis_id}/deletion-plan`
previews the boundary. `DELETE /api/analysis/{analysis_id}` executes it and
returns a `vaa1.analysis_deletion_receipt.v1` account of removed, already
missing, externally retained and failed targets.

Deletion is deliberately two-step. After the first user confirmation, the
backend issues a single-use, analysis-bound intent valid for five minutes. Only
after the second confirmation is that token presented to `DELETE`; a direct
request without it is rejected. Bulk session clearing uses the same two-step
protocol and lists the number of affected analyses before confirmation two.

The old implementation could follow stored paths without proving that they
belonged to Datascene, and omitted catalogue membership, generated bundles,
publications and project-continuity derivatives. The replacement resolves every
target against explicit managed roots. A path outside those roots is never
deleted merely because an analysis record refers to it.

## Managed deletion boundary

Deletion covers, when present:

- the complete analysis output directory, including annotations, transcripts,
  thumbnails, embeddings, indexes, caches, receipts and local `.bak` files;
- imported-work copies;
- standalone legacy outputs and generated analysis bundles;
- video publication packages;
- corpus publications and project bundles that may contain the analysis; and
- project-continuity projections derived from the affected project.

Catalogue membership and in-memory status are removed only after managed file
deletion succeeds. A processing analysis receives `409` because its writers
cannot yet be cancelled safely. Any filesystem failure produces an explicit
partial-failure receipt rather than a success message.

Project-wide derived publications and continuity projections are invalidated
as a unit. Remaining source analyses are not deleted; those derivatives must be
regenerated from the surviving project membership.

## Deliberate retention

- Every original source file is retained, including Datascene-managed upload
  copies and browser-local media. Original-file deletion requires a separate
  navigation and authority and is never bundled with analysis deletion.
- A user-owned source outside Datascene's managed roots is likewise retained
  and named in the receipt.
- Copies or exports already downloaded outside Datascene cannot be recalled and
  remain the user's responsibility.
- Analysis-local decision receipts and recovery backups are not retained after
  deletion.
- Shared rotating application logs are not rewritten during live deletion.
  They may retain the opaque analysis identifier until rotation, but must not
  contain source media or derived analytical content. This is an explicit
  residual retention boundary, not a claim of cryptographic erasure.

The browser does not remove its IndexedDB media copy during analysis deletion
or session clearing. That copy is original/source media and belongs to the
separate source-deletion lifecycle.

## Verification

Focused tests prove that managed embeddings, publications, project continuity,
corpus publications and local backups are removed; external source media is
preserved; and traversal-style analysis identities are rejected. Filesystem
erasure semantics still depend on the operating system and storage medium;
Datascene guarantees logical deletion from its managed namespace, not forensic
secure wiping of storage blocks.
