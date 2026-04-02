# VAA1 Face Pipeline Stage

## Included files
- app/pipeline/face_analysis.py
- vaa1_core.lock.yml
- vaa1_face.lock.yml

## Purpose
This stage provides a working face-analysis wrapper on top of:
- a core environment (`vaa1_core`)
- a separate face-analysis environment (`vaa1_face`)

## Current capabilities
`face_analysis.py` provides:
- normalized face-analysis output
- source timestamp support
- analysis timestamp support
- CSV export
- JSON-backed worker pipeline
- score dictionaries for:
  - gender
  - emotion
  - race

## Expected pipeline structure
- `app/face_worker.py`
- `app/pipeline/face_bridge.py`
- `app/pipeline/face_analysis.py`

## Stable execution style
Prefer:
- `conda run -n vaa1_core python -m ...`
- `conda run -n vaa1_face python ...`

## Example test command
`conda run -n vaa1_core python -m app.test_face_analysis`

## Example returned keys
- success
- error
- image_path
- source_timestamp
- analysis_timestamp
- csv_path
- faces

## Notes
- interactive shell lag may occur on some Macs
- the code path itself is working
- the face anonymizer should be implemented as a separate downstream module
