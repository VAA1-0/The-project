# VAA1 Sprint Handout - 2026-04-21

## Sprint Focus

This sprint advanced the analyst-facing forensic workflow around video evidence, ROI selection, source sampling, render jobs, timestamp rigidity, and the first practical bridge from video-panel interaction back into evidence leaf panels.

The central user problem was that detections and ROI evidence existed in backend or side-panel ledgers but did not reliably surface where the analyst was looking: the video frame. The sprint therefore focused on closing the feedback loop between the video surface, Objects/Identification panels, Forensic render, and saved evidence ledgers.

## Main Outcomes

### Video Panel Evidence Loop

- Object overlays are now enabled by default.
- Grouped/enriched object detections are used for video overlays, matching the Objects panel stream.
- Person detections below the usual confidence threshold can surface as fallback person boxes.
- Person boxes are deduplicated by actual overlap rather than center distance, so nearby people in action scenes are less likely to be collapsed into one.
- Bounding boxes are normalized before drawing, allowing both pixel-coordinate and normalized-coordinate boxes to render in the video frame.
- Clicking a video overlay opens the relevant evidence leaf panel.
- Selected detection boxes now include an in-frame timeline scrubber.
- The selected-box scrubber moves the real video timeline.
- Each selected box has its own span slider for ROI duration.
- `Use ROI` sends the selected detection box into Forensic render with the selected local time span.

### Forensic ROI Workflow

- ROI drawing can populate the Forensic render panel.
- ROI keyframes can be saved from the current video frame.
- ROI intent now includes:
  - Identification
  - Expressions
  - Movement
  - Object
  - OCR
  - Interaction
  - Other
- ROI intent can be changed from the video-side context menu.
- ROI selections carry analyst-readable labels into the Forensic render tool.
- The locked ROI overlay no longer blocks ordinary object overlays when it is only being displayed.

### Forensic Render Ledger

- Render jobs are no longer presented primarily by opaque machine IDs.
- Ledger rows now use the analyst reason/label as the primary title.
- If the analyst does not type a reason, the UI generates a useful default such as:

```text
Object ROI / 43.519s-44.919s
```

- The render job ID is still available, but it is demoted to a secondary technical reference.

### Source Samples

- Visual, audio, and visual+audio source samples can be created from a source time window.
- Sample ledgers expose source assets for inspection.
- Audio and visual sample retrieval endpoints were manually smoke-tested with `curl`.

### Timestamp Rigidity

- Manual visual annotations now use tighter point/interval visibility rules.
- ROI windows can be fit to saved keyframes.
- A/B marks can feed Forensic render time windows.
- A selected ROI/detection span can be shortened before rendering to avoid contaminating evidence when a target moves away.

### Audio Stack Preparation

The sprint added contract-oriented scaffolding for the coming audio identity stack:

- `pyannote.audio` diarization direction
- `pyannote.audio` embeddings direction
- custom reference uploads
- VAD as a required path
- `diart` noted as a later real-time option
- SpeechBrain noted as alternative embeddings

## Files And Areas Touched

Key frontend areas:

- `src/frontend/app/V2components/components/panels/VideoPanel.tsx`
- `src/frontend/app/V2components/components/panels/ToolsPanel.tsx`
- `src/frontend/app/V2components/components/panels/MasterSchemaPanel.tsx`
- `src/frontend/app/V2components/components/panels/SourceMediaMetadataPanel.tsx`
- `src/frontend/app/V2components/components/panels/SpeechToTextPanel.tsx`
- `src/frontend/lib/api-service.ts`
- `src/frontend/lib/video-service.ts`
- `src/frontend/lib/config.ts`

Key backend areas:

- `api_server.py`
- `src/backend/analysis/forensic_render.py`
- `src/backend/analysis/source_sampler.py`
- `src/backend/analysis/identification_refinery.py`
- `src/backend/analysis/audio_diarization.py`
- `src/backend/analysis/diarization_adapter.py`

Test areas:

- `src/frontend/tests/manual-annotation-governance.test.mjs`
- `tests/test_forensic_render_contract.py`
- `tests/test_source_sampler_contract.py`
- `tests/test_identity_refinery_contract.py`
- `tests/test_audio_diarization_contract.py`
- `tests/test_diarization_adapter_contract.py`
- `tests/test_timestamp_schema.py`

## Validation Performed

Frontend:

```bash
cd src/frontend
npx tsc --noEmit
npm test
```

Backend compile checks were also used during the sprint:

```bash
python3 -m py_compile api_server.py src/backend/analysis/forensic_render.py
```

Manual API smoke checks included:

- backend health endpoint
- listing analyses
- creating visual source sample
- creating visual+audio source sample
- retrieving sample visual/audio assets
- creating and downloading a forensic render job

## Manual Retest Protocol

1. Hard-refresh the frontend browser tab.
2. Open the Bond analysis around `44s-46s`.
3. Confirm Objects overlays are visible by default.
4. Confirm `person track` boxes surface on the video frame.
5. Click a person/object box.
6. Confirm the relevant evidence leaf panel opens.
7. Use the in-box timeline scrubber and confirm the video follows it.
8. Adjust the box span slider.
9. Click `Use ROI`.
10. Confirm Forensic render opens with the intended region, time window, and intent.
11. Create a render job.
12. Confirm the render ledger title is analyst-readable, not primarily a machine ID.

## Known Remaining Work

- Detection boxes are not yet fully editable as persistent analyst corrections in-place.
- The next step should add direct drag/resize handles for selected detection boxes.
- Add an explicit in-video state marker distinguishing:
  - drawn ROI
  - saved ROI keyframe
  - committed render job
- Add a saved analyst label field for ROI paths, separate from the render reason.
- Add stronger visual debugging for hidden overlay cases, for example a small count of active-but-not-rendered detections.
- Continue the audio stack sprint with diarization, embeddings, VAD, reference upload, and later real-time `diart`.

## Git Hygiene Note

The live CVAT token file is intentionally not part of the sprint handout scope. It should not be committed as source work.
