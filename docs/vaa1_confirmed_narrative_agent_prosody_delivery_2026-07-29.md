# VAA1 confirmed Narrative Agent prosody delivery

Date: 2026-07-29

## Delivered outcome

Confirmed Transcript speaker assignments now govern the attribution of overlapping measured prosody without changing the prosody measurement or inventing identity.

The source-time join produces one `vaa1.speaker_prosody_projection.v1` artifact in the saved analysis state. Each projection retains:

- canonical speaker-assignment correction reference;
- measured prosody cue reference;
- canonical `source_media.clock` interval;
- transcript text;
- pace, pause, turn, interaction, rhythm, tonality, emphasis, pitch/energy, and sound-environment measurements;
- distinct assignment, measurement, and projection authorities;
- maturity as a governed evidence link;
- downstream motor targets; and
- an explicit prohibition on automatic identity promotion.

## Consumers and motors

The shared enriched prosody record is available to:

1. Master Schema;
2. Meaning Network;
3. Narrative Agent graph;
4. audio sample clouds;
5. evidence proliferation matcher;
6. StatsKit/native statistics and interpretation;
7. Scene Cards;
8. Time Bank; and
9. the Audio/Transcript work surfaces.

Meaning Network creates `prosody_of` only when a governed Narrative Agent profile matches the confirmed speaker. Narrative Agent scene/profile rows consume the same confirmed transcript overlap and prosody cue. Master Schema exposes `narrative_agent_prosody` separately from the underlying speaker assignment and voice-profile candidate.

## Governance boundaries

- Source-time overlap and an explicit speaker confirmation are both required.
- Prosody remains a measured audio property; the speaker assignment supplies attribution authority, not measurement authority.
- Conflicting overlapping speaker confirmations leave the cue unassigned.
- `Background noise` and `Crowd` become `audio_source_prosody`, never Narrative Agents.
- `Announcer` and `Voice-over narration` remain speaker-role projections unless independently governed as Narrative Agents.
- `UNKNOWN`, `Speaker 1`, and equivalent algorithmic labels are excluded.
- Downstream motors may create reviewable candidates but cannot promote identity automatically.

## Validation

- 69 focused frontend governance/runtime contracts pass.
- 29 focused backend projection, canonical, sample-cloud, matcher, and scanner tests pass.
- TypeScript and diff hygiene pass.
