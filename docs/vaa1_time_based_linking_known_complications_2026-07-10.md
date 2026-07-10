# VAA1 Known Complications: Time-Based Linking of Data Attributes

Date: 2026-07-10
Status: Active release-critical register
Severity: Critical
Applies to: Transcript, POS, Quant, Audio Workbench, prosody, diarization, audio events, Time Bank, Master Schema, StatsKit, SignificanceKit, RelevanceKit, Narrative Agent evidence, Traceback, source navigation, exported bundles

## Purpose

This document records known complications in VAA1's time-based linking regime. It should be treated as a required reference before changing transcript clocks, timestamp normalization, local-analysis fallback, saved-work import, derived audio artifacts, POS/Quant evidence rows, Master Schema temporal routing, or source-jump behavior.

The program depends on one stable source-media clock. If that clock is wrong, every data attribute that claims to be source-linked can point to the wrong moment. That failure is not cosmetic. It breaks the epistemic contract of the whole system.

## Non-Negotiable Rule

No artifact may be treated as mature source-linked evidence unless its `start` / `end` values are known to be on the source-media clock, or the artifact is explicitly marked as approximate, candidate, degraded, unresolved, or support-only.

Clock authority order:

1. Manual analyst correction made against the source-video moment.
2. Raw original Whisper timecode for transcript rows.
3. Explicit verified source-time anchor for a known corrupted-clock exception.
4. VAD/acoustic measurement as support, audit, or candidate anchor.
5. Chunked fallback, scaffold, inherited offset, projected timing, or UI repair as candidate timing only.

Manual correction may override Whisper. VAD may support Whisper. Fallback may recover text or propose candidates. None of those support routes may impersonate the raw Whisper clock.

## Known Incident Register

### 1. April 2026 Bond Trailer Coarse / Truncated Transcript

Reference:

```text
docs/vaa1_bond_trailer_transcript_timestamp_bug_report_2026-04-10.md
```

Observed failure:

- The `NO TIME TO DIE` trailer transcript used abnormally coarse spans, dominated by `2s`, `4s`, and `6s` intervals.
- The transcript ended before the media duration.
- The Speech to Text panel stopped early even though source media and extracted audio continued.

Fault class:

```text
asset-specific transcript timing degradation accepted too close to ordinary source timing
```

Program risk:

- Transcript text could look usable while its clock was not source-trustworthy.
- Downstream panels could inherit truncated or coarse timing.
- Source jumps could imply evidence at the wrong moment.

Required lesson:

- Transcript quality must be checked against source duration and extracted-audio duration.
- Late uncovered media must be explicit as unresolved, non-speech, music/effects, or degraded coverage.
- Coarse timestamp rhythm is a warning sign even when transcript text looks plausible.

### 2. June 2026 Transcript / POS / Quant Timing Authority Failure

Reference:

```text
docs/vaa1_transcript_timing_authority_bug_report_2026-06-05.md
```

Observed failure:

- Bond trailer rows surfaced as `0.000-2.000`, `2.000-4.000`, `4.000-6.000` even though the first spoken line occurred around `6.400s`.
- POS and Quant consumed the same degraded timing and therefore inherited the rhythm error.
- The imported saved-work bundle already contained the degraded transcript artifact.

Fault class:

```text
degraded transcript coverage accepted as source-linked time authority
```

Program risk:

- POS/Quant evidence rows became navigable to wrong source moments.
- Mature-data proliferation could reuse the wrong time anchors.
- Saved-work import could rehydrate stale timing as if it were current truth.

Required lesson:

- Saved bundle artifacts are not automatically authoritative.
- Derived panels must carry and inspect timing authority, not just `start` / `end` numbers.
- Refresh/reopen must not restore a bad transcript artifact after repair.

### 3. July 8 2026 Transcript / Audio / Master Schema Clock RCA

Reference:

```text
docs/vaa1_transcript_audio_master_clock_rca_2026-07-08.md
```

Observed failure:

- Correct transcript text with scaffold timing was allowed to seed audio workbench rows, prosody windows, diarization, and Master Schema temporal evidence.
- A global offset made the opening line look better but could not correct non-linear drift.
- VAD-anchored rows and inherited rows were not consistently separated by authority level.
- Frontend zero-offset handling briefly allowed provenance fields such as `sourceStart` / `sourceEnd` to overwrite repaired display time.

Fault class:

```text
source-authority failure across transcript-derived audio and Master Schema artifacts
```

Program risk:

- Measured acoustic rows could claim completion while measuring the wrong transcript interval.
- Prosody, speaker turns, and narrative-agent evidence could become clock-contaminated.
- Master Schema rows could preserve a neat interval while losing the authority context needed to judge it.

Required lesson:

- `start` / `end` are the current display/navigation clock.
- `source_start` / `source_end` are provenance, not display authority, unless a deliberate non-zero offset is being applied.
- Derived artifacts must be rebuilt or invalidated after any true clock change.

### 4. July 10 2026 False Whisper Authority Certification

Reference:

```text
docs/working_handover_handout_2026-07-10_transcript_timing_crisis.md
```

Observed failure:

- The Bond transcript panel showed rows such as:

```text
0:06.400-0:08.400  Why would I betray you?
0:08.400-0:10.400  We all have our secrets.
0:20.000-0:24.000  The world is arming faster than we can respond.
0:26.000-0:28.000  Where's 007?
```

- Those rows looked confirmed in the UI, but many were not raw Whisper timecode.
- The artifact metadata said `language_info.source: whisper`, while row-level timing authority was actually mixed:
  - `anchored_vad_timing_repair`
  - `quick_sweep_transcript`
  - chunked fallback candidate timing
- The surface-level label therefore certified the wrong substance.

Fault class:

```text
false operational authority: fallback/VAD/candidate timing promoted as Whisper timecode
```

Immediate cause:

- Authority checks accepted broad indicators such as `source: whisper`, `quick_sweep_transcript_priority`, `automatic_transcript_timestamp`, and `source_time_operational` without proving row-level raw Whisper timing.
- A frontend merge helper used `automatic_fallback_candidate.segments` as a clock base and relabeled the result as Whisper authority.
- Backend and frontend checks could therefore agree on a false authority label.

Corrected operational source:

- The raw Whisper timecode must be regenerated or loaded as its own artifact.
- Matured annotations may be layered over that raw Whisper clock.
- Manual correction is the only routine override.
- VAD and fallback rows remain support/candidate unless an exception repair is explicitly declared and visibly carried.

Required lesson:

- A source label is not authority.
- A payload-level `source_time_operational: true` is not enough if row-level timing authorities contradict it.
- `quick_sweep_transcript`, `chunked_fallback`, `anchored_vad_timing_repair`, `automatic_transcript_timestamp`, and inherited offset rows must not be counted as raw Whisper authority.
- The UI must not display `Confirmed` merely because a row has plausible-looking times.

## Failure Patterns To Watch

### False Authority Labels

Symptoms:

- `language_info.source` says `whisper`, but row authorities are VAD, fallback, scaffold, or quick sweep.
- `timing_authority.operational_authority` claims `original_whisper_timecode`, but segment rows do not.
- `source_time_operational` is true while row timing is mixed.

Rule:

Row-level authority wins over payload-level optimism.

### Coarse Rhythm

Symptoms:

- Many transcript spans are exactly `2.000s`, `4.000s`, or `6.000s`.
- Adjacent rows advance in regular blocks even when speech rhythm does not.
- First speech starts at `0.000s` even when source audio has an opening gap.

Rule:

Coarse rhythm should trigger degraded/candidate handling unless raw Whisper artifact evidence proves it.

### Provenance Fields Used As Display Clock

Symptoms:

- `source_start` / `source_end` overwrite repaired `start` / `end`.
- A zero offset changes visible timing.
- Repeated correction application moves rows backward to old scaffold time.

Rule:

Zero offset must be a no-op. Provenance fields are not display authority.

### Support Data Promoted To Clock Authority

Symptoms:

- VAD rows become transcript spans.
- Inherited-after-anchor rows are marked confirmed.
- Fallback rows replace the transcript clock without explicit candidate status.

Rule:

Support data can audit, flag, and propose. It does not rule the transcript clock.

### Derived Artifact Contamination

Symptoms:

- POS, Quant, prosody, diarization, audio events, or Master Schema rows still use old intervals after transcript repair.
- Saved-work reopen restores an older transcript clock.
- Frontend cache shows stale timing after backend repair.

Rule:

Clock changes must invalidate or rebuild all dependent artifacts.

## Required Artifact Separation

The system should preserve these as separate concepts and, where possible, separate files:

```text
raw_whisper_timecode
operational_transcript
manual_correction_ledger
vad_support
fallback_candidate
repair_candidate
derived_pos
derived_quant
derived_prosody
derived_diarization
master_schema_temporal_evidence
```

The operational transcript may combine text and annotations, but it must not overwrite the raw Whisper timecode artifact.

Recommended fields:

```text
timing_authority
timing_status
timing_source
source_time_valid
candidate_time_valid
source_start
source_end
manual_correction_ref
raw_clock_ref
derived_from_clock_fingerprint
```

## Release Gates

Before release or package export, VAA1 must prove:

- every transcript row displayed as confirmed has row-level source-time authority;
- every POS/Quant evidence row carries the transcript row authority it depends on;
- every audio/prosody/diarization row records the transcript or audio-event clock used to create it;
- every Master Schema temporal row records whether its clock is raw, manual, verified repair, VAD support, fallback, or candidate;
- every source jump uses the same `start` / `end` displayed in the relevant panel;
- saved-work import cannot silently restore older degraded timing over a repaired or regenerated clock;
- frontend cache is invalidated when transcript timing authority changes.

## Regression Tests Required

Required test shapes:

- Healthy raw Whisper transcript survives VAD, fallback, diarization, prosody, and UI loading without clock mutation.
- Bond-style scaffold rows do not become source authority.
- Payload-level `source_time_operational: true` is ignored when row authorities are VAD/fallback/quick-sweep.
- `automatic_transcript_timestamp` is not treated as `original_whisper_timecode`.
- `quick_sweep_transcript` and `chunked_fallback` remain candidate timing unless row-level raw Whisper evidence exists.
- Zero offset never rewrites display time from provenance fields.
- POS and Quant panels prefer the operational transcript clock only when it is backed by raw Whisper/manual/verified repair status.
- Any transcript clock change invalidates diarization, prosody, audio sample clouds, time-bank audio, linked transcript, POS, Quant, Master Schema, StatsKit, SignificanceKit, RelevanceKit, Traceback, and Narrative Agent timelines.

## Operational Checklist Before Touching Time-Based Linking

1. Identify the source media id and source duration.
2. Identify the raw clock artifact and its timing authority.
3. Inspect row-level timing authority, not only payload-level metadata.
4. Compare first speech onset against source playback.
5. Check coverage ratio and trailing uncovered duration.
6. Check for coarse rhythm.
7. Check whether manual corrections exist and whether they are source-time corrections or text-only corrections.
8. Check whether VAD is being used as support or as a hidden clock replacement.
9. Rebuild or invalidate all derived artifacts after any clock change.
10. Add or update a regression test for the exact failure shape.

## Bottom Line

The time regime is a core product dependency. A transcript row with the wrong clock is not a minor transcript bug; it is a false source claim that can contaminate the whole analysis graph.

VAA1 should run a tight ship:

```text
No source-time authority without source-time substance.
No mature data without a traceable clock.
No support layer masquerading as the clock.
No derived artifact surviving a clock change without rebuild or invalidation.
```
