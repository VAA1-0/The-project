# VAA1 Functionality and Delivery Audit

Date: 2026-04-30  
Branch context: `petteri`  
Purpose: audit what VAA1 currently delivers, where each function is implemented, which UI surfaces expose it, which artifacts are produced, and which documentation items need to stay current.

## 1. Current System Shape

VAA1 is currently delivered as a local multimodal video analysis and annotation workstation.

The delivery stack is:

- FastAPI backend in `api_server.py`
- analysis modules in `src/backend/analysis/`
- Next.js frontend in `src/frontend/`
- GoldenLayout analyst cockpit in `src/frontend/app/V2components/components/LayoutHost.tsx`
- panel communication through `src/frontend/lib/golden-layout-lib/eventBus.ts`
- backend API client in `src/frontend/lib/api-service.ts`
- frontend analysis normalization in `src/frontend/lib/video-service.ts`
- local artifacts under `outputs/`, `uploads/`, and `static/`
- optional CVAT bridge under `src/cvat/backend/`

The current operating model is file/API/local-browser-state based. SQLite/database persistence should still be treated as planned or partial unless verified for a specific workflow.

## 2. Delivery Status Summary

| Area | Delivery status | Primary UI | Backend/API | Artifacts |
| --- | --- | --- | --- | --- |
| Upload and analysis | Operational | Project panel | `/api/upload`, `/api/analyze/{analysis_id}`, `/api/status/{analysis_id}` | analysis records, source media, output files |
| Video playback and cue navigation | Operational | Video panel | status/download APIs | source video, annotated video, linked evidence |
| Object detection | Operational | Video, Objects, Time Bank | analysis pipeline, download API | `tracked_objects_csv`, `tracked_objects_json`, `time_bank_objects` |
| OCR | Operational | OCR, Video, Time Bank | analysis pipeline, download API | `ocr_csv`, `time_bank_ocr` |
| Transcript | Operational | Transcript, Video, Time Bank | audio pipeline, download API | `transcript`, `linked_transcript` |
| Audio prosody | Operational | Audio, Video lane, Time Bank | audio pipeline, download API | `audio_prosody`, `time_bank_audio` |
| Audio sample clouds | First working artifact | Audio/Downloads, identity support | status/download APIs | `audio_sample_clouds` |
| Speaker/identity triangulation | First working artifact | Downloads, future identity UI | `/api/analysis/{id}/refine-identities`, identity candidate endpoints | `identity_triangulation` |
| Expressions | Operational baseline | Expressions, Video, Time Bank | expression pipeline, download API | `expression_json`, `time_bank_expressions` |
| Source media metadata | Operational | Source Media, Tools, status summary | `/api/source-media/{analysis_id}` | `source_media_metadata_json`, CSV |
| Native manual annotation | Operational root workflow | Video, Master Schema, leaf panels | `/api/annotation-corrections/{analysis_id}` | `annotation_corrections` |
| Master Schema | Operational manual authority surface | Master Schema and leaf panels | correction/status APIs | manual annotation state |
| Evidence authority/navigation | First working architecture | Video, Objects, Master Schema | frontend resolver layer | authoritative resolved evidence objects |
| BBox/ROI correction | Primal operational version | Video BBox/ROI editor | annotation corrections | geometry and geometry keyframes |
| Time Bank | Operational, expanded | Time Bank | download/status APIs | transcript/audio/object/OCR/expression/meaning envelopes |
| SFL + Dependency Stage 1 | Backend artifact delivered | Downloads/future panels | status backfill and completion pipeline | `dependency_sfl_stage1` |
| Multimodal meaning Stage 1 | Backend artifact delivered | Meaning/Plot, Time Bank Meaning | status backfill and completion pipeline | `multimodal_meaning_stage1` |
| Second-order label proliferation | Backend + read-only UI delivered | BBox/ROI chips, Objects, Master Schema, Time Bank, Meaning/Plot | status backfill and completion pipeline | `second_order_label_proliferation` |
| Meaning / Plot view | First navigable UI delivered | Meaning / Plot panel | status API via `video-service` | second-order label plan |
| Forensic render | Backend and Tools workflow foundation | Tools, Downloads, future Traceback UI | `/api/forensic-render/...` | render jobs, clips, frames, traceback |
| Traceback | Backend tree support for forensic jobs | future visual tree/network panel | forensic traceback endpoint | traceback record and tree JSON |
| Quant/POS analysis | Operational analysis panels | POS, Quant, matrix panels | POS/Quant refresh and matrix APIs | POS, Quant, matrix snapshots |
| Shared taxonomy | Operational local store | Tools/Master Schema taxonomy surfaces | `/api/taxonomy/shared` | `outputs/taxonomy/shared_taxonomy.json` |
| CVAT bridge | Optional bridge, not source of truth | CVAT plugin, Tools | CVAT sync/link APIs | external CVAT exchange |
| Downloads/bundles | Operational | Downloads panel | download and bundle APIs | per-file downloads, analysis/project bundles |

## 3. Backend API Surface

The current FastAPI surface is grouped as follows.

### Upload, Analysis, and Status

- `POST /api/upload`
- `POST /api/analyze/{analysis_id}`
- `GET /api/status/{analysis_id}`
- `GET /api/analyses`
- `DELETE /api/analysis/{analysis_id}`
- `POST /api/session/clear`
- `GET /api/health`

### Downloads and Bundles

- `GET /api/download/{analysis_id}/{file_type}`
- `GET /api/download-bundle/{analysis_id}`
- `POST /api/download-project-bundle`
- `POST /api/import-bundle`

Current expected downloadable artifact types include:

- `video`
- `source_video`
- `yolo_csv`
- `tracked_objects_csv`
- `tracked_objects_json`
- `ocr_csv`
- `summary_json`
- `audio`
- `transcript`
- `linked_transcript`
- `audio_prosody`
- `audio_diarization`
- `audio_sample_clouds`
- `identity_triangulation`
- `dependency_sfl_stage1`
- `multimodal_meaning_stage1`
- `second_order_label_proliferation`
- `time_bank_audio`
- `time_bank_ocr`
- `time_bank_objects`
- `time_bank_expressions`
- `pos_analysis`
- `quan_analysis`
- `expression_json`
- `annotation_corrections`
- `source_media_metadata_json`
- `source_media_metadata_csv`
- `face_anonymization_manifest`
- `pos_matrix`
- `quant_matrix`

### Source Media and Metadata

- `GET /api/source-media/{analysis_id}`
- `POST /api/source-media/{analysis_id}`
- `POST /api/source-media/{analysis_id}/references`
- `GET /api/source-media/{analysis_id}/references/{stored_filename}`

### Manual Corrections and Native Annotations

- `GET /api/annotation-corrections/{analysis_id}`
- `POST /api/annotation-corrections/{analysis_id}`

Manual correction remains the authority layer over automated detections.

### Identity, Audio Sample Clouds, and Triangulation

- `POST /api/analysis/{analysis_id}/refine-identities`
- `GET /api/analysis/{analysis_id}/identity-candidates`
- `POST /api/analysis/{analysis_id}/identity-candidates/{candidate_id}/promote`

The current delivered artifacts support identity triangulation from metadata, visual/manual annotation, audio sample cloud scaffolds, and linked evidence. This is a governed first working layer, not a final identity engine.

### Forensic Render and Traceback

- `GET /api/forensic-render/{analysis_id}/jobs`
- `GET /api/forensic-render/{analysis_id}/jobs/{render_job_id}`
- `GET /api/forensic-render/{analysis_id}/jobs/{render_job_id}/traceback`
- `POST /api/forensic-render/{analysis_id}/jobs`
- `GET /api/forensic-render/{analysis_id}/jobs/{render_job_id}/download`

Forensic render jobs create governed derivative evidence. They preserve adopted context and expose traceback records/trees.

### Source Samples

- `GET /api/source-samples/{analysis_id}`
- `POST /api/source-samples/{analysis_id}`
- source sample asset download route

Source samples support the path toward reference audio/visual sample arrays.

### Taxonomy and Language Support

- `GET /api/morphology/catalog`
- `GET /api/taxonomy/shared`
- `POST /api/taxonomy/shared/labels`

### Matrix and Language Analysis

- `POST /api/matrices/quant/{analysis_id}`
- `POST /api/matrices/pos/{analysis_id}`
- `POST /api/pos-analysis/{analysis_id}/refresh`

### CVAT Bridge

- `POST /api/status/{analysis_id}/cvat-link`
- `POST /api/annotations/{analysis_id}/sync-cvat`

CVAT is a bridge and exchange layer. It is not the native annotation source of truth.

## 4. Frontend Workspace and Panels

The analyst cockpit is a GoldenLayout workspace.

Core files:

- `src/frontend/app/V2components/components/LayoutHost.tsx`
- `src/frontend/app/V2components/components/MenuBar.tsx`
- `src/frontend/lib/video-navigation.ts`
- `src/frontend/lib/evidence-authority.ts`
- `src/frontend/lib/video-service.ts`
- `src/frontend/lib/api-service.ts`

Current main panels:

- `ProjectPanel.tsx`
- `DownloadPanel.tsx`
- `VideoPanel.tsx`
- `ToolsPanel.tsx`
- `OBJDetectionPanel.tsx`
- `OCRPanel.tsx`
- `ExpressionPanel.tsx`
- `MasterSchemaPanel.tsx`
- `SourceMediaMetadataPanel.tsx`
- `TimeBankPanel.tsx`
- `MeaningPlotPanel.tsx`
- `SpeechToTextPanel.tsx`
- `AudioPanel.tsx`
- `POSAnalyzePanel.tsx`
- `QuantitativeAnalysisPanel.tsx`
- `POSMatrixPanel.tsx`
- `QuantMatrixPanel.tsx`
- `CvatPluginPanel.tsx`

Manual leaf panels currently route through category-filtered Master Schema panels:

- Action
- Audio
- Cinematic Cues
- Expressions
- Genre
- Identification
- Interaction
- Metadata
- Movement
- Notes
- OBJ
- OCR
- Role
- Scene
- Transcription

## 5. Evidence Authority and BBox/ROI State

Current governing rule:

manual correction > manual annotation > grouped detection > raw detection

Implemented delivery points:

- `src/frontend/lib/evidence-authority.ts` defines resolved evidence and authority order.
- `src/frontend/lib/video-navigation.ts` centralizes navigation from panels to video.
- `VideoPanel.tsx` keeps selected overlays visible inside active edit workspaces.
- Manual geometry supports timestamped `geometry_keyframes`.
- BBox/ROI editing has a primal operational version for interval drawing and timestamp-scoped geometry.
- Time/geometry corrections are persisted through annotation corrections.

Known status:

- The tool is usable but still primitive.
- Timestamp/coordinate regime must remain non-negotiable.
- Any future refinement must preserve per-timestamp geometry and manual-correction authority.

## 6. SFL, Meaning-Making, and Proliferation Delivery

Current delivered backend modules:

- `src/backend/analysis/dependency_sfl_stage1.py`
- `src/backend/analysis/multimodal_meaning_stage1.py`
- `src/backend/analysis/second_order_label_proliferation.py`

Current generated artifacts:

- `dependency_sfl_stage1.json`
- `multimodal_meaning_stage1.json`
- `second_order_label_proliferation.json`

Pipeline delivery:

- generated during completed analysis where transcript evidence exists
- backfilled during status refresh for older completed analyses when transcript artifacts already exist
- exposed through status response and download/bundle APIs

UI delivery:

- `SecondOrderLabelAffirmations.tsx` surfaces governed read-only suggestions in BBox/ROI, Objects, and Master Schema contexts.
- `TimeBankPanel.tsx` includes a Meaning column built from second-order label instructions.
- `MeaningPlotPanel.tsx` provides navigable plot and character path views.

Current plot lens support:

- Aristotle
- Freytag
- Campbell
- Frye
- Booker

Governance:

- second-order labels are candidates or affirmations, not automatic manual corrections
- open weights must remain visible
- source evidence must remain navigable
- manual correction overrides all automated meaning suggestions

## 7. Time Bank Delivery

Time Bank currently supports comparable, side-by-side evidence sections:

- Transcript
- Audio
- Meaning
- OCR
- Objects
- Expressions

Current behavior:

- loads linked transcript and time-bank artifacts through download APIs
- builds meaning events from `second_order_label_proliferation.instructions`
- keeps rows navigable back to source timestamps
- preserves source evidence refs for meaning events

## 8. Forensic Render and Traceback Delivery

Current forensic render support:

- create forensic render jobs
- select time window
- choose `science_grade` or `forensic_accuracy`
- preserve adopted context
- produce governed derivative render artifacts
- expose download URL
- expose traceback record and optional traceback tree

Current traceback support:

- backend JSON record/tree exists for forensic jobs
- UI visualization as tree/network remains a pending visualization task

Design requirement:

- forensic outputs must remain linked to source evidence, manual annotations, detections, transcript, prosody, OCR, expressions, metadata, and report claims.

## 9. Audio and Identity Delivery

Current audio support:

- extracted audio artifact
- transcript
- linked transcript
- prosody cues
- diarization scaffold
- audio sample clouds

Current identity support:

- identity candidate ledger
- identity refinement endpoint
- candidate promotion endpoint
- identity triangulation bundle

Current boundary:

- this is a governed scaffold for sample arrays and triangulation
- it is not yet a final automated character-recognition or speaker-identification system

## 10. Documentation Currency Audit

Documents that are now current or close to current:

- `docs/vaa1_functionality_delivery_audit_2026-04-30.md`
- `docs/vaa1_sfl_dependency_indicative_layer_development_note_2026-04-29.md`
- `docs/working_handover_handout_2026-04-27_SFL_meaning_proliferation.md`
- `docs/vaa1_llm_agent_learning_model_detection_governance_2026-04-25.md`
- `EVIDENCE_NAVIGATION_AUTHORITY_MODEL_FAILURE_REPORT.doc`
- `BBOX_ROIbox_BUG_FIX_REPORT.doc`

Documents that remain useful but are stale as complete maps:

- `docs/vaa1_program_map_current_2026-04-19.md`
- `docs/vaa1_forensic_tool_sprint_2026-04-20.md`
- `README.md`
- `USER_GUIDE.md`
- older handoff notes before 2026-04-27

Documentation gaps to close:

1. Add a concise current README section for the actual local backend/frontend startup.
2. Update the user guide with Meaning/Plot, Time Bank Meaning, forensic render, traceback, source samples, identity triangulation, and audio sample clouds.
3. Write a dedicated Evidence Authority and Navigation Contract doc from the implementation codes in `BBOX_ROIbox_BUG_FIX_REPORT.doc`.
4. Write a Traceback Visualization design note for tree/network UI.
5. Write a Report Writing Surface note that distinguishes source evidence, second-order interpretation, third-order claim, confidence, uncertainty, and traceback.
6. Update forensic render documentation to mark traceback endpoint/tree support as delivered backend capability.
7. Update SFL/meaning handout to mark backend pipeline wiring and backfill as delivered.

## 11. Recommended Documentation Source of Truth

Going forward, maintain these as the active documentation spine:

1. `README.md` for installation/startup and high-level orientation.
2. `docs/vaa1_functionality_delivery_audit_2026-04-30.md` for current delivered capabilities.
3. `EVIDENCE_NAVIGATION_AUTHORITY_MODEL_FAILURE_REPORT.doc` for evidence authority doctrine.
4. `docs/vaa1_sfl_dependency_indicative_layer_development_note_2026-04-29.md` for SFL/Dependency and second-order meaning governance.
5. `docs/vaa1_llm_agent_learning_model_detection_governance_2026-04-25.md` for AI/agent/model governance.
6. `docs/vaa1_traceback_forensic_reporting_roadmap_2026-04-20.md` for traceback/forensic/reporting roadmap, pending update.

## 12. Immediate Audit Conclusion

VAA1 documentation has the right conceptual pieces, but the “current delivered state” was split across sprint reports and handoffs.

The actual current delivery is stronger than the older program map states:

- second-order meaning artifacts are now wired into backend completion/status refresh
- Meaning/Plot and Time Bank Meaning now exist as UI surfaces
- audio sample clouds and identity triangulation are first working artifacts
- forensic render has traceback endpoint support
- evidence authority and navigation have a first working frontend contract

The main documentation risk is not lack of documentation. It is fragmentation across many dated notes. The next documentation pass should consolidate user-facing operation into README/USER_GUIDE and keep this audit as the technical delivery map.
