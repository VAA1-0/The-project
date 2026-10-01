# Publication-ready draft material

## Short technical description

Datascene is a local, researcher-facing system for multimodal analysis of time-based media. It combines source-media metadata, speech transcription, audio timing, sampled visual detections, optical character recognition, facial-expression candidates, scene-level records, manual annotations and statistical or narrative interpretations. Its distinctive architectural concern is not merely detection: it governs how observations become interpretations and how confirmed interpretations are propagated to downstream analytical views.

The system uses a source-bound temporal model. Contemporary services normalize evidence to source-relative seconds, retain clock authority and precision, and invalidate dependent projections when timing changes (`src/backend/analysis/source_clock_authority.py`, lines 8–142). Whisper supplies segment and word timestamps; FFmpeg supplies media metadata and audio; YOLO, EasyOCR and DeepFace produce sampled visual candidates (`src/backend/analysis/pipeline_audio_text.py`, lines 106–249; `src/backend/analysis/pipeline_video_frames.py`, lines 213–453; `src/backend/analysis/expression_detector.py`, lines 129–192). These outputs are observations, not canonical analytical truth.

Canonical interpretation is governed by an append-only decision ledger. Candidate writers cannot confirm claims, and non-analyst canonical decisions are rejected. New decisions supersede rather than erase overlapping decisions, while dependency changes append invalidations (`src/backend/analysis/decision_ledger.py`, lines 89–251). Read-time projected state applies explicit precedence—decision, then manual evidence, then raw evidence—without mutating the substrate (`src/backend/analysis/projected_state.py`, lines 140–336). This separation supports correction, audit and alternative interpretations.

Mature-data proliferation is a controlled feedback mechanism. Confirmed events can refresh scene cards, meaning layers, Narrative Agent views, search and other consumers; weaker automated matches remain candidates for review (`api_server.py`, lines 13724–13932; `tests/test_live_mature_data_proliferation_bus.py`, lines 27–834). A Narrative Agent Digital Twin is represented as a multimodal reference assembled from confirmed occurrences across visual, audio, transcript, OCR, music-theme, source-media and scene/manual evidence. The current implementation includes modality weights, evidence gates, negative evidence and edit-transition guards (`src/backend/analysis/narrative_agent_digital_twin.py`, lines 16–60 and 263–433). It should presently be described as a governed candidate-matching architecture, not as a validated autonomous recognition model.

The analytical layer combines descriptive and cross-signal statistics with linguistic, scene, network and narrative readings. Native statistical guards distinguish robust standardized deviations from significance and reject specified invalid comparisons (`tests/test_native_statistical_interpretation.py`, lines 39–94). Interpretive outputs remain separate from observations and require further construct validation. Governed reporting admits claims only when evidence and citations are present and retains provenance and traceback; deterministic publication packages add checksums (`src/backend/analysis/governed_reporting.py`, lines 78–176; `src/backend/analysis/data_book_publication.py`, lines 330–390).

## Methods framing for a statistics audience

Datascene should be understood as a measurement-and-governance system with multiple error-bearing instruments. Frames, transcript spans, turns, scenes and videos are nested rather than exchangeable observations. Repeated frame detections are therefore not independent replicates. Detector confidence is model output, not a frequentist probability of truth; analyst confirmation is a governed label, not automatically a gold standard. Any inferential study must specify its sampling unit, aggregation rule, missing-data mechanism, confirmation-selection process and multiplicity control.

The current native statistical service is appropriately conservative in two respects: robust z scores are treated as descriptive deviations rather than p-values, and comparisons require compatible concurrent signal families. For publication, this should be extended with a preregistered analysis plan, held-out corpus, clustered or hierarchical uncertainty where repeated observations are used, calibration curves for candidate scores, and sensitivity analyses for detector and analyst error.

## Reproducibility statement

The repository includes platform environments, stage parameters, checkpoint recovery, provenance envelopes, immutable decisions, traceback and checksummed publication packages. The audited backend governance suite passed 135 tests and 8 subtests on 2026-09-02. Reproducibility is nevertheless incomplete because dependency manifests disagree, model-weight hashes and some decoding parameters are not uniformly frozen, legacy millisecond schemas coexist with the seconds clock, and the frontend contract suite is currently not clean. These limitations should be disclosed and resolved before an archival release.

## Limitations paragraph

This audit establishes software contracts, not detector validity. No repository evidence supports a general claim of autonomous learning, calibrated Narrative Agent recognition, operational default learned diarization, automatic contradiction resolution, or validated behavioral/narrative constructs. Historical reports also document project-mixup, hydration and transcript-clock failures. Consequently, current outputs require analyst review, source traceback and corpus-specific validation.

## Final synthesis

### Fully implemented and tested

- Analyst-authoritative append-only decision ledger, supersession and invalidation.
- Non-mutating projected state with explicit precedence.
- Source-clock authority and core transcript timing guards.
- Candidate-only proliferation governance and live consumer refresh contracts.
- Governed reporting, traceback and checksummed publication contracts.
- Checkpoint/recovery and saved-analysis hydration at backend contract level.

### Implemented but needing validation

- Whisper transcription accuracy and timing on the target corpus.
- YOLO object detection, EasyOCR and DeepFace expression evidence.
- Full frontend navigation/correction behavior; the current suite is red.
- StatsKit researcher workflow and statistical language across panels.
- End-to-end clean-machine project restoration and corpus publication.

### Partially implemented

- Operational speaker diarization and spoken-word attribution to Narrative Agents.
- Multimodal Narrative Agent Digital Twin feature extraction and calibrated matching.
- Meaning-network, SFL, Boje/antenarrative and character-path construct validation.
- Persistent source continuity across every legacy project/schema.
- Leaf-panel bidirectional navigation and local persistence across every panel pair.

### Conceptual or planned

- Datascene-trained/Qwen learning models and self-learning from use.
- Fully operational Behavioral Narratives production/validation pipeline.
- Automatic contradiction resolution.
- Gold-corpus benchmark operation with preregistered thresholds and published accuracy.
- Production multi-user/distributed deployment.

## Placement recommendation

Use the short technical description and governance lifecycle in the main method article. Put detector versions/parameters, the reproducibility matrix, complete endpoint/module inventory and test manifest in supplementary material. Put planned learning, Qwen, contradiction resolution and fully automatic deductions in future-work language only. Report historical hydration/clock/frontend issues in limitations and the reproducibility appendix, because they directly qualify evidential integrity.
