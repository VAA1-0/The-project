# M2 delayed source-switch evidence — 29 September 2026

## Outcome

Rendered Chromium acceptance passes for isolated A → B → A switching. A and B
are copies of different source media, with distinct analysis identities,
content fingerprints, clock revisions and durations.

The test deliberately held A's first source-clock response for 2.5 seconds,
selected B while A was unresolved, and verified the late A response could not
replace B's active revision. A B-scoped seek to `0:30.000` reached every visible
clock browser. Reopening A bound the UI to A's revision.

## Identities

- A: `clock-acceptance-db1f40f585954e1bbd0885c52bbfdfd1`, duration
  `155.104535`, fingerprint `sha256:9b025b...`, revision `clock-v1:090136...`.
- B: `clock-acceptance-bdf5e416bdd54be4be30454aea9f6b09`, duration
  `218.959456`, fingerprint `sha256:97dae5...`, revision `clock-v1:e20598...`.

## Verification

- `npx tsc --noEmit`: passed.
- `npx playwright test e2e/source-clock-delayed-switch.spec.ts --project=chromium`:
  **1 passed**.
- Protected source hashes in B's fixture manifest: all match.
- Staged screenshots:
  1. `m2-01-a-waiting.png` — A selected while its clock response is held.
  2. `m2-02-b-bound.png` — B selected and revision-bound.
  3. `m2-03-b-survives-late-a.png` — B remains selected after delayed A arrives.
  4. `m2-04-b-synchronized-30s.png` — B's visible clocks agree at `0:30.000`.
  5. `m2-05-a-reopened.png` — A reopened under A's revision.

The earlier single final-state screenshot was insufficient for human review and
is withdrawn as acceptance evidence. The staged set is the rendered evidence.

The analyst reviewed the five-stage sequence on 29 September 2026 and confirmed
it as pass. **M2 is accepted and closed.**
