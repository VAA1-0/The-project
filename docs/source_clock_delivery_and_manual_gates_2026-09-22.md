# Source-clock delivery and staged acceptance — 2026-09-22

This checklist expands Stage 1 of the General Sprint Regime. “Global” means a common source-relative contract throughout Datascene, with separate clocks for separate sources. Stage 1 remains open. Automated checks do not substitute for the analyst acceptance steps below.

## Delivered and automatically checked

- Frontend: explicit seconds remain seconds on long recordings; explicit millisecond fields convert; precise formatting handles minute rollover; correction parsing rejects malformed clock strings; canonical timing statuses survive normalization.
- Expressions now uses the shared precise formatter, eliminating its independent rounding at minute boundaries. The frontend clock-scope type explicitly permits the backend's analysis ownership field; evidence-row references retain their meaning.
- Backend: rejects non-finite/malformed clock inputs and unsupported clock IDs; rejects foreign analysis ownership; isolates candidate selection, overlap planning and decision invalidation by the available source/analysis context.
- Correction-save contract tests now locate the actual handler through Python's syntax tree, whether synchronous or asynchronous, and verify the durable correction write refreshes Master Schema. These checks inspect wiring; they do not prove end-to-end persistence.

## Current implementation checkpoint

The next representation and navigation increments are delivered in the worktree. Scene Cards, Meaning/Plot, Master Schema, second-order labels, scene governance and Data Maturation no longer infer milliseconds from numeric magnitude. Explicit millisecond fields convert even below 1,000; missing values do not become zero in the shared adapter. Eight precise display consumers use the shared formatter (Expressions, OCR, Audio, Objects, Transcript, Meaning/Plot, Traceback and TimeBank). Existing compact whole-second or duration displays remain intentional presentation formats.

Semantic confirmation alone no longer confers verified timing. Explicit researcher corrections reject negative, reversed and out-of-duration bounds; legacy automatic scope clamping remains compatibility behavior. The backend requires a real boolean for invalidation requests.

All production timeline publishers in panels and shared video navigation now call `publishSourceTime`, which checks analysis ownership against the active selection, emits a source-clock envelope, and bridges to existing numeric listeners. Delayed Tools retries cannot reselect an abandoned source. Session clearing retains its intentional unscoped zero reset. Navigation preserves genuine zero time, rejects invalid seeks and respects `seekVideo: false`.

This is **analysis-selection isolation**, not completed source-revision isolation. Immutable source fingerprints, clock-revision conflicts, frame/sample precision, global versus local invalidation persistence, the complete rendered consumer matrix and portable restoration remain open. Numeric listener compatibility remains explicit technical debt; all manual gates below remain pending.

Current automated evidence: **33 focused frontend tests, 48 backend tests (plus 21 subtests), TypeScript, and three browser checks pass**. The browser checks include a real expression cue seeking the media element. The broader frontend suite remains at 147 passes and ten known failures. Backend validation changes are running after the documented idle-service reload.

## Revision-binding checkpoint — 2026-09-23

The backend now binds clock resolution to actual media content and a deterministic timebase revision. Stale versioned requests are rejected; legacy evidence remains explicitly unversioned and inspectable. Clock invalidation requires a current binding and retains that binding in its append-only ledger event. Temporary-file tests verify the real handler/writer/loader through invalidation and reopening, preserving original decisions and unrelated claims. **56 backend tests plus 25 subtests, 33 frontend tests and TypeScript pass.**

This advances C2 and the ledger portion of C3. It does not complete revision preconditions for general annotation saves, revision-aware consumer navigation, atomic cross-writer concurrency or the project round trip. Those remain the next dependency gates. See [revision-binding audit](audits/source_clock_2026-09-23/README.md).

## Correction-save robustness checkpoint — 2026-09-23

Canonical clock reads now consult the actual correction file, and both correction-save routes reject stale read-time offset guards before writing. The dashboard validates inside its write queue, strips transient guards from saved files, preserves canonical clock precedence and refuses corrupt-file fallback. Verification: 59 backend tests plus 25 subtests, 42 frontend tests, TypeScript and both hydration browser tests pass. See [correction-save robustness](audits/source_clock_2026-09-23/correction-save-robustness.md) for limitations and the unrelated failing checks. Cross-process atomicity and full content/revision guards on editing consumers remain open.

## Shared writer checkpoint — 2026-09-23

Dashboard correction saves, backend correction saves and backend export refreshes now share a per-analysis filesystem lock. Clock guards run while ownership is held; export reloads canonical corrections; correction reads cannot overwrite in-flight backend save memory. Real Node/Python contention and crash tests pass. Evidence: 63 backend tests plus 25 subtests, 47 frontend tests and TypeScript. See [shared write coordination](audits/source_clock_2026-09-23/shared-write-coordination.md), including the deliberate fail-closed policy and recovery steps for crash-abandoned locks.

This closes cooperative exclusion for these save paths, not multi-artifact rollback or coordination of every ledger/projection/import writer. Full source-revision guards in editing consumers remain next.

## Backend revision-precondition checkpoint — 2026-09-23

Version-aware backend correction saves now validate source fingerprint and clock revision under the shared lock before mutation. 72 backend tests plus 25 subtests pass. Offset-only compatibility remains; coherent read binding and dashboard/editor migration are the next ordered dependencies. See [backend revision precondition](audits/source_clock_2026-09-23/backend-revision-precondition.md). This does not close C2/C3 or any manual gate.

## Dashboard binding checkpoint — 2026-09-23

Dashboard reads now return corrections and a source-clock binding under the shared lock; dashboard saves validate the loaded binding before writes. API readback rejects a changed revision. 51 frontend tests, TypeScript and both hydration browser checks pass; all 32 protected artifacts remain unchanged. [Delivery and limitations](audits/source_clock_2026-09-23/dashboard-revision-binding.md). Next: per-editor draft/refresh/undo retention and conflict feedback, then revision-aware navigation and manual acceptance. Legacy payload compatibility remains.

## Transcript draft checkpoint — 2026-09-23

Transcript span/manual-marker drafts retain their opening binding through refresh. Save/remove reject stale bindings with draft-preserving feedback; late responses check active source and draft. 55 frontend tests, TypeScript and the language hydration browser check pass. [Scope and next steps](audits/source_clock_2026-09-23/transcript-draft-binding.md). Word drafts, undo, other editors and manual acceptance remain open.

## Transcript word and undo-safety checkpoint — 2026-09-23

Word Correct/Drop preserve selection-time bindings. Transcript undo peeks rather than consuming history before save and retains history unless restoration is verified. 59 focused frontend tests, TypeScript and language hydration pass; all 32 protected artifacts remain unchanged. [Audit and limitations](audits/source_clock_2026-09-23/transcript-word-undo.md). Full restoration/deletion semantics, cross-revision undo, other editors and manual gates remain open.

## Correction-generation checkpoint — 2026-09-23

Both correction-save routes now issue and require the canonical generation after an analysis first adopts it. This rejects same-clock stale saves and supplies the missing concurrency precondition for restoration. 73 backend tests plus 25 subtests, 60 frontend tests and TypeScript pass. [Scope and migration behavior](audits/source_clock_2026-09-23/correction-generation.md). Undo inverse-operation/deletion semantics remain the next dependency; old history must not be resubmitted under a refreshed guard.

## Guarded word-undo closure — 2026-09-25

The new transcript word inverse operation is implemented and its bounded runtime verification is complete. It restores/removes the targeted rule under binding, generation and exact-rule checks, preserves unrelated corrections, persists reversal history and deduplicates retries. Backend reload, both browser hydration checks, seven word-undo/history tests and five backend lock/export tests passed; all 32 protected artifacts match the baseline. The added export test verifies canonical undo history survives backend payload/write construction despite stale memory. See [closure audit and precise limits](audits/source_clock_2026-09-25/guarded-word-undo.md).

Rendered save/reopen/undo acceptance on an isolated copy remains pending. This does not close M3 or the overall clock system. Older history, span/manual-marker undo, other editors and cross-clock restoration remain outside this delivery. Prior suite totals are recorded separately in the audit, not rerun or accumulated.

## Revision-aware navigation checkpoint — 2026-09-25

The active frontend clock session now carries analysis identity, source fingerprint, clock revision and a selection epoch through canonical timeline events. Stale playback callbacks and queued seeks are rejected across source changes, A → B → A switching and clock refreshes. Source-unavailable records remain inspectable but cannot publish navigation; a blank video selection no longer masks a valid active-analysis context. **39 focused frontend tests and TypeScript pass; all 32 protected artifacts match.** See [revision-aware navigation audit](audits/source_clock_2026-09-25/revision-aware-navigation.md).

This advances C2 but does not close it or M2: the rendered two-source delayed-load fixture is still required. The attempted browser run did not reach assertions because the local development server/page startup stalled, so no new rendered pass is claimed.

## Rendered guarded word-undo acceptance — 2026-09-25

The isolated transcript word Correct → verified readback → reopen → undo workflow now passes in Chromium. Fixture selection is analysis-identity-specific, client history availability survives hydration, and the test waits for verified client readback before leaving the page. Eight focused undo tests and TypeScript pass; all 32 protected artifacts match. See the [guarded word-undo audit addendum](audits/source_clock_2026-09-25/guarded-word-undo.md).

This closes the rendered word-operation acceptance that remained after the guarded undo delivery. It does not close M3's interval/restart/decision-trace requirements or any other manual gate.

## M1a Expressions clock-legibility remediation — 2026-09-29

Expressions now subscribes to the revision-bound shared source cursor, displays it
with the canonical precise clock, highlights the nearest expression sample and
states explicitly when no expression sample exists at the cursor. This addresses
the Expressions-specific presentation failure recorded in M1a without changing
timestamps or claiming analyst acceptance. Thirty-one focused clock/presentation
tests and TypeScript pass. The isolated M1a observation must be rerun before its
status changes; Transcript interval/cursor presentation and the real long-source
M1b requirement remain separate open work. [Bounded delivery record](audits/source_clock_2026-09-29/m1a-expressions-clock-legibility.md).

## M1a Transcript cursor/interval legibility — 2026-09-29

Transcript now exposes its revision-bound source cursor in canonical notation,
states whether that cursor is inside, before or after the closest authoritative
transcript interval, and highlights that interval without changing transcript
timing or navigation. The refreshed analyst screenshot at 14:55 Europe/Helsinki
also confirms the Expressions remediation is running: the revision-bound cursor,
explicit no-sample state, nearest sample and canonical labels are simultaneously
visible. Forty-nine focused clock/transcript tests and TypeScript pass. M1a still
requires the isolated 1:11.000 and minute-boundary observation; M1b remains
blocked on a real source longer than 1,000 seconds. [Bounded delivery record](audits/source_clock_2026-09-29/m1a-transcript-cursor-interval.md).

Analyst acceptance later on 29 September confirms the repaired `1:11.000`
landmark and canonical minute-boundary behavior. **M1a is passed.** M1b remains
an explicit blocked gate; work proceeds to independent M2 source-switching
acceptance without representing the whole of M1 as closed.

## M2 delayed source switching — accepted 2026-09-29

Two isolated, content-distinct clock fixtures passed a rendered A → B → A run
with A's first context response delayed by 2.5 seconds. B remained selected and
revision-bound after late A arrived, synchronized every visible clock at
`0:30.000`, and A reopened under A's own revision. Protected original hashes
match. After the initial final-state capture was replaced by five staged images,
the analyst reviewed the sequence and confirmed it as pass. **M2 is closed.**
[Evidence](audits/source_clock_2026-09-29/m2-delayed-source-switch.md).

## M3 interval persistence and guarded undo — 2026-09-29

A fully isolated fixture now includes correction, decision-ledger and Master
Schema artifacts. A confirmed `1:11.000–1:12.250` Transcript marker passed
verified save, close/reopen, canonical consumer projection and documented
backend restart. Guarded undo removed it from active corrections and projections,
advanced the correction generation and appended provenance without erasing the
prior accepted decision. Two rendered Chromium phases pass; 21 focused
correction/Transcript tests and TypeScript pass; protected originals match.

Delivery also closes three defects exposed by the user case: editing now waits
for a revision-bound correction bundle, reopened manual intervals retain
`manual_correction` timing authority, and verified saves invalidate stale derived
analysis caches before reopen. M3 is rendered-pass pending analyst review.
[Evidence](audits/source_clock_2026-09-29/m3-interval-restart-undo.md).

The analyst subsequently reviewed the before/after evidence and confirmed the
complete user-case sequence. **M3 is closed.**

## M4 invalidation boundary — 2026-10-01

Two isolated actual-data copies now demonstrate the intended boundary. A local
change at `1:11.000–1:12.000` staled exactly two overlapping active decisions
and retained 159 unrelated temporal decisions. A separate whole-source change
staled 161 of 161 active temporal decisions while retaining the non-temporal
decision. Both retries were idempotent; candidate artifacts, the other fixture
and protected originals remained separate. The active Bond/COP30/Helsinki
project route returned exactly five records, and focused Chromium confirmed no
Marcella or clock-fixture records were rendered. Eighteen focused backend tests
plus four subtests and one rendered project-isolation test pass. The analyst
confirmed the local-versus-whole-source boundary on 1 October 2026; **M4 is
closed.** [Evidence](audits/source_clock_2026-10-01/m4-invalidation-boundary.md).

## M5 full consumer matrix — 2026-10-01

The first 16-surface run proved bidirectional cursor transport, but analyst
review correctly rejected it as consumer acceptance: several panels did not
raise, highlight, scroll to or hydrate evidence associated with the beat, and
aggregate panels lacked an explicit temporal-hit versus non-temporal contract.
OCR and Expressions correctly had no detection at the tested beat. **M5 is
open.** Implement and rerun consumer response with explicit no-hit/gap states;
the real >1,000-second observation also remains blocked on source availability.
[Evidence](audits/source_clock_2026-10-01/m5-consumer-matrix.md).

## Remaining delivery order

| Step | Frontend work | Backend work | Acceptance dependency |
|---|---|---|---|
| C1: complete representation | Inventory and migrate remaining local formatters and unit adapters; explicitly separate timing authority from semantic confirmation. | Review legacy interval clamping, unit adapters and authority declarations; define frame/sample precision including variable frame rate. | Focused adversarial unit tests, then M1. |
| C2: identity and navigation | Carry source/analysis identity and revision in all seek/selection events; reject stale events during media swaps. | Bind scopes to immutable source identity and revisions; define compatibility mapping for legacy evidence-row references and source replacement. | C1; two-source automated fixtures, then M2. |
| C3: correction continuity | Display saved, pending and stale timing states consistently across consumers. | Verify correction save/revision conflict handling and append-only decision history; distinguish interval-local invalidation from whole-timebase changes. | C2; isolated persistence tests, then M3–M4. |
| C4: consumer completion | Verify all 16 inventoried surfaces, including long recordings and bidirectional navigation. | Verify consumer projections use the accepted revision and preserve candidate/confirmed distinctions. | C3; rendered integration tests, then M5. |
| C5: portable continuity | Reopen an imported copy with the same selections, clock values and review states. | Preserve identities, revisions, original evidence and decisions through export/import. | C4; round-trip fixtures, then M6. |

These are gaps to close or behaviors to verify, not assertions that every listed capability is absent. The existing consumer inventory is static evidence only. Pure format/unit validation and test-harness improvements can be delivered immediately; event, persistence and invalidation changes need their own automated fixtures before analyst acceptance. Later sprint stages remain gated by these contracts.

## Manual acceptance, in order

**M1–M6 delivery run, 25 September:** implementation, focused automation, bounded rendered checks and the M6 core export/import round trip are recorded in [the consolidated acceptance record](audits/source_clock_2026-09-25/m1-m6-acceptance.md). The ordered manual gates are not all closed: M1 lacks a real source longer than 1,000 seconds; M2, the interval/trace portion of M3, M4 and the full 16-consumer M5 matrix still require recorded analyst observations. M6's core round trip passes, while its landmark recheck remains dependent on M1/M3. Do not describe Stage 1 as closed yet.

Run on an isolated saved-work copy with a distinct analysis identity. Confirm the copy's writes cannot reach original correction files or decision ledgers. Snapshot the copy and record branch/commit, source identity, duration, clock revision, test action and actual result. Record pass/fail explicitly; all steps below are **pending**, not completed.

1. **M1 — Same-source agreement.** After C1, open Bond at 1:11.000 and navigate from transcript, expressions and a manual annotation. Compare Video, row labels and interval bounds. Repeat across a minute boundary and a recording longer than 1,000 seconds. Pass: consumers address the same source instant within the declared frame/sample precision; seconds never become milliseconds; displays never show a spurious 60-second component.
2. **M2 — Source switching.** After C2, use two copied analyses with overlapping numeric intervals. Seek in the first, switch to the second, then reopen the first; include a delayed response/media load. Pass: late events do not move or overwrite the newly selected source; identity and revision remain attached to the correct selection.
3. **M3 — Save, reopen and undo.** After C3, change one interval on the copy, save, close/reopen and restart through the documented launcher. Inspect the source and relevant consumer projections. Use the supported undo/revision action. Pass: the saved correction survives, the previous decision remains traceable, and undo records a new accepted state rather than erasing history.
4. **M4 — Invalidation boundary.** On the copy, change an interval with known dependent and unrelated decisions. Then test a whole-source clock offset separately from the snapshot. Pass: affected decisions become stale with reasons, unrelated local intervals/other sources remain intact, and a global timebase change reaches every dependent temporal decision that requires review. Inspect candidate and accepted states separately.
5. **M5 — Full consumer matrix.** After C4, record results for Video, Transcript, Audio, Objects, OCR, Expressions, POS, Quant, Scene Cards, Narrative Agent, Meaning/Plot, Master Schema, Data Maturation, Search, StatsKit and Traceback. Exercise entry-to-video and return navigation where supported. Pass: all supported temporal actions use the intended source/revision; missing or unsupported timing is explicit. Include long-source, frame/sample and no-media cases; record unsupported actions rather than silently marking them passed.
6. **M6 — Portable restoration.** After C5, export the isolated project and import it into a separate destination. Recheck M1's landmarks and M3's saved correction/history. Pass: evidence references resolve, revisions and review status survive, no duplicate authority is created, and original analyses remain unchanged.

A failed step blocks dependent acceptance, not independent repairs. Attach reproducible observations and screenshots/logs to the sprint audit; rerun only affected checks after a fix. Close Stage 1 only when automated checks and the applicable manual gates have recorded evidence. The wider frontend suite's ten recorded failures remain separate unresolved release work.
