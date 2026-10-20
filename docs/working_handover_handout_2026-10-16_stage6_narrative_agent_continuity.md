# Working Handover — Stage 6 Narrative Agent continuity

Date: 2026-10-16

Branch: `petteri`

## Reconciliation note — 2026-10-19

The manual gate described below is closed and its former next sequence is
superseded. The Nomi audio evidence at `41.920–43.180` is the single live mature
occurrence. Three repeated same-beat confirmations, including the overlapping
`41.900–43.180` submission, are retained as append-only confirmation receipts
rather than separate live attributes. The continuity collection is accepted,
measurement-eligible and projected at one revision to Video, Audio, Transcript,
Narrative Agent, Meaning/Plot, Master Schema, Data Maturation, Search, Traceback
and Measurements. Stage 7 now proceeds through the bounded [reviewable
interpretation sprint](working_handover_handout_2026-10-19_stage7_reviewable_interpretation.md).

## Objective

Operationalize a project-scoped and analysis-artefact-owned Narrative Agent continuity workbench in which tracking supports—but never establishes—identity. Confirmed evidence must remain source-timed, navigable, reversible, project-hermetic, and available to associated Datascene panels and graphs.

## Delivered Stage 6 corridor

- Project-scoped continuity inventory, diagnostics, decisions, projection, persistence, and API.
- Analysis-artefact ownership for every continuity occurrence.
- Navigable Narrative Agent continuity graph across project artefacts.
- Visual, Audio, Transcript + audio, scene-presence, and body-movement source confirmation.
- Include, reject, defer, split, merge, undo, and collection confirmation controls.
- Saloon-door refresh publication to Video, Audio, Transcript, Narrative Agent, Meaning/Plot, Master Schema, Data Maturation, Search, Traceback, and measurements.
- Body-movement candidate surfacing without automatic identity promotion.
- Project-boundary failure closure and save/reopen projection support.
- Source Media Metadata identity confirmation with a strict distinction between identity registry and timed presence.

## Live manual acceptance state

Project: `bond-cop30-helsinki`

Artefact: No Time to Die trailer

Analysis: `81920e95-a0b2-4173-bc23-86db7909a0a9`

Agent: Nomi

The analyst confirmed the audio line around `41.920–43.180`. The source occurrence is present in the live continuity inventory. A stale editor caused a second overlapping confirmation before the UI correction was delivered.

Current gate status:

1. Project/artefact navigation: passed.
2. Nomi identity corridor: passed.
3. Genuine analyst audio confirmation: passed.
4. Save receipt and editor closure: implemented and automatically tested; live refresh verification pending.
5. Duplicate prevention: implemented and automatically tested.
6. Intended membership include: pending.
7. Duplicate membership reject: pending.
8. Collection confirmation: pending.
9. Cross-panel proliferation and save/reopen verification: pending after membership decisions.

## Interaction contract

- Moving the global clock into a known audio or transcript interval raises that interval when the corresponding modality is selected.
- Suggested start/end values can be corrected by the analyst.
- `Confirm source input` saves, refreshes, clears the completed draft, closes the editor, and retains a visible evidence receipt.
- `Add another source input` opens a fresh draft at the current beat.
- A repeat within 50 ms for the same artefact, agent, modality, and compatible source reference returns the existing evidence receipt.
- Confirmation never implies continuity membership; inclusion remains a separate analyst decision.

## Identity registry contract

- Known individual agents come from project-confirmed occurrences and governed Source Media Metadata.
- Metadata confirmation establishes identity-registry membership only.
- Compound casts, relationships, tracks, objects, generic roles, and production credits do not enter the chooser.
- Formatting aliases such as `JamesBond` and `James Bond` collapse in the UI.
- Analysts can enter a first-time identity through the open field.

## Runtime and verification

Datascene was launched using `scripts/start_vaa1_macos.sh --replace` with the documented `vaa1_core` runtime. No locked runtime-environment documentation or dependency locks were changed for this feature.

Verified:

- Backend continuity/API tests: 14 passed.
- Full focused continuity suite earlier in the thread: 28 passed plus 3 subtests.
- Final API idempotency suite: 8 passed.
- Frontend continuity/transcript tests: 16 passed.
- TypeScript `--noEmit`: passed.
- Python compilation: passed.
- `/api/health`: healthy.
- Project dashboard: HTTP 200.

## Historical manual sequence — completed and superseded 2026-10-19

1. Refresh the Narrative Agent panel.
2. Select Nomi from the complete known-agent selector.
3. Confirm that Audio at global beat `0:41.900` raises the detected interval automatically.
4. Confirm that the editor is closed and a saved receipt remains visible for the existing confirmation.
5. Include `continuity-ui-f868a863-44e1-425a-919c-01f76662aaa5` (`41.920–43.180`).
6. Reject `continuity-ui-73af39e9-7313-4053-9b61-3d245a84ab25` (`41.900–43.180`) as the duplicate.
7. Verify the accepted membership across the associated panels and graphs.
8. Confirm the Nomi continuity collection.
9. Save, reopen, navigate from the source occurrence, and export before expanding the contract to another agent.

## Safety note

Do not delete or rewrite the duplicate outside the governed decision path. Rejecting it records analyst intent and preserves provenance. The hermetic `bond-cop30-helsinki` boundary remains mandatory; no foreign analysis may populate this corridor.
