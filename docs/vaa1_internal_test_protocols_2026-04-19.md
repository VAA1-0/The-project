# VAA1 Internal Test Protocols

Date: 2026-04-19  
Sprint purpose: protect the proportions of VAA1 as the platform grows.

This document defines the first internal test protocol layer for VAA1. The aim is not to freeze the software. The aim is to make sure that major conceptual proportions remain intact when we add new detectors, panels, taxonomies, exports, and annotation workflows.

## 1. What "Software Proportions" Means

In VAA1, software proportions are the structural relationships that must remain true:

- The Master Schema is the canonical cross-category manual annotation surface.
- Objects is a leaf panel, not the master schema.
- CVAT is an external annotation bridge, not the native source of truth.
- Source media metadata is source-critical data, not the same thing as interpretive annotation.
- Manual annotations must route to their own category and remain visible in the Master Schema.
- Automatic detections and manual additions should coexist in mature mixed panels where that panel exists.
- Face anonymization is opt-in and analyst-visible, not a default hidden behavior.
- Timestamped data must remain navigable back to media time.
- Export and handoff bundles must not include local secrets, token files, caches, or private runtime state.

These rules are the ship's frame. Features can change, but the frame should not quietly bend.

## 2. Current Test Layers

### Frontend Governance Test

File:

- `src/frontend/tests/manual-annotation-governance.test.mjs`

Command:

```bash
cd src/frontend
npm run test:governance
```

What it checks:

- `ManualVisualAnnotation.category` remains aligned with the native video annotator categories.
- The Tools manual leaf dropdown exposes the full category list.
- Manual categories remain alphabetized for governance clarity.
- Every manual category has subcategory support in the native annotator.
- Tools dropdown routes point to registered GoldenLayout panels.
- Every manual category has a Master Schema leaf panel.
- Manual `OBJ` annotations are the only manual annotations converted into object rows.
- Manual annotations remain grouped by category for Master Schema and leaf views.

Why this matters:

- It protects the exact area where VAA1 recently had proportion drift: manual annotations collapsing into Objects instead of surfacing in their correct leaf and Master Schema.

### Frontend Type Check

Command:

```bash
cd src/frontend
npx tsc --noEmit
```

What it checks:

- TypeScript consistency.
- React component type compatibility.
- API service and panel type integration.

Why this matters:

- It catches many wiring errors before a browser session.

### Existing Python Contract Tests

Representative files:

- `tests/test_face_anonymizer.py`
- `tests/test_face_backend_contract.py`
- `tests/test_face_video_pipeline_contract.py`
- `tests/test_timestamp_schema.py`

Representative command:

```bash
conda run -n vaa1_core python -m pytest tests/test_face_anonymizer.py tests/test_face_backend_contract.py tests/test_face_video_pipeline_contract.py tests/test_timestamp_schema.py
```

What these protect:

- Face anonymizer behavior.
- Face backend contracts.
- Video-frame face pipeline contract.
- Timestamp schema expectations.

## 3. Manual Smoke Protocol

Run this when the UI has changed, especially if panels, annotation categories, or routing behavior changed.

### Startup

1. Start backend.
2. Start frontend.
3. Confirm the dashboard loads.
4. Confirm the Project panel lists available analyses.
5. Confirm the Video panel opens a selected analysis.

### Core Panel Proportions

1. Open `Tools`.
2. Open `Master Schema`.
3. Open `Objects`.
4. Open `OCR`.
5. Open `Expressions`.
6. Open `Audio`.
7. Confirm these panels open on the right-side analysis stack, not in the left Project/Downloads area.

### Native Manual Annotation Routing

For a known completed video:

1. Open native annotation mode.
2. Add one `Identification` annotation.
3. Add one `Interaction` annotation.
4. Add one `Scene` annotation.
5. Add one `OBJ` annotation.
6. Confirm all four appear in Master Schema.
7. Confirm `Identification` appears in the Identification leaf.
8. Confirm `Interaction` appears in the Interaction leaf.
9. Confirm `Scene` appears in the Scene leaf.
10. Confirm only the `OBJ` manual annotation appears as a manual object row in Objects.

### Mixed Panel Check

For a completed analysis with automatic detections:

1. Confirm automatic object detections still show in Objects.
2. Confirm manual `OBJ` additions show alongside automatic object detections.
3. Confirm automatic OCR still shows in OCR.
4. Confirm manual `OCR` additions show alongside automatic OCR.
5. Confirm automatic expression samples still show in Expressions.
6. Confirm manual `Expressions` additions show alongside automatic expressions.
7. Confirm audio/prosody can scroll to the full media length when cues exist beyond the early section.

### Master Schema Check

1. Open Master Schema.
2. Confirm it shows all manual categories.
3. Filter or open leaves for several categories.
4. Confirm timestamps jump the video to the expected time.
5. Confirm identity/role/open-note fields are displayed when present.

## 4. Pre-Push Test Protocol

Before pushing a VAA1 feature branch, run:

```bash
git status --short
cd src/frontend
npm run test:governance
npx tsc --noEmit
```

If backend contract files changed, also run the focused Python tests:

```bash
conda run -n vaa1_core python -m pytest tests/test_timestamp_schema.py tests/test_face_anonymizer.py tests/test_face_backend_contract.py tests/test_face_video_pipeline_contract.py
```

If packaging or handoff files changed, inspect the archive contents before sharing:

```bash
tar -tzf vaa1_annotation_operational_handoff_2026-04-19.tar.gz
```

Bundle safety rule:

- Do not include `.cvat_tokens/`, `node_modules/`, `.next/`, `__pycache__/`, local uploads, local private media, or runtime token/cache files in colleague handouts.

## 5. Future Test Families

These should be added gradually.

### First Release Readiness Protocol

Reminder:

- When the frontend and backend are fully configured and VAA1 is ready for the first release, define a determined release-readiness test protocol before release freeze.

This should be stricter than the current sprint checks. It should include:

- backend health and startup checks
- frontend startup and panel smoke checks
- native annotation governance checks
- Master Schema routing checks
- timestamp navigation checks
- representative media checks
- CVAT bridge boundary checks
- source media metadata checks
- export and handoff safety checks
- face anonymization opt-in checks

This item is also listed in `docs/whattoworkon.txt` as a main task-list reminder.

### Backend API Smoke Tests

Target:

- `/api/health`
- `/api/upload`
- `/api/status/{analysis_id}`
- `/api/annotation-corrections/{analysis_id}`
- `/api/taxonomy/shared`

Purpose:

- Confirm the backend can start and core endpoints return stable shapes.

### Correction Payload Tests

Target:

- `src/frontend/lib/annotation-corrections.ts`
- `api_server.py` correction endpoints

Purpose:

- Confirm manual annotation saves are stable and category-safe.

### Master Schema Fixture Tests

Target:

- synthetic `AnnotationCorrections` fixture containing one annotation from every category.

Purpose:

- Confirm every manual category can be represented, sorted, filtered, and displayed without collapsing into the wrong leaf.

### Timestamp Navigation Tests

Target:

- video timeline event bus behavior
- Time Bank
- Transcript
- Object/OCR/expression jumps

Purpose:

- Confirm every detection and annotation remains navigable to media time.

### Taxonomy Completeness Tests

Target:

- `src/frontend/lib/metadata-taxonomy.ts`
- situational taxonomy documentation

Purpose:

- Confirm the UI taxonomy and documentation remain aligned, including everyday situations, transitions, and season changes.

### Export Safety Tests

Target:

- colleague bundle scripts or commands
- download/project bundle endpoints

Purpose:

- Confirm exported bundles contain useful artifacts and exclude secrets/private runtime files.

### CVAT Boundary Tests

Target:

- CVAT bridge routes and frontend CVAT panel.

Purpose:

- Confirm CVAT remains a bridge and does not silently overwrite native annotation governance.

## 6. Sprint Definition of Done

This first internal test sprint is complete when:

- The protocol document exists.
- The governance test exists.
- A named frontend command runs the governance test.
- The governance test passes.
- TypeScript still passes.
- The work is documented as protecting VAA1 proportions, not merely checking code syntax.

## 7. Current Bending Tasks

The next design-heavy test problem is cross-annotation propagation:

- Interaction may imply Identification.
- Identification may imply Role.
- Role may imply Action or Scene context.
- Scene or Genre may imply situational taxonomy candidates.

This should not be implemented as automatic hard truth at first. The safer design is candidate propagation:

- generated candidate
- visible provenance
- analyst review
- accepted/rejected state
- Master Schema traceability

That future workflow deserves its own protocol and test suite.
