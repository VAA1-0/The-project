# Critical bug report: Source Media user data overwritten without traceback

Date: 2026-08-05  
Severity: Critical / release blocker  
Status: Confirmed  
Affected analysis: `00c22625-82e8-4ddc-bb36-317422664214`  
Source: `1MarcellaPhd_VSpirituality BLS S20.mp4`

## Executive summary

Previously saved user-authored values in Source Media `PEOPLE / ROLES` and
`CHARACTER ROLES` disappeared. Opening or updating Source Media surfaced empty
arrays, and a later metadata regeneration persisted those empty arrays into both
`source_media_metadata.json` and `analysis_record.json`.

The implementation did not create an immutable, value-bearing revision before
replacement. The remaining event log records only which fields were included in
an update, not their prior or resulting values. Consequently, the exact previous
people and character-role assignments cannot currently be reconstructed from the
canonical record or its audit events.

This violates the canonical rules that user corrections are higher authority,
cannot be silently overwritten, and must retain traceback.

## User-visible impact

- Previously entered people and character roles vanished from Source Media.
- Character data needed for video annotation was no longer available to the form
  or Narrative Agent consumers.
- The Source Media form became sluggish because opening it coupled lightweight
  metadata work to heavyweight analysis hydration.
- The user could not safely save the intended update because the form had already
  hydrated an empty stale state.
- A successful regenerated metadata file could falsely appear authoritative even
  though it had discarded user-authored values.

## Persisted evidence

At diagnosis time:

- `source_media_metadata.json` was modified at 2026-08-05 18:14:15.
- `analysis_record.json` was modified at 2026-08-05 18:14:24.
- `annotations_revision` was `0`.
- `annotations_updated_at` was `null`.
- `user_annotations.persons` was empty.
- `user_annotations.character_roles` was empty.
- `user_annotations.character_definitions` was empty.
- The root `source_media_annotations` copy in the analysis record was also empty.
- The surviving `source_media_metadata_updated` event from
  `2026-08-02T13:58:53.959831+00:00` lists updated field names but stores no
  before-value, after-value, revision identifier, or content hash.

An orphaned temporary record was found:

`outputs/api_results/00c22625-82e8-4ddc-bb36-317422664214/.analysis_record.json.3f420a6ac2004a39add0fb144ff6c1e3.tmp`

It is a truncated JSON write from 2026-08-05 09:58:18. Recoverable Source Media
fragments inside it contain only derived filename metadata and zero character
roles; they do not contain the missing user assignments.

Evidence-backed names still present elsewhere include `Csenge Csabai` and
`Mona Knoli` from OCR-derived metadata. A manual visual annotation named
`tie track 1` also survives. These are not a valid substitute for the missing
user-authored people/role values and must not be presented as recovered entries.

## Root cause

The Source Media update regime treated mutable copies inside the analysis status
and generated metadata as the canonical record:

1. The panel hydrated Source Media while also launching heavyweight full-analysis
   hydration.
2. Empty or stale form state could be submitted as a complete metadata payload.
3. The server updated `source_media_annotations` in place.
4. Metadata generation wrote the resulting state to `source_media_metadata.json`.
5. The entire analysis record was later persisted with the same empty arrays.
6. No append-only revision containing before and after values was written before
   replacement.

Atomic replacement prevented partial JSON corruption, but it did not prevent a
logically stale or empty payload from atomically replacing valid user data.

## Canonical violations

- User-authored data did not remain the highest authority.
- Overwrite was possible without another explicit user correction.
- Traceback named a route but did not preserve the corrected values.
- Foreground metadata editing depended on heavyweight analysis hydration.
- The application could acknowledge or surface generated state without proving
  continuity from the last user revision.

## Immediate containment implemented

- A recovery snapshot of all current Datascene JSON was created at:
  `backups/datascene-json-2026-08-05-recovery/outputs/`
- The snapshot contains 4,117 JSON files, matching the live JSON file count.
- All 14 critical annotation and Source Media JSON files in the live and backup
  trees parsed successfully.
- Source Media foreground reads and writes now use an isolated dashboard route.
- User Source Media fields are committed to a small atomic
  `source_media_annotations.json` sidecar.
- Empty stale fields cannot erase an existing non-empty sidecar value.
- The commit is reopened before returning a saved acknowledgement.
- Source Media opening no longer refreshes the full analysis merely to retrieve
  correction presence intervals.

Containment protects new and currently persisted values. It does not recreate
the exact already-overwritten character-role assignments.

## Required permanent correction

1. Every user mutation must append an immutable revision before updating the
   current projection.
2. A revision must contain analysis ID, field path, stable subject identity,
   before value, after value, author, timestamp, parent revision, and content
   hashes.
3. Deletes must be explicit tombstone operations; an absent or empty stale field
   must never imply deletion.
4. Generated metadata and analysis completion code may read user revisions but
   may not rewrite or clear them.
5. Current Source Media state must be a projection of the append-only revision
   ledger, not the sole record.
6. Panel hydration must use the latest canonical revision and must never replace
   dirty local input during editing.
7. Saves must remain small, atomic, locally responsive, and independent of the
   analysis execution lock.
8. Cross-panel and cross-session clients must merge by revision/field identity
   and reject conflicting stale edits visibly.
9. Backups must include the immutable annotation ledger and be recoverable without
   reading the heavyweight analysis record.

## Release-blocking acceptance tests

- Save people and character roles; reopen the panel; exact values remain.
- Run metadata maturity, Master Schema projection, analysis completion, and
  application restart; exact user values remain.
- Submit an older empty form after a newer non-empty save; the newer values remain.
- Make independent edits from two browser sessions; both survive.
- Change an existing role; before and after values are retrievable by revision.
- Delete a role explicitly; a tombstone and the prior value remain retrievable.
- Interrupt a save between file write and rename; the last revision remains valid.
- Keep the backend API deliberately unresponsive; Source Media save and read-back
  remain immediate.
- Confirm no code path can write `annotations_revision: 0` over a record that has
  a later user revision.

Datascene must not be considered release-ready until these tests pass.
