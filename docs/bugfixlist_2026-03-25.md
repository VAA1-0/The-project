# VAA1 bugfix list

## Date
- 2026-03-25
- updated 2026-03-30 18:35:00 EEST

## Legacy / pre-existing issues to keep visible
- `src/frontend/lib/api-service.ts` still contains older `any`-typing lint debt
- `src/frontend/lib/video-service.ts` still contains older `any`-typing lint debt
- `src/frontend/app/V2components/components/panels/POSAnalyzePanel.tsx` still contains older `any`-typing and unused-state lint debt
- `src/frontend/app/V2components/components/panels/DownloadPanel.tsx` still contains older `any`-typing lint debt and some hook-dependency warnings
- `src/frontend/app/V2components/components/panels/QuantitativeAnalysisPanel.tsx` still contains older `any`-typing and unused-state lint debt
- local frontend lint output also reports an outdated `baseline-browser-mapping` package notice

## Active product issues
- POS lexical fallback still needs stronger ASR-noise mitigation so malformed transcript tokens are not over-promoted into noun/interrogative outputs
- POS remains a cautious fallback for unsupported languages; full multilingual grammatical parsing is still not solved for the major global broadcaster set
- object detection currently works on the first run, but stable cross-frame object identity does not: the UI is still relying on frontend grouping heuristics instead of true backend tracking
- crowded scenes can still over-split one visible target into multiple `track` labels, especially for people; this is not acceptable as the long-term behavior for large corpora such as full film series
- object overlays are now usable, but their box accuracy can drift because grouped tracks currently expose one representative box instead of the nearest box sample for the exact current playback time
- object-recognition architecture now needs a backend `detector + tracker` design:
  - save raw detections
  - save tracked entities
  - use tracked entities as the default UI layer
  - keep raw detections available for download/audit
- object-recognition UI should not imply identity certainty beyond what the tracker can support; `person track 1` is acceptable, but person labels must not silently reset by cue jump in a way that suggests identity instability
- object-recognition needs a human correction layer for wrong tags, for example `refrigerator` -> `doorway`; corrected labels should be stored as analyst overrides, not as if the raw detector originally produced them
- corrected object labels should be exportable and triangulable, so downstream lenses can distinguish:
  - raw detector label
  - analyst-corrected label
  - confidence / provenance of the correction
- runtime economics is now one of the main product challenges to be solved:
  - visual analysis is the dominant time cost
  - `Quick sweep` must remain economically fast enough to function as an actual scout mode
  - future visual reintroduction into `Quick sweep` must be justified by both runtime and indicative value
- person-track demographic hints should be timestamp-triangulated across face, transcript, and audio support; audio may confirm speech overlap, but should not be treated as standalone demographic certainty
- if demographic hints are shown, they must stay cautious:
  - possible age band
  - possible gender presentation
  - confidence level
  - explicit support/triangulation note
- Quant matrix now supports side-by-side comparison, but still needs:
  - better density control for many videos
  - row/column scaling for larger corpora
  - a future path to detached or second-screen comparison use
- `Source Media` currently opens as a right-side analysis leaf instead of a true `Project`-side governance subview
- Quant project save is now supported, but `Open Saved Project...` is still not a first-class UI action; project bundles currently reopen through the generic saved-work import flow
- saved project import now works on the backend, but project reopen UX should be separated from single-analysis reopen UX
- OCR / Expressions / Objects overlays or bounding indicators are not currently surfaced in the UI
- CVAT annotation flow still needs a dedicated troubleshooting pass
- timeline indicators for video review are not yet implemented
- tracing / timestamp regime is still pending across lenses, especially for later triangulation and navigability
- `General Matrix` for multimodal comparison does not exist yet; only `Quant matrix` is scaffolded
- scene/environment detection is still missing as its own layer, which is why indicative context labels such as building, forest/canopy, classroom, or city setup are not yet available through the current object stack
- OCR is now calmer in the UI, but still needs a dedicated calibration pass:
  - current OCR performance is highly source-dependent
  - one tested news source yields very strong OCR while other tested sources yield many false fragments and near-duplicate spellings
  - OCR should not surface repeated variant strings as separate truths when they are likely the same underlying brand or graphic
  - OCR should later support metadata-assisted confirmation and canonicalization while preserving raw OCR separately from confirmed OCR

## Current architecture work
- shared multilingual language capability registry has been added
- registry-backed language support is now entering backend status responses
- language support and fallback state are now partially surfaced in the UI, but still need consistency across all language-based lenses
- Quant matrix snapshots now persist as `quant_matrix.json` and can travel with analysis and project bundles
- project save now exists as a separate bundle layer from analysis save
- timestamp backbone / `Time Bank` work is now active and should be treated as the shared integration contract for future tracking, correction, and autosave work
- the current stabilization phase should prefer backend truth over frontend heuristics whenever the same logic could otherwise diverge in two places

## Lint / verification snapshot
- `python3 -m py_compile api_server.py` passes
- targeted lint for `src/frontend/app/V2components/components/panels/QuantMatrixPanel.tsx` passes aside from the global `baseline-browser-mapping` notice
- targeted frontend lint still fails in legacy-heavy files because of pre-existing debt, not because of the new matrix/project-save logic:
  - `src/frontend/lib/api-service.ts`
  - `src/frontend/lib/video-service.ts`
  - `src/frontend/app/V2components/components/panels/DownloadPanel.tsx`
  - `src/frontend/app/V2components/components/panels/QuantitativeAnalysisPanel.tsx`

## Remarks from this process
- analysis save and project save must remain clearly separate concepts in the UI and backend
- download/governance surfaces should stay visually quiet because they are end-of-workflow controls, not the main analytic workspace
- file naming and downloadable artifact governance now need a dedicated plain-language cleanup pass, because the accumulated outputs are becoming hard to manage and should be grouped more logically across `Project`, `Downloads`, and saved bundles
- project bundles are structurally different from analysis bundles; they need distinct open/save language in the UI even if they share some import plumbing
- Quant comparison is now meaningful at two-video scale, but the panel will need another design pass before it is comfortable for larger corpora such as full-film series or broadcaster collections
- for large datasets such as all James Bond films, first-run object detection is not the real risk; the real risk is unstable object tracking and presentation drift if backend tracked entities are not introduced
- `Quick sweep` is now intentionally locked, for the time being, as a transcript-led scout mode with navigable POS / Quant and without dense visual layers
- the stabilization workplan for this phase now exists in:
  - `docs/vaa1_stabilization_workplan_2026-03-30.md`
- deprecated and retired script surfaces should now be tracked in:
  - `docs/deprecated_scripts_log_2026-03-30.md`
