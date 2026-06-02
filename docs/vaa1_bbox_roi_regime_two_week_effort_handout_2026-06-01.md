# VAA1 BBox/ROIbox Regime - Two Week Effort Handout

Date: 2026-06-01

Scope: retrospective handout on the recent effort to deliver a trustworthy BBox/ROIbox regime, roughly from 2026-05-18 through 2026-06-01.

This is not a final specification. It records what the work tried to accomplish, what was actually hardened, and why the BBox/ROIbox regime still needs a deeper coordinate-authority pass.

## Core Rule

Manual analyst correction stands.

The BBox/ROIbox regime only succeeds if a saved analyst correction remains authoritative across time, geometry, labels, panel synchronization, save/reopen, resize/fullscreen, and mature data proliferation.

Automated detections, raw tracks, object ids, mature-data candidates, Narrative Agent suggestions, Meaning Network confirmations, and visual similarity matches may support the analyst. They must not silently replace, move, resize, retime, relabel, or globalize a saved analyst correction.

## Why The Effort Became Urgent

The BBox/ROIbox surface is not only a drawing tool. In VAA1 it is one of the main ways video becomes research material.

During the last two weeks, BBox/ROIbox work became urgent because several failures showed the same deeper pattern:

- a corrected indication could drift in time,
- a corrected indication could drift in coordinates or dimensions,
- a later correction could dominate an earlier scene,
- raw detector tracks could behave like semantic authority,
- Save and Save here could appear to update the UI without proving durable persistence,
- resize/fullscreen could break visual alignment,
- BBox interaction could open navigation when the analyst was trying to manipulate the box,
- proliferation risked spreading false visual evidence with the authority of mature data.

The practical fear was simple: if one corrected box cannot be trusted, Mature Data Proliferation becomes dangerous rather than helpful.

## Workstream 1: Mature Data Proliferation Surface

The first part of the effort tried to make BBox/ROIbox a mature evidence surface rather than a raw detector display.

The intended direction was:

- raw detector boxes are substrate,
- mature Master Schema or Narrative Agent labels should outrank raw labels,
- BBox/ROI overlays should remain traceable to source evidence,
- candidates should be visible as candidates, not confirmed truth,
- manual timestamped keyframes should control saved analyst geometry,
- locked forensic ROIs should obey video/time ownership,
- proliferation actions should carry governance metadata.

The test note `docs/vaa1_bbox_roi_dom_fixture_testnote_2026-05-18.md` captured the missing rendered proof. It proposed a DOM/Playwright fixture to verify that mature labels, traceback affordances, manual keyframes, scoped visibility, and candidate-only proliferation safeguards are actually visible to the analyst.

This was an important realization: source-level contracts are useful, but BBox/ROIbox needs rendered verification because the analyst experiences failure in the video surface.

## Workstream 2: Evidence Hub And Navigation

The BBox/ROIbox work then merged with the broader evidence-navigation sprint.

The 2026-05-21 handoff records a shift from static maturity displays toward navigable evidence anchors. BBox/ROI corrections were listed among the surfaces that needed to stop being inert status text and start behaving like source-linked controls.

The design principle became:

```text
Every visible maturity claim must be navigable to source evidence.
```

For BBox/ROIbox, that means a visible corrected box should be able to answer:

- what does this box claim,
- who or what confirmed it,
- what time interval owns it,
- what geometry owns it,
- what raw detector state did it supersede,
- where is its traceback,
- what panels should refresh from it,
- what proliferation actions may only treat it as candidate support.

## Workstream 3: Scene Bleed And Time Authority

The next major failure was scene bleed.

The documented case was:

- the analyst confirmed a BBox/Narrative Agent in one scene as James Bond,
- later, in another scene, the analyst confirmed Felix Leiter,
- the later Felix correction appeared to overwrite or dominate the earlier James Bond scene.

This exposed a core authority bug: raw detector ids, fallback overlay keys, or object-track identity were still being treated as if they could carry semantic truth across scene/time boundaries.

The 2026-05-27 fix hardened time and scope behavior:

- manual object authority became apply-scope aware,
- ordinary interval saves no longer became whole-track authority,
- broad authority was limited to explicit scopes such as `current_scene`, `current_continuity_segment`, `track_family`, and `narrative_agent_family`,
- saved object-backed BBox annotations received ids containing the confirmed interval and BBox fingerprint,
- manual annotation visibility obeyed saved intervals,
- Master Schema mature labels required finite source time before painting onto video,
- saved manual BBoxes suppressed raw machine BBoxes only during their active interval,
- old detector states were retained for traceback rather than active truth.

This was a real improvement. It treated time as an authority boundary instead of merely a UI position.

## Workstream 4: Coordinate And Geometry Governance

The later effort tried to extend the same authority logic from time to geometry.

The new helper `src/frontend/lib/bbox-authority.ts` introduced a more explicit BBox authority layer:

- normalized draft boxes,
- clamping to valid source-video space,
- manual geometry keyframe construction,
- interpolation limits,
- manual-keyframe priority over raw track keyframes,
- object-box normalization that distinguishes normalized coordinates from pixel coordinates,
- time-aware manual visibility helpers,
- manual object target resolution,
- mature manual label resolution.

The data contract in `src/frontend/lib/api-service.ts` now supports:

- `geometry_keyframes`,
- `metadata_correlation.apply_scope`,
- `bbox_roi_governance_schema`,
- `authority_state`,
- `maturity_state`,
- `geometry_track_id`,
- `coordinate_system`,
- `interpolation_policy`,
- `manual_confirmation_event`,
- retained source track keyframes for traceback.

`VideoPanel.tsx` and `OBJDetectionPanel.tsx` were updated so saved BBox/ROI corrections carry:

- normalized video coordinates,
- start and end seconds,
- manual geometry keyframes,
- manual confirmation event metadata,
- explicit confirmed fields for time interval, geometry, and label,
- raw track keyframes retained as traceback provenance,
- conservative default apply scope.

This established the shape of a coordinate-governance model, but it did not yet prove the whole runtime path.

## Workstream 5: Interaction Repair

Several analyst-facing interaction problems were addressed or covered by source tests.

The intended behavior became:

- first click selects/grabs the box,
- double click opens the evidence/navigation panel,
- the open BBox/ROI navigation hub still keeps a dedicated move handle,
- pointer capture prevents horizontal drag loss,
- drag coordinates subtract the rendered video element position before normalizing,
- BBox/ROI navigation seeks hold playback paused,
- stray play events during BBox navigation are rejected,
- native browser controls are avoided where overlays can cover them,
- VAA1-owned analysis transport exposes frame step, slow playback, and fast playback,
- resize and fullscreen transitions refresh the rendered video rectangle.

This moved the surface closer to analyst work: manipulation first, evidence navigation second.

## Workstream 6: Tests And Validation

The strongest validation so far is still mostly source-level and contract-level.

The `manual-annotation-governance.test.mjs` suite now checks for many important invariants:

- manual geometry stays timestamp scoped,
- temporary drafts do not override other timestamps,
- manual geometry resolution goes through the shared authority helper,
- raw track keyframes are not manual authority,
- manual point annotations stay point-scoped,
- interval annotations stay interval-scoped,
- selected overlays can remain visible inside an explicit edit workspace,
- object-track corrections are time-aware sets,
- Save and Save here resolve typed interval drafts before persisting,
- saved corrections preserve manual keyframes,
- saved confirmation events explicitly confirm time, geometry, and label,
- BBox navigation does not accidentally play the video,
- first click does not open the evidence panel,
- double click does open evidence navigation,
- resize and fullscreen have code paths that refresh geometry.

The 2026-05-27 handoff recorded passing checks at that point:

```text
manual-annotation-governance: 41/41 passing
frontend npm test: 51/51 passing
TypeScript: passing
diff whitespace check: clean
```

That matters, but it is not enough. The remaining risk is rendered, temporal, and stateful. The code can contain the right authority phrases while the live video surface still drifts after resize, fullscreen, save/reopen, or playback.

## What Was Delivered

The last two weeks delivered meaningful scaffolding:

- a clearer governance vocabulary for BBox/ROIbox,
- manual correction as the stated authority layer,
- apply-scope distinctions,
- interval-bounded manual authority,
- BBox fingerprinting in ids,
- manual geometry keyframes,
- normalized coordinate persistence,
- interpolation limits,
- raw track keyframes retained for traceback,
- better BBox selection vs navigation behavior,
- better playback control during BBox navigation,
- resize/fullscreen recalculation hooks,
- stronger source-level tests,
- a proposed rendered DOM/Playwright fixture.

This is substantial. The problem is that it is not yet the same as a fully trustworthy BBox/ROIbox regime.

## What Still Failed Or Remained Suspicious

The latest 2026-06-01 handoff records that coordinate and dimension drift remain the blocking issue.

Observed or suspected failures:

- corrected BBox dimensions do not always hold,
- labels may persist while geometry moves or resizes incorrectly,
- object motion requires credible analyst scaling over time,
- manual reshaping is not always treated like a protected manual correction,
- resizing the Video Panel can throw boxes off target,
- fullscreen can make boxes disappear or lose proportional alignment,
- Save and Save here can appear mute or ineffective,
- Save Analysis can fail with only a generic browser alert,
- local UI state may be updated while the canonical analysis bundle is not,
- one panel may render from a different coordinate basis than another,
- interpolation or fallback track geometry may still substitute for manual geometry,
- proliferation or mature-data resolvers may still touch fields they should only read.

The current suspicion is that VAA1 still lacks one authoritative coordinate and geometry regime across all BBox/ROIbox consumers.

## Current Diagnosis

The last two weeks show a progression:

1. BBox/ROIbox was treated as a mature evidence surface.
2. Then it was treated as an evidence-navigation hub.
3. Then time authority was hardened after scene bleed.
4. Then geometry authority was partially formalized through normalized coordinates and keyframes.
5. Now the remaining issue is a whole-system coordinate regime.

The same principle that fixed time must be applied to geometry:

```text
Manual time stands.
Manual coordinates stand.
Manual dimensions stand.
Manual keyframes stand.
```

The important distinction is that a manual correction is not only a label. It is a bundle:

- label,
- time interval,
- coordinate system,
- x/y position,
- width/height,
- keyframe time,
- apply scope,
- source video/frame basis,
- traceback/provenance,
- persistence state.

If any part of that bundle is treated as optional or panel-local, the regime can drift.

## Next Work Should Start By Mapping Data Flow

Do not begin with another isolated patch.

Start by mapping the current BBox/ROIbox data flow:

1. where manual edit events are captured,
2. where drag/resize geometry is normalized,
3. where source-video coordinates are converted to rendered pixels,
4. where typed in/out times are resolved,
5. where Save and Save here build the canonical annotation,
6. which API call persists the annotation,
7. which file or analysis bundle receives it,
8. which state object becomes source of truth after save,
9. which renderer draws the overlay after save,
10. which panels can read or rewrite the same annotation,
11. which mature-data/proliferation paths can touch the same fields,
12. what happens after resize,
13. what happens after fullscreen,
14. what happens after playback/scrub,
15. what happens after save/reopen.

Only after that map exists should the next patch harden the coordinate authority path.

## Acceptance Bar For The Next Pass

The BBox/ROIbox regime should not be considered delivered until a manual correction survives:

- immediate playback,
- scrub away and back,
- Save,
- Save here,
- panel navigation,
- Video Panel resize,
- fullscreen enter/exit,
- project save,
- project reopen,
- mature label refresh,
- raw object track refresh,
- Meaning Network synchronization,
- proliferation candidate generation.

The visible box after each step must come from the same canonical saved geometry, not from stale local state, raw detector fallback, panel CSS pixels, or ungoverned interpolation.

## Useful Files For Continuation

- `docs/working_handover_handout_2026-06-01_Y_bbox_roi_thread.md`
- `docs/working_handover_handout_2026-05-27_X.md`
- `docs/working_handover_handout_2026-05-21_W.md`
- `docs/vaa1_bbox_roi_dom_fixture_testnote_2026-05-18.md`
- `src/frontend/lib/bbox-authority.ts`
- `src/frontend/lib/api-service.ts`
- `src/frontend/app/V2components/components/panels/VideoPanel.tsx`
- `src/frontend/app/V2components/components/panels/OBJDetectionPanel.tsx`
- `src/frontend/tests/manual-annotation-governance.test.mjs`
- `api_server.py`

## Bottom Line

The past two weeks did not fail because nothing was built. A lot was built.

The effort delivered the beginnings of a real BBox/ROIbox authority model: scope, time bounds, keyframes, normalized coordinates, confirmation metadata, traceback retention, and stronger tests.

But the analyst-facing trust problem is not solved until the visible geometry is governed by one canonical model everywhere. The next phase should treat coordinate/dimension authority as seriously as time authority, then prove it with rendered tests and a manual Bond-trailer smoke test.
