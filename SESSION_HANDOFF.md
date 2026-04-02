# VAA1 face-analysis handoff

## Date
- 2026-03-17

## Working environments
- `vaa1_core`
- `vaa1_face`

## Stable execution style
Use:
- `conda run -n vaa1_core python -m ...`
- `conda run -n vaa1_face python ...`

Avoid relying on interactive Conda activation when shell lag appears.

## Core working files
- `app/face_worker.py`
- `app/pipeline/face_bridge.py`
- `app/pipeline/face_analysis.py`
- `app/pipeline/face_anonymizer.py`
- `src/backend/analysis/pipeline_video_frames.py`
- `api_server.py`
- `app/main.py`

## Test runner files
- `app/test_face_bridge.py`
- `app/test_face_analysis.py`
- `app/test_face_batch.py`
- `app/test_face_video_pipeline.py`

## Verified status
- face worker works in `vaa1_face`
- bridge works from `vaa1_core` to `vaa1_face`
- single-image face analysis works
- CSV export works
- timestamps are operational:
  - `source_timestamp`
  - `analysis_timestamp`
- batch face analysis over frame images works
- video pipeline now samples one frame per second and runs batch face analysis
- optional downstream face anonymizer exists and is opt-in
- face messaging now supports:
  - technical warning fields
  - constructive plain messages
  - optional `starfleet` style messages

## Verified commands
- `conda run -n vaa1_core python -m app.test_face_analysis`
- `conda run -n vaa1_core python -m app.test_face_batch`
- `conda run -n vaa1_core python -m app.test_face_video_pipeline`
- `conda run -n vaa1_core python -m app.test_face_bridge`

## Current face-analysis return shape
Top-level fields include:
- `success`
- `error`
- `error_code`
- `warnings`
- `user_message`
- `style_message`
- `style_mode`
- `image_path`
- `source_timestamp`
- `analysis_timestamp`
- `csv_path`
- `faces`

Per-face fields include:
- `face_index`
- `image_path`
- `source_timestamp`
- `analysis_timestamp`
- `age`
- `dominant_gender`
- `dominant_emotion`
- `dominant_race`
- `face_confidence`
- `region`
- `gender_scores`
- `emotion_scores`
- `race_scores`
- `warnings`
- `confidence_note`

## Message style options
- `plain`
- `starfleet`

Important:
- technical truth stays in machine-readable fields
- flavored language stays in `style_message`

## Front-end controlled options
These should remain explicit switches, not silent defaults:

- `apply_face_anonymization`
  - default: `false`
  - purpose: anonymizes sampled face-frame images downstream

- `face_message_style`
  - default: `plain`
  - options: `plain`, `starfleet`
  - purpose: changes tone only, not technical payloads

- `face_requires_person_detection`
  - default: `false`
  - purpose: only sends sampled frames into face analysis when YOLO detects a `person`
  - note: this is an optimization gate, not the anonymization target itself

## Important current behavior notes
- early video frames can produce low-confidence or fallback-style face regions during profile movement
- these low-confidence results are intentionally retained as data
- `face_confidence` should be interpreted as a quality signal, not a hard discard rule
- anonymization currently applies to sampled face-frame images, not yet to the final rendered video output
- when `face_requires_person_detection` is enabled, frames without YOLO `person` detections are skipped before face analysis

## Bundle and readme created today
- `vaa1_face_pipeline_colleague_bundle.tar.gz`
- `README_vaa1_face_pipeline_colleague_bundle.md`

Location:
- project root: `/Users/admin/Desktop/VAA1/VAA1 on Python 1.0/The-project`

## Recommended next steps
- expose `apply_face_anonymization`, `face_message_style`, and `face_requires_person_detection` in the front end UI
- add assertion-based automated tests for:
  - batch face analysis
  - video face pipeline
  - anonymizer path
- decide whether anonymization should remain on sampled face frames only or extend to final video outputs
- add download surfacing for anonymized outputs where relevant

## UI implementation check list
- add a visible switch for `apply_face_anonymization`
- add a visible selector for `face_message_style`
- add a visible switch for `face_requires_person_detection`
- keep all three controls explicit and opt-in where appropriate
- reflect the active values in UI status or result views so users can confirm what was submitted

## UI verification check list
- confirm the three face controls render in the analysis tools panel
- confirm defaults are `false`, `plain`, and `false`
- start analysis with defaults and confirm the backend accepts the request
- start analysis with anonymization enabled and confirm the backend records `apply_face_anonymization: true`
- start analysis with message style set to `starfleet` and confirm the backend records that mode
- start analysis with `face_requires_person_detection` enabled and confirm summary counts include skipped frames where applicable
- confirm no frontend regression in the standard analyze flow when all three controls remain at defaults

## Safe restart point
If resuming later, start with:
1. read this file
2. read `README_vaa1_face_pipeline_colleague_bundle.md`
3. run `git status --short`
4. run one quick smoke test:
   - `conda run -n vaa1_core python -m app.test_face_analysis`

## Practical status summary
- functionally working and manually verified
- packaged for colleague handoff
- not yet fully hardened as a final production workflow
