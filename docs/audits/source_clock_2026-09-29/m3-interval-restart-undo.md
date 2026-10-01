# M3 interval save, restart and guarded undo — 29 September 2026

## User case

1. Work only on isolated analysis
   `clock-acceptance-5324d4dd643a453bb188c33657a6b227`.
2. Add confirmed Transcript marker `M3 interval continuity marker` at
   `1:11.000–1:12.250` with note `M3 save/reopen/restart/undo acceptance`.
3. Require canonical readback, then switch to B and reopen the M3 copy.
4. Seek the Global Clock to `1:11.000`; require the marker to reopen as the
   authoritative containing interval.
5. Confirm the queue is idle and restart through
   `bash scripts/start_vaa1_macos.sh --backend-only --replace`.
6. Reopen using the retained guarded client history and invoke Undo.
7. Require removal from active corrections and projections, a new correction
   generation, append-only undo provenance, retained prior decisions, and
   unchanged originals.

## Result

- Save/reopen Chromium phase: **passed**.
- Post-restart/undo Chromium phase: **passed**.
- Backend health after documented restart: **healthy**.
- Save generation: `51112dca-fce3-474b-b136-1ece099d9692`.
- Undo generation: `7ef2093b-90cc-42e1-a237-64ff8b28c20f`.
- Undo event: `restore_correction_members`, operation
  `e99b5916-8bd0-4517-8252-cab13d3da8f6`.
- Active marker after undo: absent.
- Active Master Schema temporal marker after undo: absent.
- Historical marker in undo provenance: retained by design.
- Canonical decisions: 180; prior accepted James Bond decision at
  `1:11.000–1:12.000` retained.
- Protected original hashes: all match.
- Focused correction/Transcript tests: **21 passed**; TypeScript: passed.

## Product corrections made during the case

- The acceptance fixture now isolates decision-ledger and Master Schema files.
- Transcript disables interval editing until a content-bound correction guard is
  present.
- Rehydrated manual intervals explicitly retain `manual_correction` timing
  authority.
- Successful correction saves invalidate derived analysis cache generations so
  close/reopen cannot combine new corrections with stale projections.

## Human evidence

- `m3-01-saved-reopened.png`: saved interval reopened at the shared cursor.
- `m3-02-post-restart-undo.png`: post-restart guarded undo completed.

The analyst reviewed the two-step evidence and confirmed the sequence on
29 September 2026. **M3 is accepted and closed.**
