# VAA1 BBox / ROI Mature Data DOM Fixture Test Note

Date: 2026-05-18

## Purpose

Add a rendered DOM test, preferably Playwright when the panel can be mounted in the app shell or React Testing Library when the panel is isolated, that proves the mature data proliferation feedback loop is not only present in source contracts but visible and navigable to the analyst.

The fixture should load a mature analysis payload, scrub timestamps, and verify that BBox / ROI overlays are populated from the most mature available evidence, remain source-traceable, and respect manual timestamped keyframes.

## Recommended Fixture Shape

Use a deterministic mature analysis payload with:

- One raw detector BBox with a weak label such as `person_01`.
- One Master Schema mature object/subject record for the same track with a mature label, traceback id, evidence refs, source frame refs, and source bbox refs.
- One narrative-agent recognition record for the same track with a role label.
- One second-order proliferation candidate that should render as a candidate chip, not as confirmed evidence.
- One manual visual annotation with `geometry_keyframes` at two timestamps.
- One locked forensic ROI with `videoId` and `time` ownership.
- One unrelated overlay from another video or timestamp to prove it does not render.

## Assertions

The test should verify these DOM behaviors:

- The visible BBox label uses the mature Master Schema / narrative-agent identity, not the raw detector label.
- The BBox exposes the expected chip or indicator text, such as `Master Schema` or `Constellational Match`.
- The BBox or ROI has a reachable traceback affordance, for example title text, button text, data attribute, or a clicked panel transition tied to the source evidence.
- Source refs remain present in rendered affordances or event payloads: `traceback`, `evidence_refs`, `source_frame_refs`, and `source_bbox_refs`.
- Scrubbing to a manual keyframe timestamp renders that keyframe's geometry.
- Scrubbing away from a manual point timestamp hides the point overlay until the valid timestamp window.
- Scrubbing inside an explicit selected-overlay workspace keeps the selected manual BBox pinned while the analyst edits.
- Scrubbing outside the workspace removes the selected temporary geometry and returns to authoritative saved keyframes.
- A locked ROI from another `videoId` or a distant timestamp does not render.
- Triggering the proliferation action emits or calls a governed action with `surface: "bbox_roi_overlay"`, `manual_correction_wins: true`, and candidate-only evidence safeguards.

## Playwright Option

Best when the app shell can load a mocked analysis route.

Suggested flow:

1. Intercept the analysis API response with the mature payload.
2. Open the analysis page with the Video panel visible.
3. Wait for the video overlay container.
4. Assert the mature label and chip are visible.
5. Click the traceback affordance and assert the linked source/evidence surface opens.
6. Scrub to timestamp `1.000` and assert the first manual keyframe geometry.
7. Scrub to timestamp `2.000` and assert the second manual keyframe geometry.
8. Scrub outside the point/window and assert the point overlay is absent.
9. Activate the selected overlay edit workspace, scrub inside it, and assert the temporary selected BBox remains visible.
10. Scrub outside the workspace and assert saved keyframe authority returns.

## React Component Fixture Option

Best short-term path if full app boot is too expensive.

Mount `VideoPanel` with:

- `analysisData` set to the mature fixture payload.
- `currentTime` controlled by test state and updated with `rerender`.
- `getOverlaysForTime` returning deterministic overlays by timestamp.
- A mocked `eventBus.emit` to capture proliferation and traceback actions.

Core assertions should query by visible label/chip first, then inspect bounding box style values only for geometry checks. Prefer accessible text, titles, buttons, and data attributes over brittle class names.

## Choke Points To Watch

- Current frontend coverage is still partly source-contract based; this fixture should prove rendered behavior.
- `VideoPanel` may need stable test selectors for BBox label, chip, traceback button, ROI container, and manual edit workspace.
- Geometry assertions should tolerate small percentage rounding differences.
- EventBus-driven actions should be mocked at the boundary, not by asserting private component state.
- If video playback timing is unstable in Playwright, use a controlled scrubber or direct `currentTime` fixture control instead of relying on real playback.

## Acceptance Criteria

The new test is accepted when it fails if any of these regress:

- raw detector labels outrank mature Master Schema labels;
- second-order candidates display as confirmed evidence;
- BBox / ROI overlays lose traceback/source refs;
- manual keyframes bleed into unrelated timestamps;
- selected edit workspace loses the active BBox while scrubbing;
- locked ROI boxes render across video or timestamp boundaries.

