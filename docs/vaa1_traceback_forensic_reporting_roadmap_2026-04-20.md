# VAA1 Traceback, Forensic Rendering, and Reporting Roadmap

Date: 2026-04-20  
Purpose: define the next major tool and workflow spine after native annotation governance.

This roadmap captures the next strategic layer of VAA1. The broad strokes are now in place; details can be tuned as implementation proceeds. The guiding principle is simple:

> VAA1 should not only detect and describe. It should let the analyst trace every meaningful claim back to evidence, deepen selected moments with stronger rendering, and produce reports that explain because of what, involving whom, at what time, and with what confidence.

## 1. Strategic Order

Recommended build order:

1. Evidence provenance and traceback spine.
2. Quick Sweep to Forensic Deepening workflow.
3. Forensic rendering job model.
4. Report claim weighting and traceability.
5. Major workflow design.
6. Final UI layout system.
7. Multimodal report package.

The reason for this order is that traceback/provenance should become the common spine. Forensic rendering and reporting both need it.

## 2. Traceback Tool

### Purpose

The traceback tool should allow an analyst to move from any visible claim, detection, annotation, report sentence, or panel item back toward the original raw indication.

It should answer:

- What is this claim based on?
- Which raw detection, annotation, transcript segment, audio cue, or metadata field supports it?
- Where in the source media does the evidence occur?
- Which pipeline or analyst produced it?
- Is the evidence raw, inferred, manual, reviewed, uncertain, or contested?

### Current Sprint Activation Requirement

The traceback tool is now the first implementation priority for the active sprint.

Minimum alive visualization:

- A visible traceback affordance on every mature or candidate BBox/ROI label, Narrative
  Agent row, Scene Browser row, and Meaning / Plot candidate that has source refs.
- A Traceback panel/drawer that renders a node list or compact tree:
  - mature claim / Narrative Agent label
  - authority level
  - source type
  - timestamps and source-jump buttons
  - bbox/frame refs where available
  - raw detector substrate as provenance
  - manual correction / annotation nodes as highest authority
- One-click navigation from any traceback node back to video time and relevant panel.
- Stable selectors for a DOM/Playwright fixture.

Acceptance criterion:

```text
The analyst can click a mature Narrative Agent BBox/ROI label and see why it exists,
what evidence supports it, what raw detector substrate it came from, and where to jump
in the source media.
```

This must be delivered before expanding the Narrative Agent registry further.

### Candidate Evidence Identity Fields

Every important evidence-bearing item should eventually have:

- `evidence_id`
- `analysis_id`
- `source_media_id`
- `modality`
- `source_type`
- `detector_or_source`
- `timestamp_start`
- `timestamp_end`
- `frame_index`
- `frame_start`
- `frame_end`
- `spatial_region`
- `raw_artifact_path`
- `derived_artifact_path`
- `confidence`
- `review_state`
- `epistemic_status`
- `parent_evidence_ids`
- `child_evidence_ids`
- `created_at`
- `updated_at`

### Evidence Source Types

Initial source types:

- `raw_detection`
- `algorithmic_inference`
- `manual_observation`
- `manual_interpretation`
- `metadata`
- `source_reference`
- `transcript`
- `prosody`
- `ocr`
- `object_detection`
- `expression`
- `face`
- `forensic_render`
- `report_claim`

### Review and Epistemic Status

Important states:

- `candidate`
- `unreviewed`
- `confirmed`
- `uncertain`
- `contested`
- `rejected`
- `superseded`

Narrative work needs these states because a half-identification, insinuated identity, or delayed reveal is not the same truth type as a raw detection.

## 3. Quick Sweep to Forensic Deepening

### Purpose

The user should be able to run a lighter `quick_sweep` first, identify moments of likely interest, and then selectively re-render or re-analyze only those snippets at stronger settings.

This makes VAA1 more useful for users who do not want or need a full forensic run across an entire video.

### Workflow

1. User runs `quick_sweep`.
2. VAA1 produces a lightweight map of likely hotspots.
3. Hotspots are ranked using weighted evidence.
4. User selects a time span, region, object, face, transcript line, or annotation.
5. User requests `science_grade` or `forensic_accuracy`.
6. VAA1 creates a forensic render job.
7. Rendered outputs become traceable evidence.
8. Reports use both the quick-sweep context and the deeper snippet evidence.

### Hotspot Ranking Inputs

The first ranking model should weight:

- metadata
- manual annotations
- prosody
- transcription
- OCR
- object/person presence
- expression samples
- scene/movement/cinematic cues
- analyst notes

## 4. Forensic Rendering Tool

### Purpose

The forensic rendering tool should let the analyst select a snippet of time and optionally a spatial location, then render or re-analyze it at a stronger accuracy setting.

Modes:

- `science_grade`
- `forensic_accuracy`

### Selection Types

The tool should eventually support:

- time-only selection
- time plus static bounding box
- time plus moving tracked box
- time plus object/person/annotation reference
- time plus full-frame scene

### Existing Evidence Adoption

The Forensic tool should adopt existing analysis data from the selected time and region.

It should not treat a forensic snippet as a new blank clip. If VAA1 already knows that a person track is linked to a likely character identity, or that an interaction exists between two known or suspected persons, the forensic layer should preserve and display that richer knowledge.

Forensic enrichment should respect:

- metadata
- manual annotations
- identification
- interaction
- role
- expression evidence
- object/person tracks
- OCR
- transcript
- prosody
- source references

Example:

- weak layer: `person`
- enriched layer: `likely Lyutsifer Safin`
- epistemic status: `uncertain` or `likely`
- support: manual identification, interaction annotation, source metadata, face/expression/person-track evidence

This preserves the difference between raw detection and interpreted identity.

### Job Ledger

Each forensic render should create a governed job record:

- `render_job_id`
- `analysis_id`
- `source_media_id`
- `requested_by`
- `requested_at`
- `reason`
- `mode`
- `fps`
- `time_start`
- `time_end`
- `frame_start`
- `frame_end`
- `region_type`
- `region`
- `tracking_source`
- `input_evidence_ids`
- `adopted_context`
- `output_evidence_ids`
- `output_video_path`
- `output_frame_dir`
- `output_json_path`
- `output_csv_path`
- `pipeline_versions`
- `status`
- `error`

The forensic render must not become a mysterious "enhanced" clip. It should be a documented derivative artifact.

## 5. Report Claim Traceability and Weighting

### Purpose

The multimodal report package should not produce broad interpretive claims without showing what supports them.

Every report claim should answer:

- because of what evidence?
- involving whom?
- at what time?
- with what confidence?
- from which modality or source?
- reviewed by whom, if reviewed?

### Evidence Weighting Priorities

Not all evidence streams are equally useful for fast narrative interpretation. The first report weighting model should prioritize:

1. Metadata
2. Manual annotations
3. Prosody
4. Transcription
5. OCR and visible text
6. Object/person/face/expression detections
7. General scene intensity inference

### Why This Weighting Matters

Metadata, manual annotations, prosody, and transcription often yield faster narrative ingredients than broad intensity estimates.

VAA1 should avoid claims like:

> The scene has high intensity.

Unless it can explain:

> The scene is marked as high intensity because the transcript contains confrontation-oriented speech, prosody indicates raised voice or emphasis, manual annotations identify an interaction between named or suspected characters, and source metadata places the moment in a crisis or turning-point context.

### Report Claim Fields

Candidate report claim structure:

- `claim_id`
- `report_id`
- `claim_type`
- `claim_text`
- `time_start`
- `time_end`
- `involved_entities`
- `primary_evidence_ids`
- `supporting_evidence_ids`
- `contradicting_evidence_ids`
- `weighting_profile`
- `confidence`
- `epistemic_status`
- `generated_by`
- `review_state`
- `reviewed_by`
- `created_at`

### Claim Types

Initial claim types:

- `source_context`
- `descriptive_summary`
- `narrative_summary`
- `interaction_claim`
- `identity_claim`
- `role_claim`
- `scene_claim`
- `intensity_claim`
- `affect_claim`
- `speech_claim`
- `prosody_claim`
- `visual_presence_claim`
- `forensic_observation`
- `uncertainty_note`

## 6. Major Workflow Design

The workflow should be designed before freezing the final UI layout.

Proposed workflow phases:

- `ingest`
- `quick_sweep`
- `automatic_analysis`
- `source_metadata_review`
- `manual_annotation`
- `traceback_review`
- `forensic_deepening`
- `interpretive_synthesis`
- `report_generation`
- `human_review`
- `export_handoff`

Each phase should define:

- required inputs
- optional inputs
- main panels
- outputs
- quality gates
- handoff artifacts

## 7. Final UI Layout System

The final UI layout should express the workflow, not merely arrange panels.

Recommended layout principles:

- Left side: project/source/session control.
- Center: media, timeline, and active annotation work.
- Right side: evidence panels, Master Schema, tracebacks, and report support.
- Bottom or secondary surface: logs, job state, export state, and quality gates.
- Mode presets: Quick Sweep, Annotation, Traceback, Forensic Deepening, Reporting.

The current GoldenLayout system is a good foundation, but final layout freeze should wait until the workflow phases are designed.

## 8. Multimodal Analysis Package

The report package should turn multimodal evidence into structured outputs, not just prose.

Expected report sections:

- source media profile
- analysis configuration
- executive summary
- timeline of key moments
- detected people/objects/text/audio cues
- manual annotation summary
- interaction and identification notes
- prosody and transcription highlights
- forensic render summaries
- claim evidence table
- uncertainty and contested points
- export manifest

Every report should include an evidence table that links claims to source timestamps and artifacts.

## 9. Quality Gates

Future release gates should include:

- no report claim without evidence references unless explicitly marked unsupported interpretation
- no forensic render without a job ledger
- no manual annotation without category and timestamp
- no Master Schema annotation hidden only in a leaf panel
- no export bundle with local secrets or token files
- no face anonymization unless explicitly switched on
- no identity claim without epistemic status
- no intensity claim without answering "because of what and who?"

## 10. First Buildable Slice

Recommended first implementation slice:

1. Define an evidence envelope type.
2. Create a traceback panel or traceback drawer.
3. Add evidence IDs to manual annotation-derived entries first.
4. Link object/OCR/expression/audio/transcript rows to evidence envelopes where possible.
5. Add a "Trace" action to at least Master Schema, Objects, OCR, Expressions, Audio, and Transcript panels.

Recommended forensic preparation slice:

1. Add an adopted-context builder for forensic render windows.
2. Collect manual annotations overlapping the render time window.
3. Collect metadata context from source media metadata.
4. Collect expression samples overlapping the render time window.
5. Resolve object/person tracks into enriched labels when identification or interaction evidence exists.
6. Preserve raw detector labels alongside enriched labels and epistemic status.

Why this slice:

- It builds the spine needed for forensic rendering and reporting.
- It does not require solving the entire report system immediately.
- It strengthens the platform's scholarly and forensic credibility.

## 11. Open Design Questions

- Should evidence IDs be generated backend-side, frontend-side, or both with reconciliation?
- Should traceback be a panel, modal, drawer, or right-stack leaf?
- Should forensic render jobs live in `outputs/api_results/{analysis_id}` or a separate `outputs/forensic_jobs` root?
- Should Quick Sweep hotspot ranking be deterministic first, model-assisted later, or both?
- How should uncertain identity be represented when narrative insinuation is analytically important but not confirmed?
- Should report claim weighting be editable by the analyst?

## 12. Working Decision

The next strategic spine is:

> Build traceback first, because forensic rendering and report generation both need an evidence provenance system underneath them.
