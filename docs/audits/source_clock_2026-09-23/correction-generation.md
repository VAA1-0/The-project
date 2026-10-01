# Correction generation precondition — 2026-09-23

## Delivered prerequisite for safe undo

Clock identity alone cannot protect an undo against later corrections made on the same clock. Participating dashboard/backend saves now issue an opaque server-generated `correction_generation` and return it in the transient read guard. Both routes validate the incoming guard against the canonical generation under the shared lock before mutation. A stale or missing token rejects with 409 once the analysis has a generation. Incoming document fields cannot choose the next generation; each accepted save creates a new one. Backend payload/export construction preserves the stored generation. Dashboard canonical reads take generation precedence over compatibility caches, and API readback checks the returned generation.

This changes concurrency policy for versioned analyses: even independent edits from an older snapshot must reload rather than silently merging across saves. Existing analyses are not rewritten or migrated on read. Their first participating save creates a generation; editors already open at that point must reopen/reload before another save. Transcript bound drafts also detect generation changes locally. Generation is distinct from source/timebase revision and does not change the clock hash.

## Verification

73 backend tests and 25 subtests pass; 60 focused frontend tests pass. Added cases cover same-clock stale/missing generation rejection, current-generation acceptance, canonical-cache precedence and draft generation mismatch. Existing queue, real Node/Python lock, source-revision and history-safety checks remain included. The affected 16 frontend checks were rerun after final local changes; TypeScript and targeted diff checks pass.

## Remaining delivery

This is the correction-version dependency, not an undo restoration command. Current history snapshots carry the original generation and therefore cannot simply be resubmitted after a later save. Safe restoration must express the intended inverse change with the current generation, verify the affected items against the original successful edit, preserve unrelated edits, and record supersession/deletion without permitting cached evidence to resurrect it. Do not merely refresh the old snapshot's guard to bypass this check.

Next: retain before/after edit identity in undo history, implement guarded inverse operations and persistent deletion/supersession semantics, then run isolated restoration fixtures and manual M3. Legacy external/import writers and other uncontrolled file writers are not enrolled by this protocol. Multi-artifact rollback and all manual gates remain open.

## Runtime verification

All 12 analyses were completed before the documented backend-only reload. Both expression and language hydration browser checks pass afterward. Backend health and both correction reads respond; generation reads agree (the protected Bond original remains unversioned because no save was performed). All 32 protected artifacts match baseline, and no lock directories remain. No live correction writes were used. [Probe](correction_generation_probes.json).
