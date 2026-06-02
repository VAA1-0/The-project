# VAA1 Thread Handoff - Bbox/ROIbox, Mature Data Proliferation, Meaning Network

Date: 2026-06-01

Purpose: clean handoff for starting a fresh thread. This is a record of the working conversation and the current state of concern, not a final specification.

## Core Principle

The analyst's manual correction stands.

Inside VAA1, nothing competes with what the analyst indicates. Automated detections, inferred tracks, proliferation candidates, visual pattern matching, and graph-derived suggestions may support the analyst, but they must not override an analyst-confirmed manual annotation, time bound, coordinate, or dimension.

Other analysts may challenge an interpretation through their own method or project layer. Within this analyst's method, the analyst's saved correction is authoritative.

## Thread Arc

### Presentation and Contribution Work

- The thread began around preparing and delivering the VAA1 contribution/presentation.
- The presentation script document `Datascene (VAA1).docx` was referenced as context for practical VAA1 examples.
- The work focused on showing VAA1 through the actual development situation and sample analyses available in the program.
- The presentation succeeded. The user reported that it worked and that VAA1 was getting better.

### Mature Data Proliferation Sprint

- The user returned to the Mature Data Proliferation sprint as a core feature.
- The explicit product purpose was restated: VAA1 exists to help the analyst scale large amounts of video data into research material.
- Mature Data Proliferation was framed as central to the software's success or failure.
- The sprint had been redirected toward delivering the Meaning Network Graph first, because it was the most presentable and useful low-hanging fruit.
- The user emphasized that proliferation must stay tied to VAA1 design principles while still helping scale video analysis.

### Meaning Network Graph Manual Verification

The first manual verification issues surfaced in the Meaning Network Graph:

- Right-click on graph nodes opened the browser/CPU context menu instead of a VAA1 tool menu.
- Required graph right-click functions were identified:
  - Copy/paste node or edge.
  - Copy/paste node or edge content onto existing nodes.
  - Traceback tool.
- Native annotations were expected to surface in the Meaning Network Graph in real time, but did not reliably do so.
- Meaning Network edits could appear in the graph but not necessarily as Bbox/ROIbox overlays in the video panel.
- The user asked whether graph confirmations could feed constellational interpreters and support visual follow-up, for example using a confirmed "Bond's car" pattern to find later appearances after cuts.

### Bbox/ROIbox Regime Became The Blocking Issue

The thread then shifted heavily into Bbox/ROIbox navigation, authority, timing, coordinate scaling, and persistence.

Repeated symptoms:

- Single click on a Bbox opened the evidence/navigation panel instead of grabbing/activating the box for drag.
- Desired rule: first click activates/grabs the Bbox for manipulation; double click opens the Bbox navigation/evidence panel.
- When navigating inside the Bbox/ROIbox panel, the video started playing unexpectedly.
- Some Bboxes could initially move only vertically, not horizontally.
- After horizontal movement was restored, Save and Save here were mute or ineffective.
- Cancel closed the panel but discarded intended time/name/coordinate changes.
- Bbox entries could be renamed or retimed in the UI, but the changes did not reliably land in the program.
- Bbox overlays could obscure frequently used playback controls.
- The user asked for stronger play/pause, backward/forward, stepwise, slow, and fast-forward controls because analysis constantly depends on them.

### Timing Drift and Authority

The user identified recurring timing drift:

- OBJ tracks were overriding the timing of the object.
- This had reportedly been fixed several times before, but the same error kept resurfacing.
- Boundaries were defined as:
  - Bbox/ROIbox navigation time slots.
  - Panel navigation time slots.
  - Meaning Network handles.
- User confirmations or annotations always stand.
- The timebounding principle has since been hardened, but the coordinate principle remains under suspicion.

### Coordinate, Dimension, and Resize Drift

The most persistent current problem is coordinate and dimension drift:

- Bbox/ROIbox dimensions do not hold after manual correction.
- The indication label can persist while the box geometry moves, resizes, or lands off target.
- Object size changes during movement, so the analyst must be able to follow and scale the object credibly.
- Manual reshaping by an analyst must be treated as a manual correction.
- The user observed that resizing the Video Panel can throw Bboxes off their intended location.
- Fullscreen mode was reported to make Bboxes disappear or lose proportional alignment.
- This suggests a missing unified coordinate model across VAA1 features.

### Police Car Correction Chain

A key case study in the thread was a manually corrected "Police car" indication in the opening scene.

Observed from the screenshot chain:

- The analyst followed the police car through motion.
- The Bbox sometimes covered too much of the frame, too little of the car, or the wrong region.
- After correction attempts, playback showed the Bbox drifting away from the car or holding an incorrect size/position.
- At different timestamps, the rendered box appeared to be controlled by some fallback, interpolation, scaling transform, or stale detection geometry rather than the analyst's correction.
- The user's concern: if this geometry is allowed to proliferate, VAA1 will spread false evidence with authority.

### Save Failure

A separate but related failure surfaced:

- Save Analysis produced a browser alert: "Could not save the current analysis bundle."
- This affects trust in whether Bbox edits, manual annotations, and project state are actually being persisted.
- The save path needs clearer diagnostic reporting, because the UI currently does not explain which branch failed.

## Functional Scope Clarification

The user clarified that VAA1 has different functions for different Bbox/ROIbox uses. Those functions should be respected.

Examples visible in the UI/thread:

- This BBox/ROI only.
- Current scene.
- Current continuity segment.
- Linked candidates.
- Track family, confirm before propagation.
- Narrative Agent family, confirm before propagation.

The issue is not that every Bbox must behave the same. The issue is that any chosen functional scope must still obey the fundamental rule:

Manual analyst correction stands.

## Current Working Diagnosis

The likely missing foundation is a single authoritative coordinate and geometry regime.

Suspected failure modes:

- Different panels may use different coordinate spaces.
- The Video Panel may render against CSS/display pixels while saved annotations use video pixels, normalized coordinates, or another frame basis.
- Resize/fullscreen transforms may not be round-tripping through one canonical mapping.
- Manual Bbox corrections may be saved in one structure but rendered from another.
- Mature data, object tracks, or inferred candidates may still be able to overwrite or mask manual geometry.
- Interpolation may be operating on manual frames without respecting manual keyframes as immutable anchor points.
- Save/Save here may update local UI state without committing to the canonical analysis bundle.

## Design Requirements Going Forward

1. Manual correction authority

   Analyst-confirmed manual time, label, coordinates, and dimensions are authoritative. They can only be changed by another explicit analyst save.

2. Harden coordinates like time

   Timebounding has been treated as an authority problem. Coordinates and dimensions must receive the same treatment.

3. One canonical geometry model

   Every Bbox/ROIbox should have a canonical saved geometry format, preferably normalized against the source video frame or explicitly stored as source-frame pixels with known source dimensions.

4. Deterministic render transform

   The video panel, fullscreen view, resized panel, graph, object panel, and traceback view must all render from the same canonical coordinates through one tested transform.

5. Manual keyframes are protected

   If an analyst sets geometry at a time point, that geometry is a manual keyframe. Interpolation may use it as an anchor, but must not rewrite it or silently substitute detection geometry.

6. Mature Data Proliferation must not mutate source corrections

   Proliferation can create candidates, support signals, or proposed follow-ups. It cannot replace manual coordinates/dimensions/times.

7. Save means save

   Save and Save here must persist to the canonical model and update the UI from that model. If saving fails, the UI must show the failing path clearly.

8. Functional scope must be explicit

   A correction scoped to "this BBox/ROI only" must not behave like a track-family propagation. A correction scoped to a family must still protect the manual anchors used to teach that family.

## Recommended Fresh Thread Start

Start by mapping the current Bbox/ROIbox data flow before patching:

1. Where manual edit events are captured in the UI.
2. Where time, x, y, width, and height are normalized or converted.
3. Which state object becomes the source of truth after Save.
4. Which API endpoint persists the correction.
5. Which renderer draws the visible overlay.
6. Which panels read or rewrite the same annotation.
7. Which proliferation or mature-data resolver can touch the same fields.
8. Which code path is used after resize, fullscreen, save/reopen, and playback.

Then harden coordinate authority in the same spirit as the timebounding work.

## Suggested Next Prompt

```text
Please continue from docs/working_handover_handout_2026-06-01_Y_bbox_roi_thread.md.
Focus only on hardening Bbox/ROIbox coordinate authority.
Manual analyst correction stands.
Coordinates and dimensions must persist across video time, panel sync, resize/fullscreen, save/reopen, and proliferation.
Start by mapping the current data flow before patching.
```

## Relevant Files And Areas Mentioned

- `src/frontend/app/V2components/components/panels/VideoPanel.tsx`
- `src/frontend/app/V2components/components/panels/OBJDetectionPanel.tsx`
- `src/frontend/lib/bbox-authority.ts`
- `src/frontend/lib/api-service.ts`
- `api_server.py`
- `src/frontend/tests/manual-annotation-governance.test.mjs`
- `docs/vaa1_bbox_roi_dom_fixture_testnote_2026-05-18.md`
- `docs/vaa1_mature_data_proliferation_governance_schema_v1.json`
- `BBOX_ROIbox_BUG_FIX_REPORT.doc`
- `EVIDENCE_NAVIGATION_AUTHORITY_MODEL_FAILURE_REPORT.doc`

## Emotional Context Worth Preserving

The user has lost trust in the Bbox/ROIbox regime because the same class of issue has recurred many times: the analyst corrects an annotation, but the tool appears to unsave, move, resize, reinterpret, or override it.

This is not a cosmetic bug. It strikes the core purpose of VAA1. If the analyst cannot trust a single corrected annotation, Mature Data Proliferation becomes dangerous rather than useful.

The next work should treat this as a governance and authority failure first, and a UI interaction bug second.
