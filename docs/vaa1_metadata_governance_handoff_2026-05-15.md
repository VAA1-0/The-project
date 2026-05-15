# VAA1 Metadata Governance Handoff - 2026-05-15

## Current Goal

Continue the Source Media metadata governance work after refreshing the dev thread.

## Implemented In Current Patch

- Web metadata governance controls:
  - Drop duplicate web sources.
  - Mark web sources as main, supporting, or background.
  - Drop individual web sources.
- Web metadata scraper first pass:
  - Stores retrieval timestamp with date and time.
  - Extracts Wikipedia lead description instead of source-author noise.
  - Avoids treating "Contributors to Wikimedia projects" as a person.
  - Adds VAA1 taxonomy-oriented genre and situation candidates.
- Metadata maturity proliferation:
  - Primary metadata can be filled from mature video-internal evidence.
  - Source media panel exposes mature video-internal fill candidates.
- UI refactor:
  - Source Media metadata panel uses a more compact data-governance layout.
  - Media facts, governed inputs, character support, and curated fields are collapsible.
- Latest local additions:
  - Scraped long text fields are rendered as scrollable text blocks instead of clipped line clamps.
  - Web scrape emits `character_roles` and `production_crew` separately.
  - Frontend displays `Cast / character roles` and `Production crew` separately.

## Verification Already Run

- `conda run -n vaa1_core python -m py_compile api_server.py` passed.
- `conda run -n vaa1_core python -m unittest tests.test_source_media_metadata_contract` passed.
- `./node_modules/.bin/eslint app/V2components/components/panels/SourceMediaMetadataPanel.tsx` passed.
- `./node_modules/.bin/tsc --noEmit --project tsconfig.json` passed after the character-role typing fix.

## Backend State

The last backend restart behaved poorly in this long thread:

- A process bound to `127.0.0.1:8000`, but `/api/health` returned `000`.
- That unhealthy process was killed.
- Next thread should start the backend fresh with:

```bash
conda run -n vaa1_core uvicorn api_server:app --host 127.0.0.1 --port 8000
```

If sandbox blocks binding, run the same command with escalation.

## Manual Test To Run Next

1. Start backend and confirm:

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/health
```

Expected: `200`.

2. Hard refresh VAA1 browser page.
3. Open No Time To Die analysis.
4. Source Media -> Governed Evidence Inputs.
5. Retrieve Wikipedia metadata again.
6. Confirm:
   - Description / synopsis is scrollable and not clipped.
   - Cast / character roles appears, e.g. James Bond / Daniel Craig with role description where available.
   - Production crew is separate.
   - Drop duplicates works.
   - Main / Supporting / Background works.
   - Drop source works.

## Known Remaining Work

- Character-role prose should become more archive-useful, e.g.
  "James Bond / 007 (Daniel Craig): male protagonist; retired MI6 secret agent."
- Character names, roles, and relations are not yet proliferating according to the VAA1 maturity plan. The next pass should find character names, role descriptions, and relations to the extent possible, then route them through Master Schema maturity before surfacing them in Source Media, Scene Cards, Identification, and linked-data views.
- Scraped character roles should feed Primary Metadata and Master Schema maturity routes deliberately.
- External metadata sources should support source preference and confirmation before overwriting curated manual fields.
- Backend startup is still too slow due heavy imports/model initialization; consider a light API boot path and lazy-load analysis stack.

## Next Pass: Dramatic Character Archetypes

VAA1 should aim to deliver practical synthesis of dramatic character archetypes drawn from major dramaturgical traditions, operationalized as interpretive multimodal analysis categories.

The key idea: VAA1 should not treat archetypes as rigid literary labels. They should be probabilistic narrative functions, situational roles, relational positions, rhetorical behaviors, and evolving dramaturgical trajectories.

## Narrative Agent Profile Boundary

VAA1 should deliver Narrative Agent Profiles only. It should not build Natural Person Identity Profiles.

The analytic target is the media-internal narrative agent: how the agent appears, speaks, acts, relates, transforms, occupies status, carries plot function, and leaves multimodal evidence across the source artifact.

Actor, performer, speaker, or production metadata may be attached as source metadata, but those records are not the identity object being analyzed.

This boundary is especially important when dramatic archetypes surface in the profile. VAA1 should not say "this person is Hamlet" or "this person is Iago." It should say, for example:

- high resemblance to a tragic hesitation pattern
- operator-function signals in alliance and rhetoric shifts
- fool-mediated truth dynamic
- legitimacy collapse dynamic
- public role/private self tension

The system should preserve the route:

```text
evidence -> interaction pattern -> dramaturgical function -> optional interpretive modality
```

That makes the profile explainable, revisable, and academically defensible.

## Shakespearean Modality For Narrative Agent Profiles

The Shakespearean question is not merely:

```text
What archetype is this character?
```

The stronger VAA1 question is:

```text
How is identity performed, destabilized, revealed, concealed, inverted, or transformed through interaction?
```

This should become a high-level interpretive ontology for human interaction dynamics, not a decorative literary label.

Operational layers:

- Character modes: tragic hero, political operator, fool, shapeshifting role, Falstaffian vitality, melancholic intellectual, tyrant, sage.
- Relational dynamics: loyalty/betrayal, appearance/reality, desire/duty, love/power, public role/private self, madness/insight, authority/legitimacy, order/chaos, wit/violence, intimacy/manipulation.
- Speech modes: soliloquy/self-reflection, repartee/wit combat, public performance speech, irony, metaphor density.
- Scene modes: court intrigue, comic misrecognition, confession, seduction, betrayal, madness, ritual/coronation, duel, tavern/social release, death/existential closure.
- Status dynamics: ascent, humiliation, legitimacy, symbolic authority, loss of face, destabilization.
- Polyphony: competing moral universes inside one interaction space, such as idealist, cynic, pragmatist, romantic, nihilist, loyalist.

Implementation principle:

VAA1 should not operationalize archetypes as identities. It should operationalize dramaturgical tendencies, interactional functions, and scene dynamics. Suggested modalities must always expose the underlying evidence: contradiction frequency, coalition shifts, indirect commands, emotional asymmetry, interruption asymmetry, status movement, turn rhythm, vocal certainty, gaze hierarchy, and other measurable traces.

Recommended representation:

```text
Person X:
- 0.72 Mentor
- 0.61 Sage
- 0.55 Gatekeeper
- 0.48 Bureaucrat

Scene:
- rising antagonism
- unstable authority
- comic tension
- sacrificial framing
```

### Core Dramatic Function Archetypes

Structural narrative functions:

- Protagonist: central agency carrier; screen time, conversational centrality, goal pursuit.
- Antagonist: obstacle or opposition force; conflict language, interruption, contradiction.
- Deuteragonist: secondary lead; alliance behavior and shared mission.
- Tritagonist: third balancing role; mediation and triangulation.
- Supporting Character: contextual support role with low narrative initiative.
- Foil: contrasting mirror; opposing traits and rhetorical inversion.
- Confidant: receives private information; intimacy and disclosure scenes.
- Love Interest: romantic or erotic gravitational role; flirtation, gaze, proximity.
- Rival: competitive mirror; dominance contest.
- Catalyst: triggers change; event transition proximity.
- Chorus Figure: collective commentary; audience framing and moral commentary.
- Witness: observes key events; low intervention, high perceptual presence.
- Sacrificial Figure: bears system cost; suffering concentration.
- False Hero: appears heroic but fails morally; reputation/action mismatch.
- Shadow Figure: embodies suppressed traits; taboo, secrecy, projection.
- Trickster: disrupts structure through ambiguity; humor and unpredictability.
- Mentor / Sage: provides orientation or wisdom; explanatory discourse.
- Threshold Guardian: controls access; permission logic and gatekeeping.
- Herald: announces transformation; alerts and revelations.
- Innocent: moral or experiential purity; naivete signals.
- Outcast: marginalized social position; exclusion markers.
- Rebel: challenges norms; anti-authority discourse.
- Tyrant: coercive authority; command density and punishment.
- Caregiver: maintains emotional/social cohesion; soothing language.
- Tempter: pulls others toward risk/desire; seduction and manipulation.

### Jungian / Mythic Archetypes

Useful for symbolic analysis through language, visual motifs, costume/color patterns, repeated emotional framing, and dreamlike narrative structures:

- Hero
- Shadow
- Anima / Animus
- Wise Old Man / Wise Woman
- Great Mother
- Eternal Child
- Trickster
- Persona
- Self

### Campbellian Journey Roles

Useful for long-form narrative trajectory detection, transition phases, transformation arcs, and threshold crossings:

- Hero
- Mentor
- Ally
- Threshold Guardian
- Herald
- Shapeshifter
- Shadow
- Trickster

### Comedic Archetypes

Important because tragedy-only models fail in social media and documentary analysis:

- Fool
- Clown
- Buffoon
- Straight Man
- Schemer
- Parasite
- Braggart
- Cynic
- Romantic Idealist
- Social Climber
- Absurd Bureaucrat
- Fish Out of Water

Detection signals include laughter synchronization, contradiction between competence claims and outcomes, irony markers, and social embarrassment events.

### Melodramatic / Political Archetypes

Useful for political speeches, activism, news, propaganda, and institutional narratives:

- Victim
- Oppressor
- Savior
- Martyr
- Corrupt Elite
- Revolutionary
- Bureaucratic Machine
- Whistleblower
- Prophet
- Moral Crusader
- Scapegoat

These map into rhetorical framing, emotional mobilization, and collective identity construction.

### Social Power Archetypes

Useful for real-world interaction analysis:

- Alpha / Dominant: interruption success, spatial control.
- Diplomat: conflict mediation.
- Seducer: attraction signaling.
- Controller: agenda enforcement.
- Servant: low-status compliance.
- Performer: attention attraction.
- Intellectual: abstraction density.
- Bureaucrat: procedural orientation.
- Visionary: future-oriented language.
- Operator: tactical manipulation.
- Caretaker: emotional maintenance.
- Predator: coercive targeting.

These are important for meetings, negotiations, interviews, podcasts, political events, and relationship analysis.

### Relational Dramatic Dynamics

VAA1 should detect archetype relations, not only isolated individuals:

- Mentor <-> Apprentice
- Tyrant <-> Rebel
- Seducer <-> Resister
- Hero <-> Shadow
- Caregiver <-> Dependent
- Rival <-> Rival
- Trickster <-> Institution
- Prophet <-> Crowd
- Scapegoat <-> Collective

Dramatic meaning often emerges from interaction topology.

### Multimodal Detection Layers

- Linguistic: speech acts, modality, commands, valence, certainty, metaphors, rhetorical style, interruption patterns.
- Visual: framing centrality, posture, costume, color symbolism, gaze, movement dominance, spatial hierarchy.
- Audio: prosody, intensity, hesitation, dominance, laughter, silence, vocal warmth/coldness.
- Interaction: turn-taking, alliance formation, conflict frequency, audience attention.
- Narrative: transformation, revelation, sacrifice, threshold crossing, reversal, collapse, redemption.

### Deployment Priority

Phase 1, high detectability:

- protagonist
- antagonist
- mentor
- rival
- fool
- authority
- victim
- caregiver
- rebel
- bureaucrat

Phase 2, relational dynamics:

- mentor-apprentice
- dominance hierarchy
- alliance structures
- seduction dynamics
- scapegoating
- coalition formation

Phase 3, advanced symbolic models:

- shadow projection
- mythic transformation
- tragic inevitability
- comic reversal
- ideological archetypes
- symbolic motifs

### Theoretical Foundations

Recommended synthesis for VAA1:

- Aristotle: structural drama.
- Carl Jung: symbolic archetypes.
- Joseph Campbell: transformational journeys.
- Erving Goffman: social performance.
- Kenneth Burke: dramatism.
- Mikhail Bakhtin: polyphony/dialogism.
- David Boje: antenarrative emergence.
- Victor Turner: liminality/social drama.

This combination gives classical structure, symbolic depth, interaction sociology, emergent narrative dynamics, and real-world applicability.
