# M1a Transcript cursor/interval increment — 29 September 2026

## Outcome

Transcript now makes the shared global clock locally legible. It displays the
revision-bound source cursor in canonical `M:SS.mmm`/`H:MM:SS.mmm` form, reports
whether that point is inside, before or after the nearest authoritative
transcript interval, retains the interval's start/end bounds, and highlights the
matched row. When no authoritative interval exists, the panel says so rather
than treating candidate or scaffold timing as evidence.

This is presentation-only. It does not change transcript timestamps, timing
authority, correction persistence, navigation, or the ordered manual acceptance
status.

## Verification

- Focused clock, Transcript, Expressions and navigation suite: **50 passed**.
- `npx tsc --noEmit`: passed.
- No saved analysis, correction ledger or source-media artifact was written.

## Analyst rerun and follow-up

At `1:11.000`, the panel correctly identified the prior interval
`1:08.200–1:10.680` and the `0:00.320` gap, but did not scroll the matched row
into view. It now follows the matched authoritative interval when that match
changes. Continuous playback does not retrigger scrolling within the same row.

The matched interval's acoustic assignment is `SPEAKER_01` at only `0.5997`
confidence, despite the analyst hearing two speakers. Because the stored
diarization contains no defensible second boundary, the UI now presents a
low-confidence speaker-boundary warning and asks for review/splitting instead
of fabricating a correction. No source record was mutated.

The separately observed character-list auto-follow failure is not claimed as
fixed by this Transcript change and remains an M1a issue.

The analyst's refreshed view at 15:14 confirms the fix in the running product:
the `1:11.000` cursor automatically brings the nearest interval
`1:08.200–1:10.680` into view, highlights it, reports the `0:00.320` gap and
shows its low-confidence speaker-boundary warning. This Video/Transcript
landmark is accepted.

## Remaining M1 work

Rerun M1a on isolated analysis
`clock-acceptance-db1f40f585954e1bbd0885c52bbfdfd1` at `1:11.000` and across
`0:59.999`, `1:00.000` and `1:00.001`. Record the Video cursor, Transcript
interval relationship and Expressions gap/sample statement. M1b still requires
an explicitly isolated real source longer than 1,000 seconds.
