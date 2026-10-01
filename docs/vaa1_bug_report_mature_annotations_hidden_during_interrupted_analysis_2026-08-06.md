# Bug Report: Mature Human Annotations Hidden During Interrupted Analysis

Date: 2026-08-06

## Summary

Human annotations were present on disk but disappeared from operational panels when an analysis was interrupted or still processing. The failure affected the Datascene maturity principle: the most mature available data, especially human annotations, must surface ahead of raw or incomplete machine layers.

This was not a lost-data incident. It was a surfacing and projection bug.

## Affected Principle

The Datascene mature-data rule applies to all analyses, including interrupted analyses:

1. Manual correction and manual annotation are highest authority.
2. These data must surface even when automatic analysis branches are incomplete.
3. Panel views should consume mature evidence via the Master Schema projection where possible.
4. A processing state must not erase or hide already mature sidecar artifacts.

## Observed Failure

When a video was still `processing`, `VideoService.getAnalysis()` returned a lightweight checkpoint payload intended to keep visual scanning responsive. That branch returned empty transcript/audio/mature-evidence surfaces even when mature artifacts already existed.

Visible symptoms included:

- Transcript-panel annotations appeared to disappear.
- BBox/ROI human confirmations for OBJ/person/role did not surface in Transcript-adjacent contexts.
- Master Schema consumers did not receive `masterSchemaResolvedEvidence` during interrupted analysis.
- Associated panels could behave as if the mature human layer did not exist.

## Data Reality

The canonical sidecars existed.

For `c034341f-3fba-495e-a7d1-0af03a46cb6c`:

- `annotation_corrections.json`: present
- `text_substitutions`: 74
- `manual_transcript_entries`: 30
- `manual_visual_annotations`: 8
- `master_schema_presence_intervals`: 8

Other analyses also contained human annotations:

- `ca6d0ebf-cbb5-4f7e-8502-f8b0693daf33`: 61 text substitutions, 5 manual transcript entries, 6 manual visual annotations, 6 Master Schema presence intervals
- `e9cffc4c-275b-4dcb-b475-600b3c9ac2d7`: 1 text substitution, 1 manual visual annotation, 1 Master Schema presence interval

## Root Cause

The frontend active-analysis branch treated `status !== "completed"` as a reason to return a minimal visual checkpoint only. This bypassed mature sidecars and the Master Schema projection.

A second issue existed inside `SpeechToTextPanel`: when scaffold transcript rows were rejected and authoritative transcript rows were fetched directly, the fallback did not reapply canonical `annotation_corrections.json`. This protected timing but could hide human transcript annotations.

## Fix Applied

`src/frontend/lib/video-service.ts`

- Active/interrupted analyses now load:
  - transcript
  - audio prosody
  - audio diarization
  - audio sample clouds
  - annotation corrections
  - Master Schema artifact
  - source media metadata
  - second-order proliferation artifact
  - live maturity audit artifact
- Active/interrupted analyses now build:
  - corrected transcript
  - manual visual objects
  - manual annotations by category
  - `masterSchemaResolvedEvidence`
  - `entityRegistry`
  - `contentSearch`
- BBox/ROI manual annotations are projected into the shared mature evidence view before completion.

`src/frontend/app/V2components/components/panels/SpeechToTextPanel.tsx`

- Authoritative transcript fallback now fetches/applies canonical annotation corrections.
- Transcript panel now surfaces BBox/ROI human confirmations for `Identification`, `Role`, and `OBJ`.

## Required Future Guard

Add a corpus-wide regression test asserting that for every analysis state (`completed`, `processing`, `interrupted`):

- `annotation_corrections.json` is loaded when present.
- manual transcript entries appear in `analysisData.transcript`.
- manual visual annotations appear in `analysisData.manualAnnotationsByCategory`.
- manual visual annotations are present in `analysisData.masterSchemaResolvedEvidence.records`.
- associated panels consume the same mature projection rather than rebuilding independent truth.

## Non-Negotiable Acceptance

If human annotations exist on disk, they must surface.

No panel may treat `processing`, `interrupted`, or partial automatic analysis as permission to hide human evidence.
