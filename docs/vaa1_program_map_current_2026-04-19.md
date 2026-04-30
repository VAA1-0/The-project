# VAA1 Program Map - Current Operating Shape

Date: 2026-04-19  
Branch context: `petteri`  
Purpose: describe what VAA1 is currently made of, how it runs, how data moves through it, and which parts are operational versus still bending tasks.

Update note, 2026-04-30:

- This document remains useful as the April 19 baseline program map.
- It is no longer the complete current delivery map.
- For the latest delivered functionality audit, including SFL/Dependency, multimodal meaning, second-order label proliferation, Meaning/Plot, Time Bank Meaning, audio sample clouds, identity triangulation, forensic traceback, and evidence-authority navigation, see:
  `docs/vaa1_functionality_delivery_audit_2026-04-30.md`

This document is the current architectural map of VAA1 as it exists in the working repository. It is intentionally concrete: file paths, runtime components, data stores, analyst panels, pipeline modules, and known seams are named explicitly.

## 1. Executive Map

VAA1 is currently a local multimodal video analysis platform. It combines:

- A FastAPI backend that receives videos, runs analysis pipelines, writes output artifacts, exposes status/download/correction APIs, and brokers CVAT integration.
- A Next.js frontend, usually launched in a browser or Electron shell, that provides the analyst cockpit.
- A GoldenLayout workspace that opens video, objects, OCR, expressions, audio, transcript, master schema, source metadata, matrix, CVAT, and manual-governance panels.
- A native manual annotation layer that saves analyst additions as correction payloads and routes them into category-specific panels plus the Master Schema.
- Optional CVAT bridge tooling for external annotation exchange.
- A face pipeline that can analyze selected video frames and optionally anonymize faces when explicitly switched on.

At the moment, VAA1 is best understood as an operational local research workstation rather than a hardened multi-user server product.

## 2. Runtime Components

```text
Analyst
  |
  v
Browser or Electron shell
  |
  v
Next.js frontend in src/frontend
  |
  | HTTP API calls through src/frontend/lib/api-service.ts
  | normalized through src/frontend/lib/video-service.ts
  |
  v
FastAPI backend in api_server.py
  |
  | upload, analyze, status, download, corrections, taxonomy, CVAT sync
  |
  v
Analysis pipelines in src/backend/analysis
  |
  | object detection, OCR, audio/transcript, prosody, expressions,
  | motion/scene cues, POS, quantitative analysis, morphology/language,
  | timestamp traceability, source media metadata
  |
  v
Local artifacts
  |
  | uploads/
  | outputs/api_results/
  | outputs/audio/
  | outputs/transcripts/
  | outputs/taxonomy/
  | static/
  |
  v
Frontend panels render automatic outputs + manual corrections
```

Optional bridge:

```text
VAA1 frontend/backend
  |
  v
CVAT bridge at src/cvat/backend
  |
  v
Local or external CVAT task/job/annotation exchange
```

## 3. Primary Entry Points

### Backend

Main file:

- `api_server.py`

Core backend framework:

- FastAPI app object: `app = FastAPI(...)`
- CORS configured for local frontend ports `3000` and `3001`.
- Static serving mounted at `/static`.

Main local directories created by the backend:

- `uploads/`
- `outputs/api_results/`
- `outputs/audio/`
- `outputs/transcripts/`
- `outputs/imported_work/`
- `outputs/taxonomy/`
- `static/`

### Frontend

Main directory:

- `src/frontend/`

Important package scripts:

- `npm run dev` starts the Next.js frontend.
- `npm run start:electron` starts the Next.js frontend and Electron wrapper together.
- `npm run electron` launches `electron ../../electron.js`.

Desktop wrapper:

- `electron.js`

### CVAT Bridge

Main bridge directory:

- `src/cvat/backend/`

Bridge routes include login, logout, health, task creation, job listing, annotation upload, annotation download, and annotation format discovery.

The bridge is operationally external to the native annotation layer. It is a connector, not the master schema.

## 4. Backend API Surface

The FastAPI server currently exposes these major endpoint groups.

### Upload and Analysis

- `POST /api/upload`
- `POST /api/analyze/{analysis_id}`
- `GET /api/status/{analysis_id}`
- `GET /api/analyses`
- `DELETE /api/analysis/{analysis_id}`
- `POST /api/session/clear`

### Downloads and Bundles

- `GET /api/download/{analysis_id}/{file_type}`
- `GET /api/download-bundle/{analysis_id}`
- `POST /api/download-project-bundle`
- `POST /api/import-bundle`

### Source Media and Metadata

- `GET /api/source-media/{analysis_id}`
- `POST /api/source-media/{analysis_id}`
- `POST /api/source-media/{analysis_id}/references`
- `GET /api/source-media/{analysis_id}/references/{stored_filename}`

### Manual Corrections and Native Annotations

- `GET /api/annotation-corrections/{analysis_id}`
- `POST /api/annotation-corrections/{analysis_id}`

These endpoints are the current persistence mechanism for native manual annotations and analyst corrections.

### Taxonomy

- `GET /api/taxonomy/shared`
- `POST /api/taxonomy/shared/labels`
- `GET /api/morphology/catalog`

Shared taxonomy labels are stored in `outputs/taxonomy/shared_taxonomy.json`.

### Matrix and Language Analysis

- `POST /api/matrices/quant/{analysis_id}`
- `POST /api/matrices/pos/{analysis_id}`
- `POST /api/pos-analysis/{analysis_id}/refresh`

### CVAT

- `POST /api/status/{analysis_id}/cvat-link`
- `POST /api/annotations/{analysis_id}/sync-cvat`

### Utility

- `POST /api/reveal-workspace-path/{path_type}`
- `GET /api/health`
- `GET /`

## 5. Analysis Modes

The backend currently recognizes three analysis tiers:

- `quick_sweep`
- `science_scan`
- `forensic_sensor`

The backend currently recognizes five modality focus values:

- `multimodal`
- `graphics`
- `audio`
- `images`
- `text`

The tier and modality settings control sampling density, which analysis modules run, whether annotated video is saved, whether face sampling is enabled, and how expensive the run should be.

Current interpretation:

- `quick_sweep` is the lighter pass.
- `science_scan` is the main research-grade general pass.
- `forensic_sensor` is the densest and most expensive pass.

Face-related run options include:

- `apply_face_anonymization`
- `face_message_style`
- `face_requires_person_detection`

The face anonymizer is intentionally switch-driven. It should not be assumed as default behavior.

## 6. Backend Analysis Modules

Main analysis package:

- `src/backend/analysis/`

Important modules:

- `pipeline_ingestion.py` validates and prepares video input.
- `pipeline_video_frames.py` performs frame-based video analysis, including object detection, OCR, frame sampling, annotated output video, motion/scene-related traces, and organized result files.
- `pipeline_audio_text.py` handles audio transcription flow.
- `audio_prosody.py` extracts audio/prosody cues.
- `expression_detector.py` performs expression sampling.
- `pipeline_manager.py` orchestrates the full pipeline.
- `pipeline_nlp.py` supports NLP operations.
- `pipeline_summary.py` builds summaries.
- `pos_analysis.py` performs POS analysis.
- `quantitative_analysis.py` performs quantitative text analysis and evidence attachment.
- `morphology_catalog.py` exposes available morphology resources.
- `language_capability_registry.py`, `language_pack_policy.py`, `language_utils.py`, and `language_modeller.py` govern language/model support.
- `evidence_linker.py` links transcript, audio, expression, object, and OCR evidence into traceable evidence.
- `timestamp_schema.py` defines media reference and timestamp traceability structures.

Face-specific modules:

- `app/pipeline/face_analysis.py`
- `app/pipeline/face_anonymizer.py`
- `app/pipeline/face_bridge.py`
- `app/face_worker.py`

Face test/support scripts:

- `app/test_face_analysis.py`
- `app/test_face_batch.py`
- `app/test_face_bridge.py`
- `app/test_face_video_pipeline.py`

## 7. Frontend Map

Main frontend directory:

- `src/frontend/`

Core UI architecture:

- Next.js application.
- GoldenLayout workspace in `src/frontend/app/V2components/components/LayoutHost.tsx`.
- Panel communication through `src/frontend/lib/golden-layout-lib/eventBus.ts`.
- Low-level backend API client in `src/frontend/lib/api-service.ts`.
- Frontend business logic and normalization in `src/frontend/lib/video-service.ts`.
- Video blob handling in `src/frontend/lib/blob-store.ts`.
- Local project/library helpers in `src/frontend/lib/local-library.ts`.
- Annotation correction helpers in `src/frontend/lib/annotation-corrections.ts`.
- Shared media and situational taxonomy in `src/frontend/lib/metadata-taxonomy.ts`.

### GoldenLayout Workspace

The workspace is panel-driven. Panels can be opened by menu actions, button actions, event bus messages, or workspace presets.

Important workspace events:

- `videoIdChanged`
- `videoTimeLineChanged`
- `analysisCorrectionsChanged`
- `openPanelRequest`
- `workspacePresetRequest`
- `workspacePresetChanged`
- `nativeAnnotationOpen`
- `toolsSectionFocus`
- `visualCueOpen`
- `visualCueClose`

Persisted workspace state:

- GoldenLayout layout is stored in browser local storage.
- Matrix selections and some taxonomy usage counts are also local-browser state.

## 8. Main Frontend Panels

### Project and Media

- `ProjectPanel.tsx`: project/library list, upload/open/analyze workflow entry.
- `VideoPanel.tsx`: video playback, timeline, native manual annotation drawing, cue jumps, audio lane, transcript snippets, visual overlays.
- `VideoComparePanel.tsx`: comparison-oriented video view.
- `SourceMediaMetadataPanel.tsx`: source media metadata and source-critical documentation.
- `DownloadPanel.tsx`: analysis downloads and bundle-oriented export surface.

### Automated and Mixed Analysis Panels

These panels are mature or semi-mature panels that render automatic analysis outputs and, where implemented, manual additions.

- `OBJDetectionPanel.tsx`: objects and manual `OBJ` annotations.
- `OCRPanel.tsx`: OCR detections and manual `OCR` annotations.
- `ExpressionPanel.tsx`: expression samples and manual `Expressions` annotations.
- `SpeechToTextPanel.tsx`: transcript, manual transcription entries, audio/prosody view when used in audio mode.
- `TimeBankPanel.tsx`: time-linked evidence envelope.
- `POSAnalyzePanel.tsx`: POS analysis.
- `QuantitativeAnalysisPanel.tsx`: quantitative text analysis.
- `POSMatrixPanel.tsx`: cross-analysis POS matrix.
- `QuantMatrixPanel.tsx`: cross-analysis quantitative matrix.

### Governance and Bridge Panels

- `ToolsPanel.tsx`: analysis tools, native annotation console, CVAT bridge entry, visual/morphology/language/mission/face controls.
- `MasterSchemaPanel.tsx`: canonical cross-category manual annotation view.
- `CvatPluginPanel.tsx`: CVAT bridge UI.

### Universal Manual Leaf Panels

Some manual categories do not yet have specialist automatic detectors or bespoke mature panels. They are rendered through category-filtered Master Schema leaves.

Current universal leaves:

- `Action`
- `Cinematic Cues`
- `Genre`
- `Identification`
- `Interaction`
- `Metadata`
- `Movement`
- `Notes`
- `Role`
- `Scene`

Current mature mixed/manual-aware panels:

- `Audio`
- `Expressions`
- `OBJ`
- `OCR`
- `Transcription`

## 9. Native Manual Annotation Governance

The native annotation layer is now a first-class VAA1 workflow.

Current manual categories:

- `Action`
- `Audio`
- `Cinematic Cues`
- `Expressions`
- `Genre`
- `Identification`
- `Interaction`
- `Metadata`
- `Movement`
- `Notes`
- `OBJ`
- `OCR`
- `Role`
- `Scene`
- `Transcription`

The analyst currently:

1. Opens a video.
2. Opens native annotation mode.
3. Chooses category, subcategory, label, and optional fields.
4. Draws a box or creates a time-linked annotation.
5. Saves the annotation as a correction payload.
6. Sees the annotation surface in the correct category panel and in Master Schema.

Manual annotation payloads currently support:

- category
- subcategory
- label
- custom label
- timestamp, start, and end
- box geometry coordinates
- identity affirmation
- role affirmation
- audio foley note
- open note
- metadata correlation
- teaches-regime marker
- created/updated timestamps
- user/analyst source metadata

Important governance principle:

- `Objects` is not the master schema.
- `Master Schema` is the canonical cross-category review surface.
- Category panels are leaf or specialist views.
- CVAT is an external bridge, not the native governance source of truth.

## 10. Master Schema

The Master Schema panel is the canonical surface for manual annotations.

It currently supports:

- all-category review
- category-filtered review
- timestamp jumping
- display of labels, subcategories, identity notes, role notes, metadata correlations, and open notes

The Master Schema is especially important because several annotation types are semantically linked. For example:

- an `Interaction` annotation may imply identities and roles
- an `Identification` annotation may imply role or interaction candidates
- an `Action` annotation may imply scene or object relations
- a `Genre` or `Scene` annotation may imply situational context

Automatic cross-annotation propagation is not implemented yet. This is a design task, not a bug.

## 11. Situational and Person-Situation Taxonomy

Current taxonomy file:

- `src/frontend/lib/metadata-taxonomy.ts`

Current full documentation:

- `docs/vaa1_situation_taxonomy_full_2026-04-19.md`

The situation schema includes:

- event
- interaction
- communication
- experience
- context
- time
- epistemic state
- normative frame
- media function
- multimodal composition
- person-situation domain

The person-situation taxonomy includes:

- home
- work
- public
- social relational
- inner life
- mobility
- leisure
- nature
- consumption

Additional first-class situation types now include:

- `transition`
- `season_change`

The taxonomy is intended to support everyday scenes as well as narrative, institutional, crisis, and interpretive situations.

## 12. Data Stores and Artifacts

### Backend Runtime State

The backend keeps in-memory analysis status in:

- `analysis_status`

This is useful for active sessions, but not a substitute for a durable database.

### Backend Files

Important local output roots:

- `uploads/`: uploaded source videos.
- `outputs/api_results/`: per-analysis output folders and result artifacts.
- `outputs/audio/`: audio extraction/prosody-related artifacts.
- `outputs/transcripts/`: transcript artifacts.
- `outputs/taxonomy/`: shared taxonomy store.
- `outputs/imported_work/`: imported bundles.
- `static/`: served static files.

Common artifact classes:

- JSON summaries
- CSV object detections
- CSV OCR detections
- transcript JSON/CSV artifacts
- audio/prosody artifacts
- annotated video files
- source media metadata
- annotation correction files
- download bundles

### Frontend Browser State

Current frontend-local state includes:

- video blobs in IndexedDB through `blob-store.ts`
- local library/project references through frontend helpers
- GoldenLayout workspace layout in local storage
- matrix selections in local storage
- custom taxonomy usage counts in local storage

### SQLite Status

There are SQLite planning/setup documents and backend database files in the repository, but the current operating system is still primarily file/API/local-browser-state based. Treat SQLite as a partial or upcoming persistence layer unless verified for a specific workflow.

## 13. CVAT Bridge Role

CVAT integration currently exists as a bridge, not as the VAA1-native annotation master.

Relevant bridge files:

- `src/cvat/backend/server.ts`
- `src/cvat/backend/routes/cvat-login.ts`
- `src/cvat/backend/routes/cvat-logout.ts`
- `src/cvat/backend/routes/cvat-health.ts`
- `src/cvat/backend/routes/cvat-getTask.ts`
- `src/cvat/backend/routes/cvat-jobs.ts`
- `src/cvat/backend/routes/cvat-postTask.ts`
- `src/cvat/backend/routes/cvat-uploadData.ts`
- `src/cvat/backend/routes/cvat-getAnnotation.ts`
- `src/cvat/backend/routes/cvat-postAnnotation.ts`
- `src/cvat/backend/routes/cvat-annotationFormats.ts`
- `src/cvat/backend/middleware/cvatRequest.ts`

Current interpretation:

- Native annotation is the preferred local workflow.
- CVAT remains valuable for exchange, import/export, and external annotation tool compatibility.
- CVAT sync should be treated as a bridge operation requiring explicit analyst control.

Security note:

- CVAT token files should not be committed or bundled into public handoffs.

## 14. Current Operational Workflow

### Basic Analysis Workflow

1. Start backend.
2. Start frontend or Electron.
3. Upload or select video in Project panel.
4. Choose analysis tier and modality focus.
5. Run analysis.
6. Backend writes artifacts.
7. Frontend polls status and loads normalized analysis data.
8. Panels render automatic detections, transcripts, prosody, expressions, metadata, matrices, and summaries.

### Native Manual Annotation Workflow

1. Open a completed analysis.
2. Open the native annotation console.
3. Choose manual annotation category.
4. Use the video panel to place the annotation at the relevant time or region.
5. Save the annotation.
6. The correction payload is persisted through the backend.
7. Relevant panels refresh through `analysisCorrectionsChanged`.
8. The annotation appears in the category leaf and Master Schema.

### Source Media Documentation Workflow

1. Open source media metadata.
2. Edit or review source metadata.
3. Add references where needed.
4. Keep source-critical data separate from interpretation-heavy annotation data.

### Bundle/Handout Workflow

1. Download analysis bundle or project bundle through backend endpoints.
2. For colleague handoff, create scoped archive that excludes secrets, caches, large ignored data, and local token files.
3. Include documentation describing what is operational, what is included, and what remains pending.

## 15. What Is Operational Now

Currently operational in first working order:

- local video upload and analysis orchestration
- automatic object detection result handling
- OCR result handling
- audio/transcript/prosody result handling
- expression result handling
- source media metadata surfaces
- time-linked panel navigation
- native manual annotation category selection
- manual annotation saving through correction payloads
- Master Schema manual annotation review
- category leaf panels for manual categories
- mixed automatic/manual display for several mature panels
- situational/person-situation taxonomy available in frontend taxonomy code
- optional face pipeline/anonymizer components exist, with anonymizer controlled by switch rather than default
- handout bundle creation has been performed previously for annotation workflow delivery

## 16. Known Bending Tasks

These are not failures; they are the current design seams that need careful next work.

- Cross-annotation propagation needs design. Example: an `Interaction` between two characters may create candidate `Identification`, `Role`, or `Action` annotations, but this must be controlled and reviewable.
- Identity uncertainty needs explicit modeling. Half-identifications, insinuated identities, hidden identities, and delayed reveals are narratively important and should not be flattened into confirmed identity.
- Some universal manual leaves are manual-only because they do not yet have dedicated automatic detector pipelines.
- Some automatic pipelines may not yet feed every semantic panel equally.
- SQLite/database persistence appears planned or partial; current operational persistence is mostly file/API/local-browser state.
- CVAT token and bridge state must remain outside public handouts and commits.
- Face anonymization must remain opt-in and visible to the analyst.
- Taxonomy documentation should be expanded into a full VAA1 annotation taxonomy document with every detected and manually annotable attribute explicitly marked.
- Export packaging should continue to distinguish source media, derived artifacts, manual corrections, and governance documents.

## 17. Recent Validation Point

Recent frontend validation:

- `cd src/frontend`
- `npx tsc --noEmit`

This type check passed during the manual annotation governance delivery.

Recent pushed commit:

- `9541bb0 Add native annotation governance workflow`

Known GitHub operational note:

- The branch `petteri` was pushed to `origin/petteri`.
- The local `gh` command was not available, so no GitHub CLI draft PR was created from the terminal at that time.

## 18. Current Source-of-Truth Documents

Important related documents:

- `docs/vaa1_annotation_operational_handoff_2026-04-19.md`
- `docs/vaa1_annotation_taxonomy_workflow_plan_2026-04-19.md`
- `docs/vaa1_situation_taxonomy_full_2026-04-19.md`
- `docs/vaa1_native_annotation_protocol_v1_2026-04-14.md`
- `docs/vaa1_cvat_access_and_annotation_protocol_2026-04-11.md`
- `docs/vaa1_cvat_annotation_exchange_protocol_2026-04-11.md`
- `docs/vaa1_timestamp_traceability_profile_2026-03-27.md`

## 19. One-Sentence System Description

VAA1 is currently a local multimodal video analysis and annotation cockpit where automatic analysis artifacts, source-media documentation, manual analyst annotations, and governance taxonomies converge into panel-based review surfaces, with Master Schema acting as the canonical manual annotation map and CVAT acting as an optional external bridge.
