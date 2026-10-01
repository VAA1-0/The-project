# Reproducibility and evaluation matrix

| Component | Reproducible specification currently present | Missing for independent replication/validation | Human intervention | Tests | Status / confidence |
|---|---|---|---|---|---|
| Ingestion | FFmpeg probing, audio extraction and persisted metadata (`pipeline_ingestion.py`, lines 33–142) | ffmpeg build/version and codec fixtures | Select/upload source | Recovery and hydration contracts passed | IMPLEMENTED_AND_TESTED / HIGH |
| Whisper | `word_timestamps=True`, original timestamps, chunk offset stitching (`pipeline_audio_text.py`, lines 106–249) | exact model hash, decoding settings, language policy per run, WER benchmark | correct/relink transcript | timing guards passed | IMPLEMENTED_AND_TESTED / HIGH |
| YOLO | Ultralytics YOLOv8n default, interval/CPU configuration (`pipeline_video_frames.py`, lines 213–260, 390–453) | weight hash, seed/device record, sampling sensitivity, precision/recall by class | bbox/class correction | UI bbox contracts include current failures | IMPLEMENTED_NOT_ADEQUATELY_TESTED / HIGH |
| OCR | EasyOCR, confidence 0.18, IoU/center dedupe (`pipeline_video_frames.py`, lines 288–365) | language/model hashes, CER/WER, restoration E2E proof | text/ROI correction | restoration specs exist; full suite not clean | IMPLEMENTED_NOT_ADEQUATELY_TESTED / HIGH |
| DeepFace expressions | interval 0.5, DNN threshold 0.5, dominance 0.35, margin 0.10 (`expression_detector.py`, lines 129–192) | model/backend hash, face-quality benchmark, demographic and construct validity | review uncertain result | no corpus accuracy test found | IMPLEMENTED_NOT_ADEQUATELY_TESTED / HIGH |
| Diarization | adapter and explicit unavailable state (`diarization_adapter.py`, lines 21–55) | operational model, model hash, DER benchmark | speaker confirmation | contracts passed | PARTIALLY_IMPLEMENTED / HIGH |
| Global clock | authority rank, seconds normalization, precision and 0.03 s overlap (`source_clock_authority.py`, lines 8–99) | complete retirement/migration of millisecond schema | analyst can correct clock | clock/timing guards passed | IMPLEMENTED_AND_TESTED / HIGH |
| Decisions | immutable/idempotent event, analyst authority, supersession/invalidation (`decision_ledger.py`, lines 89–251) | multi-process transactional store and migration proof | mandatory for canonical interpretation | ledger/boundary tests passed | IMPLEMENTED_AND_TESTED / HIGH |
| Projection | explicit precedence and non-mutating current-state projection (`projected_state.py`, lines 140–336) | performance/concurrency benchmark over large corpora | none for read projection | projection tests passed | IMPLEMENTED_AND_TESTED / HIGH |
| Evidence matcher | indexed evidence, match/write stages; candidate-only default (`evidence_proliferation_matcher.py`, lines 428–2638) | calibration corpus, error curves, threshold selection protocol | confirms/rejects candidates | extensive contract tests passed | IMPLEMENTED_AND_TESTED / MEDIUM |
| Narrative Agent twin | modality list/weights/gates and confirmed-anchor construction (`narrative_agent_digital_twin.py`, lines 16–60, 263–433) | actual embedding/model provenance, ablation study, false-match benchmark, cross-dissolve test corpus | creates anchor and final confirmation | deterministic contracts passed | PARTIALLY_IMPLEMENTED / HIGH |
| Native statistics | robust-z and cross-signal constraints (`native_statistical_interpretation.py`, around line 182; tests lines 39–94) | preregistered inferential plan, multiple-comparison control, sampling-unit rationale | research question/method choice | backend contracts passed; frontend wording failure | IMPLEMENTED_AND_TESTED / HIGH for backend |
| Meaning/SFL/narrative | deterministic builders and artifact writers (`dependency_sfl_stage1.py`, lines 502–641; `multimodal_meaning_stage1.py`, lines 1068–1173) | codebook validity, inter-rater reliability, construct and criterion validation | interpretation/review | contract evidence is uneven | PARTIALLY_IMPLEMENTED / MEDIUM |
| Reporting | evidence-required claims, invalidation, hashes and traceback (`governed_reporting.py`, lines 78–176) | external reproduction exercise and stable schema release | approves eligible claims | reporting/traceback tests passed | IMPLEMENTED_AND_TESTED / HIGH |
| Publication | deterministic ZIP/checksums and corpus preservation (`data_book_publication.py`, lines 245–390) | external validator, schema migration and legacy vocabulary cleanup | freezes cohort/export | publication tests passed | IMPLEMENTED_AND_TESTED / HIGH |
| Runtime recovery | atomic fsync/replace, checkpoints, hydration audit (`analysis_recovery.py`, lines 15–113; `saved_analysis_hydration_loader.py`, lines 253–293) | crash/fault injection across all artifacts and catalogue isolation E2E | scoped repair/review | backend tests passed | IMPLEMENTED_AND_TESTED / HIGH |

## Environment disclosure

`requirements.txt`, lines 23–119, specifies NumPy/Pandas/SciPy, OpenCV, TensorFlow/DeepFace, PyTorch/Transformers, spaCy, Ultralytics, EasyOCR, Whisper and FastAPI. It conflicts with `environment-MacOS-core.yml`, lines 63–102: notable NumPy, OpenCV and Torch versions differ. A publication should freeze one resolved lockfile, include Python/OS/CPU/GPU, model weight hashes, FFmpeg build, random seeds, every stage parameter, and a manifest of skipped/unavailable stages.

## Minimum empirical evaluation still required

1. Freeze a stratified video corpus and immutable gold annotations with adjudication and inter-rater agreement.
2. Report transcript WER/timing error, diarization DER, object/OCR/expression precision-recall, tracking fragmentation and Narrative Agent false-link/false-split rates.
3. Evaluate cross-dissolves, occlusion, color filters, off-screen speech and rapid editing as separate stress strata.
4. Calibrate candidate thresholds only on training/development partitions; report held-out reliability and uncertainty.
5. Run an end-to-end restoration/republication exercise from a clean machine and compare artifact checksums and claim traceback.
