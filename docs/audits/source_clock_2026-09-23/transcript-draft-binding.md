# Transcript span draft binding — 2026-09-23

Transcript span editors and manual transcript markers now copy the source-clock guard when opened. Save and remove-marker operations require that captured identity/revision/offset to match the selected analysis and current loaded corrections. They retain the original guard in the payload while allowing independent same-clock corrections to remain in the merged document. Missing, unavailable and unversioned draft bindings require reloading/reopening rather than silently upgrading an old draft.

Rejected saves preserve the draft and display the error inside the editor. Async completion checks both selected video and the still-active draft before surfacing saved state or clearing the editor. A newer draft is not cleared by an older save response. The server's existing under-lock precondition still detects changes that the browser has not yet refreshed.

## Evidence

55 focused frontend tests pass, including four new tests for copied guards, same-clock independent corrections, stale/missing bindings, actual draft-opening/save/removal handlers, server rejection, changed video and replacement draft during a delayed save. Handler tests execute extracted production functions with controlled service/UI callbacks; the fixture models React's per-render draft closure. These are not rendered interaction tests. TypeScript passes. The existing POS/Quant hydration browser check passes. All 32 protected saved artifacts remain byte-for-byte unchanged; no original correction was saved during verification.

## Next ordered work

1. Transcript word correction drafts and undo: audit captured authority and undo-stack behavior, including failed commits. The existing undo implementation is unchanged in this increment.
2. Apply and test draft-lifetime rules in Objects, OCR, Expressions, Audio and the remaining correction editors; inventory any fresh-at-save reads that could rebind older evidence.
3. Exercise delayed source switches and revision-aware navigation, including switch-away-and-back cases and unmounts. This increment's response check is selected-ID/draft equality, not a complete selection-generation protocol.
4. Run the documented isolated-copy manual gates. No manual gate or whole clock stage is marked complete here.
