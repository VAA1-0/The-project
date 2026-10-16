# Bug Report — Stage 6 continuity confirmation workbench

Date: 2026-10-16

Project boundary: `bond-cop30-helsinki`

Representative artefact: No Time to Die trailer, analysis `81920e95-a0b2-4173-bc23-86db7909a0a9`

## Summary

The first live Narrative Agent audio-continuity confirmation exposed four connected UI and governance failures:

1. The Narrative Agent chooser admitted compound scene descriptions, relationships, tracks, objects, roles, and production credits as identities while hiding valid single agents through native datalist filtering.
2. `Confirm source input` committed data but immediately erased its own receipt during refresh and left the completed editor open.
3. The stale editor invited repeat submission; every click generated a new random evidence ID, so semantically identical confirmations could be stored more than once.
4. Analysts had to transcribe source-time boundaries manually even when the global-clock beat already fell inside a diarization or transcript interval.

These failures made a successful save look unsuccessful and caused two overlapping Nomi audio confirmations at approximately `41.920–43.180`.

## Expected behaviour

- The known-agent selector lists all governed individual Narrative Agents across the current hermetic project.
- Source Media Metadata confirms an identity-registry entry, but does not manufacture a timed occurrence or collection membership.
- A new identity can always be entered explicitly.
- The active beat raises the containing Audio or Transcript + audio interval automatically.
- Start and end remain editable correction controls.
- A successful confirmation produces a durable, visible receipt and closes the completed editor.
- Repeating the same agent, modality, artefact, interval, and compatible source reference is idempotent.
- Source confirmation and continuity membership remain separate governed acts.

## Delivered correction

- Replaced the filtering datalist interaction with an unfiltered known-agent selector and a separate open identity field.
- Added identity-shaped sanitation and compact-alias deduplication.
- Added project-wide confirmed occurrence identities to the selector.
- Added Source Media Metadata identity confirmations to the continuity inventory with `identity_registry` scope.
- Excluded compounds, track labels, generic roles, objects, and production-credit strings from identity suggestions.
- Preserved save receipts across rehydration.
- Collapsed and reset the source editor after a verified save; `Add another source input` reopens it.
- Added semantic duplicate detection with a 50 ms tolerance and compatible empty/enriched source references.
- Added global-clock interval suggestion from audio diarization and transcript timelines.
- Kept suggested boundaries editable.

## Existing duplicate state

Two already-created Nomi audio records remain in canonical correction data:

- `continuity-ui-f868a863-44e1-425a-919c-01f76662aaa5`, `41.920–43.180`
- `continuity-ui-73af39e9-7313-4053-9b61-3d245a84ab25`, `41.900–43.180`

They were not silently deleted. The intended `41.920–43.180` occurrence should be included and the overlapping duplicate explicitly rejected during membership review.

## Acceptance evidence

- Backend continuity/API suite: 14 passed.
- Focused semantic-idempotency API suite: 8 passed.
- Frontend continuity/transcript suite: 16 passed.
- TypeScript: passed.
- Python compilation: passed.
- Runtime health: healthy; dashboard HTTP 200.

## Remaining manual gate

Refresh the Narrative Agent panel, select Nomi, verify the raised audio interval and persistent receipt, include the intended occurrence, reject the duplicate, verify saloon-door proliferation, and only then confirm the continuity collection.
