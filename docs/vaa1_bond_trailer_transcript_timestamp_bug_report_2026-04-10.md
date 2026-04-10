# VAA1 Bug Report: Bond Trailer Transcript Timestamp Failure

Date: 2026-04-10
Branch: `petteri`
Status: Open
Priority: High

## Summary

The `NO TIME TO DIE` trailer analysis currently produces a transcript artifact that:

- ends far before the media duration
- uses abnormally coarse timestamp bands
- causes the `Speech to Text` panel to stop at `124s` even though the media runs to about `155s`

This is a real backend transcription defect first, and a timeline-coverage design defect second.

## Affected Analysis

- analysis id: `f287a423-810a-4734-9109-7993e06cf054`
- source title: `NO TIME TO DIE Trailer UK - James Bond 007`

## Expected Behavior

- transcript timestamps should reflect the actual Whisper output with normal segment granularity
- transcript coverage should remain aligned to the full media timeline
- if speech ends early or decoding fails, VAA1 should still explicitly cover the remaining time span as unresolved or non-speech intervals

## Actual Behavior

- transcript JSON ends at `124.0s`
- source media metadata reports about `155.104535s`
- extracted WAV duration measures about `155.063s`
- transcript segments for this asset are unusually coarse, dominated by `2s`, `4s`, and `6s` spans
- `Speech to Text` panel therefore stops well before the actual video end

## Evidence

### Full-length source and audio are intact

- source media metadata duration: `155.104535s`
- saved WAV duration: `155.063s`

This rules out:

- truncated source video
- truncated audio extraction
- UI playback being the primary cause

### Saved Bond transcript artifact is coarse and truncated

File:

- `outputs/transcripts/f287a423-810a-4734-9109-7993e06cf054_transcript.json`

Observed properties:

- segment count: `47`
- last segment end: `124.0`
- segment lengths dominated by `2.0`, `4.0`, and `6.0`

### Direct retranscription reproduces the same failure

Running the current `openai-whisper` `base` model directly on the saved Bond WAV reproduces the same outcome:

- `47` segments
- `max_end = 124.0`
- same coarse timestamp pattern

This strongly indicates the failure is not introduced by later VAA1 serialization or UI formatting.

### This does not appear to be a global regime change

Fresh audio-only retranscription of older videos under the current environment shows normal or at least materially different behavior:

- `brazil_complete`
  - saved: `62` segments, ends at `148.2s`
  - rerun now: identical
- `english_brazil_short`
  - saved and rerun: identical
- `Diamonds Are Forever`
  - rerun now becomes more granular and extends further than the older saved artifact

Conclusion:

- the current environment has not generally switched into a Bond-style coarse `2s/4s/6s` timestamp regime
- the `No Time To Die` trailer appears to be a problematic asset or decoding case

### Chunked tail transcription shows late speech is still present

Targeted chunk transcription of the Bond WAV tail gave:

- `118s–130s`
  - `"Long after I'm gone."`
  - `"History isn't kind to men who play God."`
- `124s–140s`
  - one segment: `"Scott,"`
- `140s–155s`
  - no detected segments

Interpretation:

- there is still detectable speech after `124s`
- the full-file transcription is dropping or collapsing late trailer material instead of carrying it forward properly
- the final tail may become mostly music/effects, but VAA1 still needs explicit timeline coverage to media end

## Likely Fault Domain

Primary fault:

- asset-specific Whisper transcription failure on this trailer

Secondary design fault:

- VAA1 transcript/timebank currently stops at the last decoded speech segment instead of preserving full-duration timeline coverage with explicit tail intervals

## Not Yet Proven

Still unknown:

- whether a stronger Whisper model resolves the Bond trailer cleanly
- whether chunked-window retranscription plus stitching would recover the missing late trailer speech better than a single full-file pass
- whether trailer mixing, music dominance, compression, or speech-over-sound design is the main trigger

## Recommended Next Steps

1. Add transcript QA gating in backend processing.
   - Compare media duration, WAV duration, and last transcript end.
   - Flag degraded transcript coverage when the gap is materially large.

2. Preserve full timeline coverage in transcript and TimeBank outputs.
   - Fill gaps and end tails with explicit `no speech detected`, `music/effects only`, or `unresolved audio interval` records.

3. Add a fallback path for degraded audio transcription.
   - Retry with a stronger model or a chunked retranscription strategy when coverage is suspiciously short.

4. Keep evidence and interpretation separate in the UI.
   - The panel should show when transcript coverage is degraded rather than implying the transcript reached media end.

## Files Relevant to the Bug

- `src/backend/analysis/pipeline_audio_text.py`
- `api_server.py`
- `src/frontend/app/V2components/components/panels/SpeechToTextPanel.tsx`
- `outputs/transcripts/f287a423-810a-4734-9109-7993e06cf054_transcript.json`
- `outputs/audio/f287a423-810a-4734-9109-7993e06cf054_audio.wav`

