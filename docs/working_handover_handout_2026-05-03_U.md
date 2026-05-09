# VAA1 Working Handover Handout U

Date: 2026-05-03

## 1. Session Focus

Today focused on annotation and detection proliferation intelligence.

The practical problem was simple:

- one clearly identifiable person is visible and speaking across a short time span
- VAA1 detects many overlapping `person` boxes in the same time-space continuum
- the analyst should not need to rename the same person twenty times
- manual annotation and mature proliferation should surface in the BBox UI
- proliferation must avoid drifting to other visible people

The working case was the Sari Multala example around `0:03.768` to `0:11.711`.

## 2. Core Design Decision

VAA1 should not treat every overlapping `person` detection as an independent annotation target.

Within a tight time-space continuum, multiple same-space person detections should be understood
as one governed `Person track`.

That `Person track` should display the most mature available label:

1. manual correction
2. direct manual annotation
3. mature proliferated annotation
4. supported proliferated candidate
5. grouped detection
6. raw detection

Only direct manual annotation or manual correction should overrun the latest mature proliferated
annotation.

## 3. Documents Added

Primary schema-facing note:

- `docs/vaa1_detection_annotation_proliferation_intelligence_schema_note_2026-05-03.md`

Conceptual closest-match note:

- `docs/vaa1_closest_match_evidence_proliferation_note_2026-05-03.md`

The schema note defines:

- `vaa1.proliferation_intelligence.v1`
- seed evidence
- coordinate / timesphere profile
- candidate object shape
- maturity states
- evidence inputs
- anti-drift requirements
- BBox UI surface contract
- scene-change and split-screen risks

## 4. Backend State

Primary file:

- `src/backend/analysis/evidence_proliferation_matcher.py`

Backend behavior now includes:

- closest-match candidate scoring
- `match_probability`
- `closest_match.components`
- seed and source timespheres
- transcript, metadata, audio, visual sample cloud, visual cue, and cinematic clue inputs
- anti-drift behavior for person continuity
- same-time / same-space person candidate clustering

Important new direction:

- proliferation candidates that are the same `person` in the same time-space continuum collapse
  into one `Person track` candidate
- clustered candidates preserve `proliferation_hit_count`
- clustered candidates preserve merged evidence ids in provenance

## 5. Frontend State

Primary file:

- `src/frontend/app/V2components/components/panels/VideoPanel.tsx`

Frontend behavior now includes:

- BBox label input accepts multi-word names
- selected BBox editor stacks above overlapping boxes
- proliferation candidate tray shows closest matches and probability
- mature proliferated matches can surface on BBox overlays
- direct manual annotation still wins over mature proliferation
- manual/proliferated labels can attach by same-space overlap, not only exact track id
- same-space duplicate person hits render as a single `Person track`
- duplicate person tracks preserve a hit count in the rendered label, e.g. `Person track x20`

Type support:

- `src/frontend/lib/api-service.ts`
- `EvidenceProliferationCandidate.raw` is typed so the UI can read candidate track ids and
  clustering/provenance hints.

## 6. Current Caveat

Old proliferation results in browser localStorage may still show older noisy candidates.

Relevant localStorage keys:

- `vaa1.proliferation.requests`
- `vaa1.proliferation.matches`

When continuing, rerun `Prepare candidates` after restarting backend/frontend. If the UI still
shows old candidate noise, clear those keys or use a fresh browser session.

## 7. Verification Run

These passed during the session:

```bash
python3 -m py_compile api_server.py src/backend/analysis/evidence_proliferation_matcher.py
python3 tests/test_evidence_proliferation_matcher_contract.py
npx tsc --noEmit
```

Frontend compile was run from:

```bash
src/frontend
```

## 8. Restart State

Backend and frontend had been run with:

```bash
scripts/start_vaa1_macos.sh --replace
```

If ports or old processes are stale tomorrow, restart with the same script. Port binding may
require approval in the sandbox.

Expected URLs:

- backend health: `http://127.0.0.1:8000/api/health`
- frontend dashboard: `http://127.0.0.1:3001/dashboard`

## 9. Next Good Steps

When continuing:

1. Restart backend and frontend.
2. Open the Sari Multala test video.
3. Clear old proliferation localStorage if candidate noise persists.
4. Create or select the BBox covering Sari Multala.
5. Save direct manual annotation as `Sari Multala`.
6. Run `Prepare candidates` under Proliferate.
7. Confirm that same-space `person` detections collapse visually as `Person track`.
8. Confirm that mature proliferation surfaces as `Sari Multala` on the BBox.
9. Confirm it does not drift to the other people visible in the frame.

## 10. Longer-Term Follow-Up

Needed later:

- persist mature proliferated annotations server-side, not only browser localStorage
- add an explicit `maturity_state` field through the full backend/UI contract
- show clustered hit count and merged evidence ids more clearly in the candidate tray
- add scene-change-aware thresholds
- add split-screen region handling
- allow analyst accept/reject/correct actions for each clustered person track
- turn the schema note into a JSON Schema artifact under `docs/schemas/`

## 11. Mental Bookmark

The product feel should remain:

Simple. Pretty. Analyst-saving.

The analyst should be able to say:

> This is Sari Multala here.

And VAA1 should quietly understand:

> These twenty same-space person detections are probably one governed person track, so I will
> show the best mature label and keep the evidence trail visible.
