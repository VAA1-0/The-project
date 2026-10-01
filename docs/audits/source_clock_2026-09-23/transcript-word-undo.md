# Transcript word drafts and undo safety — 2026-09-23

## Delivered

Selecting a transcript word captures a copy of its source-clock binding. Correct and Drop use that binding rather than a refreshed correction document's authority. Changed source/revision/offset, unavailable binding and changed analysis reject the action while preserving the word draft and displaying an error. Editing or replacing the word draft changes its local identity so a late response does not clear newer input. Successful word saves add a history snapshot only after verified save; failures do not add an entry.

Transcript undo now peeks at history without consuming it. It validates the saved snapshot's original binding against the currently loaded source, submits the snapshot, checks returned corrections for restoration, and acknowledges the history entry only afterward. It retains history on server rejection, stale or legacy/unbound snapshots, readback mismatch, or a changed history token. Repeated undo in this mounted panel is blocked while one is pending.

Restoration comparison ignores save metadata and the transient guard, compares the union of content keys, and normalizes missing known correction collections to empty arrays. This is deliberately conservative: uncertain restoration retains history. The localStorage token check detects observed intervening changes; it is not a cross-tab transaction.

## Verification

59 focused frontend tests pass. New checks cover actual history storage functions, actual word/undo handlers with controlled service callbacks, stale bindings on both Correct and Drop, save rejection, successful history addition, changed history tokens, and retained entries after merge/readback mismatch. Existing draft-lifetime and source-binding suites remain included. TypeScript and targeted diff checks pass. The language hydration browser check passes; it does not constitute rendered word-edit or undo acceptance. All 32 protected saved artifacts remain unchanged. No live correction writes were used.

## Remaining ordered work

1. Define and implement verified undo restoration on the canonical writer. Its collection merge can retain entries the old snapshot omitted or restore newer members over old ones. This increment detects such mismatch and preserves history; it does not solve deletion/supersession semantics or cross-revision undo. Older destructive history-pop callers elsewhere remain to migrate.
2. Audit Objects, OCR, Expressions, Audio and other editors for opening-time draft binding, late-response isolation and visible conflict feedback. Existing span-editor/clock-sync history push timing also remains separate follow-up work.
3. Complete revision-aware navigation and run isolated-copy manual gates M1–M6, including successful undo with traceable decisions. None is marked complete by these automated checks.
