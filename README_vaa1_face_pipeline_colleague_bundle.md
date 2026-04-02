# VAA1 Face Pipeline Colleague Bundle

## What this bundle delivers

This bundle packages the current working VAA1 face-analysis stage as of 2026-03-17.

It delivers:
- a working bridge from `vaa1_core` to `vaa1_face`
- single-image face analysis
- normalized JSON face results
- CSV export with timestamps
- batch face analysis over frame images
- video integration that samples one frame per second and runs batch face analysis
- optional downstream face anonymization for sampled face-frame images
- structured warning and messaging layers:
  - technical fields
  - constructive human-facing messages
  - optional Starfleet-flavored style messages

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

## Operational model

Two Conda environments are used:
- `vaa1_core`
- `vaa1_face`

Recommended execution style:
- `conda run -n vaa1_core python -m ...`
- `conda run -n vaa1_face python ...`

Avoid relying on interactive activation when shell behavior is sluggish.

## What the pipeline returns

Face analysis returns:
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

Per-face normalized results include:
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

The face pipeline supports:
- `plain`
- `starfleet`

Important:
- technical accuracy remains in the machine-readable fields
- flavored wording appears only in the style-facing message layer

## Front-end switches

These options should be controlled from the front end and not forced by default:

- `apply_face_anonymization`
  - default: `false`
  - purpose: enables downstream anonymization of sampled face-frame images

- `face_message_style`
  - default: `plain`
  - options: `plain`, `starfleet`
  - purpose: chooses human-facing message tone without changing technical payloads

- `face_requires_person_detection`
  - default: `false`
  - purpose: only sends sampled frames into face analysis when YOLO detects a `person`
  - note: this is a performance/privacy gate for face processing, not a replacement for face-region detection

## Example commands

Still image:

```bash
conda run -n vaa1_core python -m app.test_face_analysis
```

Batch over frame images:

```bash
conda run -n vaa1_core python -m app.test_face_batch
```

Video to sampled frame face analysis:

```bash
conda run -n vaa1_core python -m app.test_face_video_pipeline
```

## What is operationalized today

Operational:
- face worker subprocess bridge
- single-image face analysis
- timestamped CSV export
- batch face analysis
- video sampling into frame-image batch analysis
- optional sampled-frame anonymization
- technical plus constructive messaging

Not yet fully operationalized:
- full-video anonymization rewrite on the final output video
- assertion-based automated test suite
- front-end UI controls for anonymization, message style, and YOLO person gating
- formal download surfacing for anonymized frame outputs in all UI routes

## Pending tasks

- add assertion-based automated tests for batch, video, and anonymizer paths
- expose `face_message_style`, `apply_face_anonymization`, and `face_requires_person_detection` in the front end UI
- decide whether anonymization should remain on sampled face frames only or be extended to the final rendered video
- add download links or asset surfacing for anonymized outputs in all user-facing flows
- consider a formal warning taxonomy document for the face pipeline
- optionally add a second video test runner with anonymization enabled
- tighten docs around environment creation and reproducible setup

## UI verification check list

- confirm `apply_face_anonymization`, `face_message_style`, and `face_requires_person_detection` are visible in the tools panel
- confirm defaults are `false`, `plain`, and `false`
- run one analyze request with all defaults and confirm standard behavior still works
- run one analyze request with anonymization enabled and confirm anonymization is recorded in backend status
- run one analyze request with `face_message_style=starfleet` and confirm the style mode is recorded
- run one analyze request with `face_requires_person_detection=true` and confirm face sampling counts show considered, selected, and skipped-without-person frames

## Bundle contents

This archive is intended to contain the files listed above plus the key environment files:
- `environment-MacOS-core.yml`
- `environment-MacOS-face.yml`
- `vaa1_core.lock.yml`
- `vaa1_face.lock.yml`
- `SESSION_HANDOFF.md`
- this readme
