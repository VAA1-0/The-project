# VAA1 Transcript Timing Authority Bug Report

Date: 2026-06-05

Status: critical correction delivered in working tree; requires restart/manual verification before release.

## Summary

VAA1 surfaced a dangerous transcript timing failure in the Bond trailer saved-work item.

The Transcript panel showed the first transcript span as:

```text
0:00.000 - 0:02.000
Why would I betray you?
```

The analyst observed that the spoken line occurs later in the source-video timeline. POS and Quant showed the same rhythm problem because they consumed the same transcript-derived timing evidence.

This is a core authority failure. Transcript, POS, Quant, audio prosody, time bank audio, evidence navigation, and mature-data proliferation all depend on source-linked time anchors. VAA1 must never silently treat degraded or synthetic transcript spans as authoritative source-video time.

## Verified Cause

This was not caused by today's frontend transcript parser, Playwright setup, or manual sync UI.

The imported saved-work bundle itself already contained the bad transcript artifact:

```text
outputs/imported_work/c6cbe29b-6722-4e87-b54d-8626a5c3ff42/
NO TIME TO DIE Trailer UK - James Bond 007 (720p, h264)_transcript.json
```

Verified facts:

- transcript segment count: 47
- first spans: `0.0-2.0`, `2.0-4.0`, `4.0-6.0`
- last transcript end: `124.0s`
- source-video duration: `155.104535s`
- extracted-audio duration: `155.062875s`
- transcript coverage ratio: `0.7995`
- trailing uncovered gap: `31.105s`

The linked transcript, audio prosody, time bank audio, and Quant evidence were all derived from that stale/degraded transcript clock.

The failure class is:

```text
degraded transcript coverage accepted as source-linked time authority
```

## Why This Is Dangerous

If transcript timing is wrong, every linked claim can point to the wrong moment.

Affected surfaces include:

- Transcript navigation
- Current Cue
- POS evidence
- Quant evidence
- Audio prosody
- Time Bank audio
- Meaning Network evidence
- Mature Data Proliferation candidates
- Any saved bundle that reopens and trusts old transcript spans

This can create false mature evidence. In VAA1 terms, it violates the same core rule as BBox drift:

```text
Manual and source-linked evidence must stay anchored to the correct source time.
```

## Delivered Correction

The backend now has a shared transcript timing guard:

```text
src/backend/analysis/transcript_timing_guard.py
```

It reports transcript quality against source/audio duration and flags stale timing when:

- transcript coverage has a trailing shortfall,
- coverage ratio is below the accepted threshold,
- the uncovered tail is materially large,
- and the transcript has not already been repaired by the chunked fallback path.

Completed-analysis refresh now runs a repair pass:

```text
repair_transcript_timing_if_needed(status)
```

When a stale/degraded transcript is detected, VAA1:

1. backs up the degraded transcript,
2. reruns chunked fallback transcription from the extracted audio,
3. writes repaired transcript timing,
4. rebuilds linked transcript,
5. rebuilds audio prosody,
6. rebuilds time bank audio,
7. rebuilds POS analysis,
8. rebuilds Quant analysis,
9. records a `transcript_timing_repaired` event.

The correction is intentionally conservative. Healthy transcripts are not rewritten.

## Regression Guard

Added:

```text
tests/test_transcript_timing_guard_contract.py
```

The test locks the Bond failure shape:

- source duration `155.104535s`,
- transcript last end `124.0s`,
- coverage `0.7995`,
- trailing gap `31.105s`,
- repair required.

It also verifies that a chunked-fallback repaired transcript is not repaired again.

## Validation

Passing checks after correction:

```text
python3 -m py_compile api_server.py
python3 -m unittest tests.test_transcript_timing_guard_contract
cd src/frontend && npm test
cd src/frontend && npx tsc --noEmit
git diff --check
```

Frontend source tests remain passing at `63/63`.

## Manual Verification Required

After backend restart, reopen the Bond trailer saved work and verify:

- Transcript no longer begins with false `0:00-0:02` source authority if the source audio does not support it.
- Current Cue follows repaired transcript time.
- POS evidence navigation uses repaired timing.
- Quant evidence navigation uses repaired timing.
- Audio prosody spans align with repaired transcript timing.
- Refresh/reopen does not restore the old degraded transcript artifact.

## Release Rule

Transcript timing is release-critical.

No transcript, POS, Quant, audio prosody, time-bank, Meaning Network, or Mature Data Proliferation evidence may be treated as mature source evidence unless its time anchors are verified against the source media clock or explicitly marked unresolved/degraded.
