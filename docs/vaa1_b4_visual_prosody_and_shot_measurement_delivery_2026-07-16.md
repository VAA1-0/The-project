# B4 visual, prosody, and shot measurement delivery

Date: 2026-07-16

## Outcome

The reproducible native measurement run now consumes the actual saved object, OCR, facial-expression sampling, audio-prosody, and shot-boundary artifacts in addition to the B3 transcript, speaker, VAD, and scene inputs. Each artifact is independently hashed and retains its own evidence-quality and permitted-use assessment.

Shot boundaries are now delivered as a real source-video measurement. The local PySceneDetect ContentDetector records its version, threshold, minimum shot length, source-video hash, complete intervals, and transition boundaries. It has no scene-card or sampled-transition proxy fallback. Algorithmic shot intervals are valid descriptive temporal measurements while semantic use remains reviewable.

## Live delivery evidence

Analysis `0b16df1c-bc47-4b24-b90f-4d34e53c68e4` produced:

- 118 measured shot intervals and 117 boundaries, mean duration 1.313559 seconds;
- 118 shot rows routed into Master Schema;
- 176 object detections across 94 tracks;
- 75 OCR regions and 67 unique surfaced strings;
- 161 expression samples, of which 50 contained a face signal and 35 supported a ready expression observation;
- 39 prosody cues with a mean measured pace of 2.20659 words per second;
- nine source-traceable native findings in the non-persisting combined run preview.

The shot artifact and Master Schema shot layer were intentionally persisted. The combined B4 measurement-run probe used `persist: false`, so it did not add a StatsKit run artifact to the saved analysis.

## Governance boundary

- Detector classes remain object observations, not semantic object truth.
- OCR strings remain raw recognized text until governed confirmation.
- Expression samples distinguish no-face, weak, clear, and error states; missing faces do not become neutral emotion.
- Prosodic descriptors remain measured delivery cues, not narrative intention.
- Shot boundaries are distinct from formal scenes and interpretive windows.
- Camera composition remains unavailable for this analysis because no saved measured composition artifact exists. It is not inferred from scene cards or metadata.
- Color regime currently has two distinct states. Visual cues can provide an immediate browser/canvas reading of the displayed frame, while the backend pipeline can calculate spatial BGR/HSV tone measurements with OpenCV. The selected saved analysis has no persisted `spatial_tone_scan`; therefore its live reading remains an analyst aid and must not be counted as governed Master Schema or StatsKit evidence. A later operationalization pass should persist sampled measurements, source timestamps, method/version information, and dependency links before downstream proliferation.

## Verification

- `tests.test_shot_boundary_measurement` proves real hard-cut detection, source hashing, persistence, and boundary adjacency.
- `tests.test_reproducible_measurement` covers all measured B4 modalities and B3 regression behavior.
- `vaa1_core` compilation, JSON parsing, and diff formatting checks pass.
