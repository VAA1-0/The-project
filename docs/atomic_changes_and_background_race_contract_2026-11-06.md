# Atomic changes and background-race contract

Date: 6 November 2026
Release boundary: `#0.1`

## Failure reproduced

Two persistence boundaries could report successful work while retaining an
older or incomplete view:

1. `catalogue_index.json` used an unlocked read–modify–write. Two analyses
   saving concurrently could both read the same catalogue and the later
   replacement could erase the other analysis entry.
2. annotation projection threads were serialized only when they reached the
   heavy analysis slot. Thread scheduling could allow a projection requested
   for an older correction generation to start after a newer correction had
   already been committed.

## Delivered contract

### Catalogue transactions

`update_json_transaction` now provides a shared JSON transaction boundary:

- a filesystem-visible exclusive lock works across threads and processes;
- the document is reloaded only after the lock is owned;
- malformed existing JSON fails closed and is not replaced;
- mutation and validation happen while ownership is held;
- a unique temporary file is flushed and `fsync`ed before `os.replace`;
- lock ownership is token-checked before release; and
- a dead process lock can be quarantined only after a 60-second grace period.

Analysis-record persistence uses this transaction for catalogue membership.
Concurrent saves therefore merge against the latest committed catalogue rather
than against stale snapshots.

### Background generation fencing

Every annotation-dependent projection thread captures the canonical
`correction_generation` that requested it. After acquiring the heavy-analysis
slot, it reloads the canonical corrections and receives a typed admission
decision:

- matching generation: projection is allowed;
- superseded generation: the job exits with no write effect.

This ordering matters. If an older job is already running, the newer job waits
and republishes the newer generation afterwards. If the newer job reaches the
slot first, the older job is discarded when it eventually acquires the slot.

## Verification

- Forty concurrent catalogue updates retained all forty analysis entries.
- Invalid pre-existing JSON remained byte-for-byte unchanged and failed closed.
- Superseded background generations received `none_stale_job_discarded`.
- Current background generations were admitted.
- Existing correction-lock, project-format and release-register contracts
  remained green in the focused run: 24 tests passed.
- Python compilation and whitespace/error checks passed.

## Explicit remaining boundary

This is not a claim that every historical JSON/CSV/media writer is now a
multi-file transaction. Individual analysis records already use atomic file
replacement, while this increment adds lost-update protection to the shared
catalogue and generation ordering to correction projections. Multi-artifact
commit journals, crash restoration and backup verification belong to the next
interrupted-write/recovery slice.
