# VAA1 Working Handover Handout - Transcript Timing Crisis - 2026-07-10

## Purpose

This handout records the transcript/audio timing crisis from the July 2026 Datascene/VAA1 work thread. It is meant to prevent the same mistake from being repeated: VAD, fallback transcription, speaker diarization, prosody, or UI repair logic must not be allowed to overwrite or impersonate the source transcript clock.

The operational rule is now explicit:

```text
Use the original Whisper timecode as truth unless a manual correction has been made.
```

Manual correction outranks the detector. VAD can support, audit, or flag a transcript interval, but VAD is not the transcript clock authority.

## Current Situation

The Bond trailer is the known corrupted timing case at the moment. Other videos in the Datascene saved-work set are understood to be punctual unless direct evidence shows otherwise. The program-wide timing regime must therefore be restored without treating every video as broken.

The latest VAD addition broke the timing regime by allowing audio-derived support layers to influence transcript timing too aggressively. The bug has been partly fixed and must now be thoroughly fixed so the global clock remains stable across Transcript, Audio, Prosody, Master Schema, StatsKit, SignificanceKit, RelevanceKit, Narrative Agent, Traceback, and video cue navigation.

The central failure was not that Datascene lacked transcript text. The text was present. The problem was that a corrupted or fallback timing regime was allowed to surface as if it were the authoritative source-video clock.

## Non-Negotiable Clock Authority

Datascene has one source-video clock per source media item. All source-linked evidence must use that clock.

Authority order:

1. Manual analyst correction made at the source-video moment.
2. Original Whisper timecode produced by the quick-sweep transcript process.
3. Verified source-time anchor, when the original transcript clock is demonstrably corrupted for a specific item.
4. VAD/acoustic support as auxiliary evidence only.
5. Chunked fallback, scaffold, inherited, offset, or projected rows as approximate/candidate evidence only.

Rows from fallback, inherited VAD projection, or scaffold timing must never be displayed as confirmed source truth.

## The Bond Trailer Exception

The Bond trailer is the current exception case because its saved transcript timing was already corrupted.

Known reference points discussed in the thread:

```text
Why would I betray you?
Expected source time: about 00:00:06.400

The world is arming faster than we can respond.
Expected source time: about 00:00:20.960-00:00:22.215

Where's 007?
Expected source time: about 00:00:26.50
```

The first two timings above have acted as stronger anchors than the later coarse fallback rows. The later two-second rows such as `26.000-28.000` are not automatically proof of original precision. They must be treated as approximate unless the original Whisper timing artifact proves otherwise.

## What Went Wrong

The system began mixing several timing regimes:

- original or semi-original transcript rows;
- scaffold rows such as `0-2`, `2-4`, `4-6`;
- VAD-anchored rows;
- inherited rows projected from a VAD anchor plus scaffold deltas;
- chunked fallback rows;
- frontend display repairs and correction overlays.

This produced rows that looked professional in the UI but had different levels of clock authority. Some rows were then marked or treated as confirmed even when they were only approximations.

The key mistake was promoting support data into clock authority. In particular:

- VAD was treated as if it could repair transcript timing globally.
- `chunked_fallback` rows were treated as `quick_sweep_transcript` authority.
- inherited or offset rows were allowed to look more mature than they were.
- derived artifacts such as diarization, prosody, linked transcript, time-bank audio, and Master Schema speaker turns consumed those timings and propagated the error.

## What Must Be Preserved

Original Whisper output must be preserved as a raw detector artifact. It must not be overwritten by:

- VAD repair;
- chunked fallback;
- manual display correction;
- speaker diarization;
- prosody reconstruction;
- Master Schema routing;
- frontend cache or local-analysis download fallback.

The operational transcript can be a separate artifact, but it must carry provenance explaining why each row uses its chosen timing.

Recommended artifact split:

```text
*_transcript_raw_whisper.json
*_transcript_operational.json
*_transcript_repair_candidate.json
*_transcript_fallback_candidate.json
```

The exact filenames can follow existing project conventions, but the separation must be real.

## Program-Wide Dependency Map

The timing regime affects:

- Transcript panel rows, cue jumps, sync controls, and text corrections.
- Audio Workbench speech/VAD/diarization rows.
- Prosody, delivery, energy, pitch, pause, rhythm, and turn-structure rows.
- Audio sample clouds and foley/proliferation candidates.
- Master Schema temporal evidence.
- Narrative Agent confirmation and source anchors.
- POS and Quant source evidence.
- StatsKit, SignificanceKit, and RelevanceKit computed values.
- Traceback and source-navigation links.
- Meaning Network timelines.
- Exported analysis packages.

Any timing repair must rebuild or invalidate all derived artifacts that consumed the old clock.

## Correct Use Of VAD

VAD is valuable, but its role is bounded.

Allowed:

- detect speech/non-speech intervals;
- support speech/silence/music/noise ratios;
- flag transcript rows whose audio evidence does not fit;
- propose candidate anchors when the transcript is known corrupted;
- help generate prosody and energy windows once the row timing is trusted.

Not allowed:

- silently overwrite original Whisper timestamps;
- become the global transcript clock;
- promote inherited rows as confirmed transcript spans;
- turn chunked fallback rows into source truth;
- make one corrupted video imply all videos are corrupted.

## Current Engineering Findings

The current working tree still needs cleanup before the next feature phase:

- `transcript_timing_guard.py` and `tests/test_transcript_timing_guard_contract.py` are not coherent: the test imports timing-repair functions that are not currently present in the module.
- Backend transcript authority logic still treats `anchored_vad_timing_repair` too broadly as authoritative.
- Frontend/local transcript selection also recognizes broad repair authority and can surface repaired artifacts over raw/scaffold rows.
- Current Bond artifacts contain mixed rows: verified anchors, anchored offsets, VAD anchor rows, and chunked fallback rows.
- The current contract still risks marking fallback-derived rows as usable source timings.

This means the next phase should be a systematic restoration of the transcript timing contract, not further panel-level tweaks.

## Required Fix Direction

The fix must be evidence-based and program-wide.

1. Inventory transcript timing sources for each analysis.
2. Identify whether a video is healthy or specifically corrupted.
3. Preserve original Whisper timing separately from operational repair artifacts.
4. Make the original Whisper timecode the default truth.
5. Apply manual corrections only through a persistent correction ledger.
6. Treat VAD as auxiliary unless the video is explicitly in a corrupted-clock repair path.
7. Mark approximate/fallback/inherited rows visibly and prevent them from becoming confirmed source truth.
8. Rebuild or invalidate diarization, prosody, audio event intervals, linked transcript, time-bank audio, POS, Quant, Master Schema, StatsKit, SignificanceKit, RelevanceKit, Traceback, and Narrative Agent timelines after any true clock change.
9. Add regression tests for both healthy videos and the corrupted Bond exception.

## Regression Tests Needed

Tests must prove:

- healthy Whisper-timed videos are not repaired;
- original Whisper timestamps survive VAD, fallback, diarization, and prosody passes;
- manual correction outranks original Whisper timing;
- VAD cannot overwrite transcript time unless the analysis is explicitly marked as a corrupted-clock repair case;
- chunked fallback rows are approximate/candidate, not `quick_sweep_transcript` authority;
- Bond trailer repairs do not generalize to other videos;
- frontend displays `start/end` from the selected authority without using provenance fields as display time;
- derived artifacts carry timing authority and are invalidated when the clock changes.

## Working Vocabulary

Use the project vocabulary consistently:

- Narrative Agent, not identity.
- Original Whisper timecode, not generic transcript timing.
- VAD support, not VAD authority.
- Manual correction ledger, not ad hoc frontend offset.
- Operational transcript, not overwritten raw transcript.
- Candidate or approximate evidence, not confirmed evidence, when timing is not source-verified.

## Bottom Line

The timing regime is foundational. Datascene cannot deliver professional tooling if a transcript row can point to the wrong source moment.

The fix is not to abandon VAD or audio work. The fix is to keep clock authority clean:

```text
Original Whisper timecode is truth by default.
Manual source correction overrides it.
VAD supports and audits; it does not rule.
The Bond trailer is the known corrupted exception, not the default assumption for the corpus.
```

