# VAA1 BBox/ROIbox Coordinate Authority Audit

Date: 2026-06-01

Purpose: Phase 1 data-flow map and bypass audit for the BBox/ROIbox coordinate-authority overhaul.

Mandate: stop isolated BBox/ROIbox patches. The only permitted visual geometry path is:

```text
Canonical Saved Geometry Bundle
-> Authoritative BBox/ROI Resolver
-> Projection Engine
-> Visible Overlay
```

## Current 15-Point Runtime Data Flow

1. Manual edit events are captured in `VideoPanel.tsx` through overlay pointer handlers, the BBox/ROI editor, native annotation mode, and forensic ROI mode. `OBJDetectionPanel.tsx` also creates object-backed manual visual annotations.

2. Drag and resize geometry is currently normalized in `VideoPanel.tsx` through `getRenderedVideoPoint`, `beginOverlayGeometryDrag`, pointer-move draft updates, and `normalizeDraftBox`. Native annotation drawing uses a separate `buildNormalizedDraftPoint` path.

3. Source-video coordinates are converted to visible pixels in `VideoPanel.tsx` through `renderedVideoRect`, percentage styles, and local fallback conversion from `overlay.x/y/w/h` to normalized boxes. This is a bypass risk because `OverlayBox` carries both normalized and pixel geometry.

4. Typed in/out times are resolved in `VideoPanel.tsx` through `parsePreciseTimeInput`, `commitSelectedTimeInput`, `resolveEditWithTimeInputDrafts`, and `getOverlayTimeBounds`.

5. `Save` and `Save here` build the canonical annotation in `VideoPanel.tsx` through `saveSelectedIndication` and `saveSelectedIndicationAtFrame`. `OBJDetectionPanel.tsx` builds a similar annotation through `saveObjectIndication`.

6. The API call is `VideoService.saveAnnotationCorrections`, which delegates to `apiService.saveAnnotationCorrections`.

7. The backend endpoint is `POST /api/annotation-corrections/{analysis_id}` in `api_server.py`. It writes `status["annotation_corrections"]`, calls `write_annotation_corrections_file(status)`, updates mise-en-scene artifacts, appends an event, persists the analysis record, and returns `annotation_corrections`.

8. After save, the frontend usually discards the direct returned correction payload, calls `VideoService.refreshAnalysis`, and only then updates `analysisData`. This creates a short but important authority gap where the canonical backend response is not the first source of truth.

9. The visible overlay renderer is `overlayBoxes` plus the JSX overlay map in `VideoPanel.tsx`. It currently mixes manual annotations, object tracks, OCR, expressions, Meaning Network intervals, mature Master Schema labels, proliferation candidates, selected snapshots, and local draft state.

10. Panels that can read or rewrite the same annotation include `VideoPanel.tsx`, `OBJDetectionPanel.tsx`, manual leaf panels through shared video navigation helpers, Master Schema/Meaning Network surfaces through annotation corrections, and backend mature-data builders.

11. Mature-data/proliferation paths that can touch related fields include stored proliferation matches, proliferation decisions, Master Schema resolved evidence, Meaning Network presence intervals, second-order label proliferation, and backend mature-data surface generation.

12. Resize currently triggers `ResizeObserver`, `window.resize`, and `updateRenderedVideoRect` in `VideoPanel.tsx`.

13. Fullscreen currently uses the VAA1 media frame and listens for `fullscreenchange`, then refreshes the rendered video rectangle.

14. Playback/scrub behavior updates `currentTime`; manual visibility and geometry are recomputed from time, selected workspace state, and any local overlay geometry draft.

15. Save/reopen depends on `annotation_corrections.json`, persisted analysis status, frontend refresh, and the transformed `analysisData.annotationCorrections` payload.

## Bypass Audit

### Geometry Resolution Outside `bbox-authority.ts`

Current bypasses in `VideoPanel.tsx`:

- `geometryToNormalizedBox` parses candidate geometry locally.
- `calculateDraftBoxIoU`, `calculateDraftBoxCenterDistance`, `isSameSpaceBoxMatch`, and `analystManualAuthoritySuppressesObjectBox` evaluate spatial authority locally.
- `synthesizePersonBoxFromExpression` creates a derived BBox locally.
- `mergeGeometryKeyframes` deduplicates manual keyframes locally.
- `buildBoxFromPoints` creates native annotation draft geometry locally.
- `buildTrackGeometryKeyframes` builds raw track fallback keyframes locally.
- `resolveManualGeometryAtTime` delegates to `bbox-authority.ts`, but supplies raw track keyframes built locally.
- `getOverlayNormalizedBox` chooses between `overlay.normalizedBox`, pixel fallback fields, and local geometry drafts.
- `beginOverlayGeometryDrag` and pointer-move code mutate normalized geometry drafts locally.
- `saveSelectedIndication` constructs the saved geometry bundle locally.
- `saveSelectedIndicationAtFrame` mutates time bounds locally before delegating.
- Native annotation and forensic ROI drawing use separate pointer-to-normalized coordinate paths.

Current bypasses in `OBJDetectionPanel.tsx`:

- `normalizeObjectBox` converts object BBoxes locally.
- `getManualOverrideForObject` decides object manual correction matching locally.
- `saveObjectIndication` constructs a manual visual annotation locally.

### Projection Outside `bbox-authority.ts`

Current bypasses:

- `VideoPanel.tsx` owns `getRenderedVideoRect`.
- The overlay renderer uses percentage CSS against an overlay container sized from `renderedVideoRect`.
- Pointer normalization subtracts `getBoundingClientRect()` and `renderedVideoRect` locally.
- Native annotation drawing uses the native overlay element rect directly, not the same projection utility as object/manual overlays.

### Persistence Authority Gaps

Current gaps:

- `apiService.saveAnnotationCorrections` returns canonical backend corrections, but most callers discard the returned payload.
- UI transient states are cleared after refresh, not immediately after backend success.
- Generic alerts elsewhere can hide the exact failing branch.
- Save paths do not currently assert that the returned backend payload contains the saved manual annotation id before clearing local drafts.

## Required Consolidation

Move the following into `src/frontend/lib/bbox-authority.ts`:

- true video content rect projection,
- normalized point-from-client projection,
- normalized-to-rendered pixel projection,
- spatial matching and suppression helpers,
- geometry parsing from arbitrary candidate payloads,
- track keyframe construction or a resolver API that accepts raw object samples,
- selected overlay geometry draft resolution,
- manual correction bundle construction for VideoPanel and OBJDetectionPanel.

Panels should become passive consumers:

```text
panel event -> bbox-authority command/result -> save canonical bundle -> backend response -> render resolver output
```

## First Pass Implemented In This Branch

The first consolidation pass should:

- move projection helpers into `bbox-authority.ts`,
- make `VideoPanel.tsx` use the shared projection helpers for resize/fullscreen and pointer conversion,
- move keyframe merge and point-box construction helpers into `bbox-authority.ts`,
- make save callers immediately install the returned canonical `annotationCorrections` payload before refresh.

Remaining follow-up:

- collapse `OverlayBox` so visible BBox geometry is no longer stored as both `normalizedBox` and pixel `x/y/w/h`,
- move overlay authority selection out of `VideoPanel.tsx`,
- make `OBJDetectionPanel.tsx` delegate annotation construction to the same saved-bundle builder,
- add Playwright rendered validation.
