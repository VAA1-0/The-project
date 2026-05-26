# VAA1 Proceedings Note: Meaning Network, Mature Data Proliferation, and Presentation Readiness

Date: 2026-05-26

## Proceedings summary

This sprint advanced VAA1 from promising but partly mute interpretive surfaces toward a more operational maturity-driven workflow.

The main delivered areas were:

- Datascene Meaning Network graph operationalization.
- Meaning / Plot and Character Path lens separation.
- Master Schema-first mature data proliferation.
- Narrative Agent and object correction precedence.
- Meaning Network presence intervals and feedback loops.
- Source-linked graph navigation and video synchronization groundwork.
- Backend and frontend automated test stabilization.

## Meaning Network progress

The Meaning Network moved from an inert subfield toward a governed graph workspace.

Delivered or partially delivered capabilities include:

- graph rendering for Master Schema-derived and manual nodes,
- node creation controls for characters, Narrative Agents, objects, situations, continuity anchors, off-camera presence, spoken word, prosody, music, and location,
- graph zoom controls and scrollable inspection,
- whole timeline, scene timeline, and character timeline modes,
- scene bands as time spans,
- draggable presence bars and interval handles,
- persistence of adjusted presence intervals into `master_schema_presence_intervals`,
- synchronization hooks for Narrative Agent cards and Master Schema subject cards,
- dedicated Meaning Network panel registration,
- graph cursor groundwork for synced timeline/video navigation.

The Meaning Network is now understood as a larger governed workspace. Narrative Agent presence intervals are one important feature inside it, not the whole graph regime.

## Mature data proliferation progress

The maturity regime now has stronger operational footing:

- Manual analyst corrections are treated as higher authority than raw detector outputs.
- Mature labels are expected to outrank stale raw labels in BBox/ROI and video overlays.
- Master Schema projections feed Meaning / Plot, Character Paths, Narrative Agent cards, and graph views.
- Near-match and proliferation objects are represented as reviewable candidates rather than hidden under-the-hood options.
- Confirmation/cancellation remains required for ordinary-probability candidates.
- Only manual confirmation/correction or very high-confidence, source-linked support should proliferate as mature.

The principle remains:

```text
Corrected should stand corrected everywhere except traceback.
```

## Current design decisions

- Meaning / Plot should remain the cross-agent plot and scene-meaning map.
- Character Paths should primarily belong to Narrative Agent surfaces.
- Interpretive traditions should operate as lenses, not imposed labels.
- SFL/dependency parsing, transcript evidence, diarization, prosody, visual tracks, objects, and analyst corrections should feed interpretive prose only through source-linked maturity.
- The Meaning Network should support both on-camera and off-camera presence, because scene meaning often depends on entities that are heard, implied, pursued, remembered, or institutionally present before they are visible.

## Known remaining issues

- On-camera Narrative Agent lane routing is still inconsistent in the graph.
- Some graph nodes can lose direct video-source navigation and must be re-hardened.
- Text labels can still overlap when the graph is dense.
- The Meaning Network needs a larger, dynamically resizable workspace suitable for secondary-display use.
- Graph edge management needs clearer affordances and source verification.
- Scene add/delete/paint/resize operations need full governed persistence.
- Presence handles should scrub the video during drag and persist final intervals through the Master Schema.
- BBox/ROI correction controls still need hardening, especially around object-vs-agent misclassification and dropdown behavior.
- Lint remains a broad frontend baseline issue.
- The live download integration script requires a running API server and localhost access.

## Automated test state

The following checks were run on 2026-05-26:

```text
Backend contracts:
conda run -n vaa1_core_test python -m pytest tests --ignore=tests/test_download.py
Result: 139 passed, 3 skipped

Frontend unit tests:
npm test
Result: 50 passed

Frontend typecheck:
./node_modules/.bin/tsc --noEmit
Result: passed
```

`tests/test_download.py` is a live localhost integration script. It attempted to call:

```text
http://localhost:8000/api/status/cf3c6581-ab6e-4d56-91c9-d022c9d78190
```

It failed in the sandbox with localhost network permission denial. This should be verified separately with the API server running in the presentation environment.

`npm run lint` still fails with the existing broad lint baseline:

```text
427 problems: 296 errors, 131 warnings
```

The dominant categories are `no-explicit-any`, unused variables, hook dependency warnings, retired component lint, CVAT-adjacent files, and one render-purity issue involving `Math.random`.

## Test harness hardening

Several test-only updates were made so the contract suite can run reliably in the lean `vaa1_core_test` environment:

- OpenCV/numpy stubs in face/video tests now cover current pipeline behavior.
- Test stubs now restore global modules so fake `cv2` does not pollute later integration-style tests.
- Metadata and mature-data proliferation tests stub optional DeepFace and quantitative-analysis imports where those heavy dependencies are irrelevant to the contract under test.
- Legacy `app.main` backend tests skip when that older entrypoint is absent from the current VAA1 layout.

## Next practical steps

1. Harden Meaning Network source navigation.
2. Fix on-camera/off-camera lane routing.
3. Make graph workspace dynamically resizable and practical as a full panel.
4. Complete presence-handle persistence and live video scrub.
5. Make scene bands paintable, resizable, addable, and deletable.
6. Add governed edge creation/editing/deletion.
7. Continue BBox/ROI mature-label correction hardening.
8. Add Playwright coverage for graph navigation, handle dragging, source seeking, and panel synchronization.
9. Verify live API download/export paths outside the sandbox.
10. Decide whether to address lint baseline now or defer it as tracked technical debt.

## Operating takeaway

VAA1 is moving toward the right core promise:

```text
Fully transparent, traceable, navigable, automated multimodal analysis with full analyst control.
```

The Meaning Network Graph and Mature Data Proliferation regime are now the central practical path for turning raw detections into mature narrative evidence.
