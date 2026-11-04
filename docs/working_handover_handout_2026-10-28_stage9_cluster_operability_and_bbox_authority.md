# Working handover — Stage 9 cluster operability and BBox authority

Date: 2026-10-28  
Project: Datascene / VAA1  
Active test analysis: `81920e95-a0b2-4173-bc23-86db7909a0a9`  
Active project: `bond-cop30-helsinki`

## Immediate continuation instruction

Finish and visibly verify one narrow acceptance condition before resuming the wider Sprint:

> A mature Narrative Agent value from Master Schema must be the complete title of its associated Video-panel BBox.

At `1:01.000`, the mature Master Schema value is `James Bond`. The BBox title must therefore read exactly `James Bond`. It must not read `Character present`, `Confirm Narrative Agent 94%`, or `James Bond / Confirm Narrative Agent 94%`.

The latest manual screenshot shows partial success: the title is now `James Bond / Confirm Narrative Agent 94%`. The mature value reaches the BBox, but the renderer still appends the obsolete manual target label. Do not add another matcher, inference motor, or data category. Remove that append behavior when mature authority supplies the title.

Relevant renderer location:

- `src/frontend/app/V2components/components/panels/VideoPanel.tsx`, around the construction of `overlaySourceLabel` and `compactOverlayLabel` (approximately lines 8695–8728).
- For a manual overlay whose displayed label is supplied by `master_schema_mature_label` or `narrative_agent_recognition`, `compactOverlayLabel` must use only `overlay.label`.
- The generic `metadata_correlation.target_label` may remain available in provenance/details, but must not appear in the visible title after mature Narrative Agent authority exists.

Required live acceptance test:

1. Open the No Time To Die analysis above.
2. Seek to `1:01.000`.
3. Confirm the Narrative Agent panel shows `James Bond` for `1:01.000–1:01.500`.
4. Confirm the associated Video BBox title reads exactly `James Bond`.
5. Reload the page and repeat the check.
6. Capture a screenshot. Do not call the fix complete from structural tests alone.

## What has already been connected

- Visual Narrative Agent lineup confirmations are written as explicit user confirmations.
- Confirmed occurrences are projected into Master Schema presence data.
- An annotation-projection refresh endpoint was added and is invoked after correction saves.
- The active test record contains a mature `James Bond` occurrence at `61.000–61.500` seconds.
- The Narrative Agent on-beat panel already surfaces this record correctly.
- Video overlay arbitration now finds the mature spatially associated Narrative Agent and replaces the old generic `Character present` title portion.
- The remaining defect is the UI title composer appending `metadata_correlation.target_label` (`Confirm Narrative Agent 94%`) after the mature title.

## Data evidence for the acceptance case

Source file:

`outputs/api_results/81920e95-a0b2-4173-bc23-86db7909a0a9/annotation_corrections.json`

Generic tracked-person annotation:

- Range: `57.000–65.000`
- Target: object track `33`
- Old label: `Character present`
- Old target label: `Confirm Narrative Agent 94%`

Mature Narrative Agent occurrence:

- Label: `James Bond`
- Range: `61.000–61.500`
- Authority: `explicit_user_confirmation`
- Maturity: `mature`
- Target type: `narrative_agent_occurrence`
- Its face/occurrence centre is spatially inside the tracked-person BBox.

The Master Schema record is the title authority. The generic review prompt is provenance only after that authority exists.

## Verification already completed

- `node --test src/frontend/tests/manual-annotation-governance.test.mjs` passed: 75/75.
- `src/frontend/node_modules/.bin/tsc --noEmit -p src/frontend/tsconfig.json` passed.
- Backend and frontend had returned HTTP 200 during the work.
- These checks do not replace the required live rendered acceptance test above.

## Files materially involved in the current bridge

- `src/frontend/app/V2components/components/panels/VideoPanel.tsx`
- `src/frontend/lib/video-service.ts`
- `src/frontend/lib/bbox-authority.ts`
- `src/frontend/lib/api-service.ts`
- `src/frontend/app/V2components/components/panels/MasterSchemaPanel.tsx`
- `api_server.py`
- `src/frontend/tests/manual-annotation-governance.test.mjs`

The worktree contains extensive user and Sprint work. Preserve all unrelated changes. Use focused patches only; do not reset, clean, or rewrite the worktree.

## Stage 9 direction and design constraints

Datascene is an operational analysis tool, not a manual-annotation shell. Quantitative measurement should scale qualitative research. Confirmed mature data must proliferate to all associated consumers through the existing regime.

Non-negotiable principles established in this thread:

- Explicit user confirmation is 100% authority and becomes mature Master Schema data.
- Mature data remains active when analysis models are changed.
- Source-linked evidence and temporal bounds must remain inspectable.
- Mature Data Proliferation (data aggregation) must update Narrative Agent, Meaning/Knowledge, scene, report, graph, and Video BBox consumers.
- Saloon doors navigation must return from a thumbnail or evidence widget to the correct source time and BBox.
- Do not retain non-functional legacy categories such as `SPEAKER_01` as analyst-facing identities.
- A speaker identity is a Narrative Agent confirmation; speech/music/silence detection alone is not.
- Silence and ordinary music do not require analyst confirmation to mature. Foley families may require governed confirmation.
- Existing matcher, Mature Data Proliferation regime, explorative clustering, Master Schema projection, and panel consumers must be connected before inventing parallel tools.

## Delivered or substantially implemented during this Stage 9 thread

- Analysis Setup and Tools model/license surfacing work.
- Completed-analysis report panel direction and report views.
- Non-video import/test agenda.
- Cluster exploration taxonomy and usability contract.
- Visual Narrative Agent lineups with compact JPEG thumbnails.
- Candidate and mature rows, batch selection, drag/drop reassignment, editable/new rows, alias merging direction, and source return.
- Audio Narrative Agent/Foley lineup structure.
- Object cluster workbench and first object-appearance embedding motor.
- YOLOv8 development configuration and alternative detector/model registry work.
- Model-change persistence principle for prior detections.
- Set/location recurrence structure and source-metadata proposals.
- Panel hydration/storage-quota mitigations and bug reports.
- Scene/Narrative Agent projection bug reports and tests.

## Known remaining work after the BBox title acceptance passes

### Visual cluster completion audit

- Re-test every candidate enters a lineup or the unresolved pool.
- Re-test confirmed candidates never remain unresolved.
- Re-test drag/drop commits immediately and does not require secondary confirmation.
- Re-test no duplicate thumbnail is created by confirmation.
- Re-test alias merge changes only the chosen source and target families.
- Re-test mature confirmations can be corrected and reassigned.
- Re-test confirmations proliferate to Master Schema and every associated consumer.
- Re-test performance with large unresolved sets; avoid page hangs.

### Audio cluster next slice

- Repair sample boundaries so one review sample contains one speaker at a time.
- Present Narrative Agent audio rows analogous to visual lineups.
- Provide obvious play, pause, confirm, reassign, and drop actions.
- Separate Narrative Agent speech clusters from Foley families.
- Keep music and silence governed without unnecessary confirmation labour.
- `pyannote.audio` is in the selection or mitigation agenda; license/model choice remains analyst-controlled.

### Remaining exploratory attribute families

- Set/location recurrence and metadata-backed proposals.
- Visual concepts.
- Set recognition.
- Objects and appearance families beyond the first motor.
- Foley/event families.
- Textual detection families.
- Interpretive clustering is deferred to the later stage, after empirical visual/audio/text structures are operational.

### Before release freeze

- Revisit earlier Sprint patches for actual operability before later release slices.
- Audit Meaning/Knowledge Graph, Narrative Agent graph, lenses/perspectives, evidence clustering, and Mature Data Proliferation end to end.
- Resolve recorded bug-report mitigations and runtime-environment updates.
- Run the deferred non-video manual suite: text, still image, music/audio, graphics, webpage, and reference-data imports.
- Freeze configuration only after macOS and Windows environments are settled; fresh-location installation remains deferred until then.

## Manual checks retained for later

- Object detection/model-change persistence check.
- Non-video import matrix listed above.
- Full completed-analysis report human-readability review.
- Detached-panel source return.
- Export/restore parity.
- Targeted invalidation after one dependency correction.
- Meaning/Knowledge and Narrative Agent graph parity.
- Quick Sweep-only run followed by sectional science and forensic scan paths.

## Continuation discipline

- Begin with the exact BBox acceptance case, not a redesign.
- Inspect existing paths before adding code.
- Make the smallest connected correction.
- Verify in the running UI, reload, and verify again.
- Report completion only with visible evidence.

