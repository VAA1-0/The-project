# Bug report — imported transcript does not hydrate Transcript consumer

Date: 23 October 2026

## Observed failure

Analysis `81920e95-a0b2-4173-bc23-86db7909a0a9` has a populated, source-timed
transcript at the path recorded by `output_files.transcript`. At source time
`0:41.920`, the Transcript panel nevertheless rendered “No transcript on
channel” and “no authoritative transcript interval available”. No navigable
transcript row was projected into the panel.

## Cause

`SpeechToTextPanel` only attempted the authoritative transcript artifact fallback
when the summary projection resembled a timestamp scaffold. Imported/restored
records can legitimately have an empty summary projection while retaining a
populated authoritative artifact. An empty array bypassed the fallback and was
incorrectly treated as proof of absence.

## Mitigation delivered

An empty transcript summary is now a hydration trigger. The panel loads the
recorded artifact, validates timing authority, applies canonical corrections,
and projects the source-linked rows. It does not invent rows when the artifact
is absent or non-authoritative.

The rendered acceptance fixture was also moved from an emptied legacy CNN
record to the current governed No Time To Die record and beat
`0:41.920–0:43.180`.

## Verification

- Static Transcript/source-clock contracts: 14 passed.
- Rendered Transcript → Video and Audio → Video corridor: passed.
- Audio detach, close/reopen and cross-analysis clearing: passed.
- Sixteen-surface revision-bound source-clock matrix: passed.

This restores the Datascene rule that a recorded source-linked artifact must
actually hydrate its associated consumer. UI presence alone remains
insufficient evidence of operationality.
