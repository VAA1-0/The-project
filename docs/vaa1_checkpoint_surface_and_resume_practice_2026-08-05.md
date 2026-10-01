# Datascene checkpoint surfacing and continuation practice

Date: 2026-08-05

An interrupted or active analysis may have governed measurements before the
whole analysis is complete. Those records are usable evidence and must surface
in their panels with an explicit checkpoint/processing state; they must not be
hidden merely because the final stage has not reported in.

For the visual sweep, `visual_frame_scan_checkpoint.json` is authoritative for:

- the last durable `next_index`;
- source signature and scan mode;
- object and OCR detections already measured;
- selected face-frame references;
- spatial-tone samples; and
- whether the sweep itself is complete.

Continuation reopens the same source, verifies its source signature, hydrates
these arrays, seeks to `next_index`, and processes only subsequent frames.
Completed branches recorded in `analysis_checkpoint.json` are skipped. Interim
panel data remains labelled as checkpoint data until the branch completes and
writes its canonical CSV/JSON outputs.

For the current corpus reconciliation:

- Marcella 3 continues its visual sweep from its current durable `next_index`;
- Marcella 2 skips `audio_language` and resumes visual processing at frame 263;
- Marcella 1 and Marcella 4–7 have completed visual and audio/language branches
  and must use their canonical output files rather than rerunning those stages.
