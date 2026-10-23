# Bug report — Quick Sweep media runtime path failure

Date: 22 October 2026
Stage: 9.5 release qualification
Severity: Release-blocking
Boundary: `analysis_runtime_preflight`

## Summary

A Quick Sweep could start even though the application runtime could not resolve
`ffprobe`. Visual sampling completed, the audio branch failed, and the analysis
ended `partial`. The failure was correctly recorded, but it was discovered too
late: runtime readiness must be decided before analytical work starts.

## Reproduction

1. Launch the backend with
   `/Users/admin/opt/anaconda3/envs/vaa1_core/bin/python` from a shell whose
   inherited `PATH` does not contain that runtime's `bin` directory.
2. Upload a valid two-second MP4 with video and audio.
3. Start `quick_sweep` / `multimodal`.
4. Observe successful visual sampling followed by
   `[Errno 2] No such file or directory: 'ffprobe'`.
5. Inspect `analysis_run_record.json`: state is `partial`; the error is preserved
   under fallback reasons.

First failing acceptance analysis:
`08aa3e7f-92cd-40cf-9094-6efe09413403`.

## Root cause

The active Python environment contained both `ffmpeg` and `ffprobe` beside its
Python executable. `ffmpeg-python` invokes those tools by bare command name.
Datascene relied only on the launcher's inherited `PATH`, so a valid installed
runtime could be treated as missing. No start-time dependency gate existed.

A secondary telemetry issue was exposed: the installed macOS `psutil.Process`
does not implement `io_counters`. Process memory and CPU collection shared the
same exception boundary, so an unavailable optional I/O counter discarded
otherwise valid memory observations.

## Fix

- Resolve `ffmpeg` and `ffprobe` from inherited `PATH` and then from the active
  Python runtime directory before importing pipeline consumers.
- Add a typed `RUNTIME_DEPENDENCY_UNAVAILABLE` preflight rejection if either
  executable remains missing.
- Record resolved dependencies in `vaa1.analysis_run_record.v1`.
- Isolate optional I/O telemetry failure from memory/CPU telemetry.
- Preserve bounded start/current/peak resource observations.

## Mitigation schema

The machine-readable control and acceptance contract is
[`vaa1_runtime_dependency_mitigation_v1.schema.json`](schemas/vaa1_runtime_dependency_mitigation_v1.schema.json).

The operational sequence is:

`discover → disclose → block before work if absent → record → repair/restart → rerun`

No analysis is allowed to degrade into a partial result merely because an
installed sibling executable was absent from the shell path.

## Verification

Final post-fix acceptance analysis:
`dbd6b19c-c791-4a1f-89be-985d3cbba765`.

- upload metadata probe passed;
- visual Quick Sweep completed;
- audio extraction and transcription completed;
- the run reached `completed` rather than `partial`;
- `audio_error` was absent;
- the receipt declares both resolved executable paths and dependency readiness;
- the receipt retained selected model, installed provider versions, effective
  Quick Sweep settings, runtime dependency paths, resource observations and
  artifact references; and
- process RSS/CPU observations survived the unsupported optional I/O counter.

## Residual qualification

The two-second sine fixture legitimately produced no speech segments and used
the transcript fallback path. That is content behavior, not a runtime lookup
failure. Longer speech-bearing Quick Sweep coverage belongs to Stage 9.6.
