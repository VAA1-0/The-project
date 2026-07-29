# VAA1 governed speaker assignment and audio-profile candidate delivery

Date: 2026-07-29

## Delivered boundary

Transcript `Speaker confirmation` is now a source-timed governed assignment rather than panel-local metadata.

- Saved named-speaker confirmations synchronize into the append-only canonical decision ledger as `speaker.assignment`.
- `Background noise` and `Crowd` synchronize as `audio.source_class`; they cannot become person identities or individual voice profiles.
- Algorithmic labels such as `UNKNOWN`, `Unknown speaker`, and `Speaker 1` cannot become canonical speaker assignments.
- Master Schema exposes confirmed speaker/source assignments and separate voice-profile sample candidates.
- Meaning Network retains the source-timed transcript node and adds `has_speaker_assignment`; known governed characters also receive a `spoken_by` edge.
- Narrative Agent consumes the corrected speaker on its existing source-time/profile matching path, allowing confirmed utterances and overlapping prosody to join the selected character without rewriting transcript evidence.
- Eligible named/role spans produce only reviewable voice-profile sample candidates. Candidate metadata identifies the source assignment, duration, overlapping diarization turns/clusters, quality-gate state, and the prohibition on automatic identity promotion.

## Scientific and governance boundary

A confirmed transcript span is a strong supervised anchor, but one span is not a reusable biometric identity model by itself. Automatic proliferation may propose speaker matches only when:

1. the confirmed span has canonical source time;
2. its duration meets the bounded sample threshold;
3. a measured diarization turn overlaps the span;
4. the audio-quality/sample-cloud layer is available;
5. the candidate retains its source assignment and cluster evidence; and
6. an analyst reviews the candidate before identity projection.

Reporting, Meaning Network, Narrative Agent, Master Schema, and audio-profile candidates consume the same assignment; none may silently promote a diarization cluster into a person identity.

## Runtime migration proof

The active No Time To Die acceptance analysis contained nine valid named-speaker confirmations. Re-saving the unchanged correction snapshot through the updated backend created nine source-scoped canonical `speaker.assignment` projections.

One historical `UNKNOWN` correction was admitted by the backend process running immediately before the final unknown-label guard loaded. The decision was append-only invalidated with reason `unknown_speaker_not_governed_identity`. The final projected claim query returns nine valid assignments and no `UNKNOWN` projection.

## Validation

- Frontend TypeScript validation passes.
- Transcript, Meaning Network, Narrative Agent, Master Schema, and manual-governance contract tests pass.
- Canonical adapter, canonical write-boundary, and audio-sample-cloud backend tests pass.
- Live canonical projection returns nine current speaker assignments for the acceptance analysis.
