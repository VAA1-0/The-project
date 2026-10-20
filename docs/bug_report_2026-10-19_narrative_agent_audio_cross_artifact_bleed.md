# Bug Report — Narrative Agent audio candidates crossed artifact boundaries

Date: 2026-10-19

Status: resolved in code; live runtime restarted and awaiting analyst visual acceptance.

Project boundary: `bond-cop30-helsinki`

Active artifact: No Time to Die trailer, analysis `81920e95-a0b2-4173-bc23-86db7909a0a9`

Leaking artifact: `y2mate.com - Galaxy Song Monty Pythons The Meaning of Life_480p copy.mp4`

## Summary

After selecting Nomi, the Narrative Agent panel correctly showed Nomi's mature
audio seed at `41.920–43.180`, but populated its match queue with 211 audio
windows collected indiscriminately from every analysis record in the project.
Several visible lines were from the Galaxy Song artifact.

This was an artifact-boundary violation. Project membership permits an explicit
cross-video comparison surface; it does not make evidence from one analyzed
artifact native evidence inside another artifact's private hermeneutic space.

## Root cause

`_audio_sample_matching` iterated through every project status after finding a
confirmed seed for the selected Narrative Agent. It excluded the seed interval,
but did not require each candidate window to share the seed's `analysis_id`.
The frontend then rendered the complete project-level suggestion array without
an active-analysis guard.

## Expected behavior

- A confirmed speaker interval seeds matching only inside its analyzed artifact.
- Every suggestion carries its owning `analysis_id` as its hermeneutic-space ID.
- The active-video panel renders only seeds and suggestions owned by the active analysis.
- Cross-video comparison happens only in a separately identified comparison surface.
- Project membership alone never licenses evidence transfer between artifacts.

## Delivered correction

- Candidate generation now requires a confirmed audio seed in the same analysis.
- Suggestions carry `hermeneutic_space_id` and the exact same-artifact seed IDs.
- The projection declares cross-artifact candidate generation forbidden.
- The panel independently filters both seeds and suggestions by the active `analysisId`.
- A regression test proves that a Galaxy Song audio window cannot enter the Bond/Nomi queue.

## Data impact

The leaked rows were unreviewed suggestions, not mature Nomi data. No automatic
identity promotion occurred. Any user-confirmed decisions would remain explicit
ledger events and must be audited separately; the screenshots show the affected
rows as `unreviewed`.

## Acceptance gate

Refresh the Narrative Agent panel, select Nomi, and verify that the match count
contains only No Time to Die audio windows. Open each visible source link and
confirm it remains in analysis `81920e95-a0b2-4173-bc23-86db7909a0a9`. Then open
the Narrative Agent comparison matrix separately to compare across videos.
