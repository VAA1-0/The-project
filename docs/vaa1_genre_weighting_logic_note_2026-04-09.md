# VAA1 Genre Weighting Logic Note

Date: 2026-04-09
Status: working note for human readers
Scope: explain how genre and situational weighting affects interpretation in VAA1

## 1. Why this note exists

VAA1 does not treat genre as decoration. It treats genre and situation as interpretive conditions.

That means the same visible cue may carry different interpretive weight in:

- news
- documentary
- drama
- vlog
- webconference
- institutional communication
- archive footage

This note explains that logic in plain language.

## 2. What weighting means

Weighting does not replace the original detector output.

Instead, it changes how much interpretive emphasis VAA1 gives to different candidate readings once context is known.

So weighting means:

- keep the base score visible
- apply contextual multipliers
- compare the weighted alternatives
- keep ambiguity visible when the margin is small

It is a reading aid, not a truth machine.

## 3. Why genre matters

The same expression or behavior does not mean the same thing everywhere.

Examples:

- a serious face in news may support credibility or institutional authority
- a serious face in drama may support tension, restraint, or plot suspense
- a warm expression in a vlog may be more typical and less exceptional than in a newscast
- an emphatic delivery in a campaign message may be persuasive rather than simply emotional

So genre is not an afterthought. It is part of how meaning is stabilized.

## 4. Why situational context matters

Genre alone is not enough.

A clip also needs situational context, such as:

- briefing
- confrontation
- celebration
- confession
- interview
- routine coordination
- intimate interaction

And often also:

- private / semi-public / public
- professional / mixed / lay

These contextual conditions influence how a cue should be interpreted.

## 5. The logic of the weighting frame

The current weighting frame works by combining:

- media genre
- genre subtype
- situational genre
- situational subtype
- privacy axis
- expertise axis

In simple terms:

`weighted score = base score × context weights`

This allows VAA1 to say:

- the raw reading is still visible
- but under this genre and situation, some readings are more plausible than others

## 6. Example

Imagine the same base signal appears in two cases:

Case A:
- news
- studio anchor read
- briefing
- public
- professional

Case B:
- vlog
- personal update
- private
- lay / non-professional

The same visible seriousness should not be weighted in exactly the same way in both cases.

In Case A, VAA1 may weight:

- serious
- formal_neutral
- composed
- authoritative

more strongly.

In Case B, VAA1 may allow more emphasis on:

- warm
- amused
- reflective
- emphatic

depending on the surrounding evidence.

## 7. Why this should remain contestable

Genre weighting should never become invisible dogma.

Reasons:

- genres mix
- genres shift inside the same recording
- ironic or parodic use may reverse expectations
- documentary can borrow drama
- news can borrow suspense
- webcalls can imitate television formats

So weighting must remain:

- visible
- adjustable
- revisable
- open to correction

## 8. Mixed and intertextual genres

Genre is often hybrid.

A single recording may contain:

- news + drama-like suspense
- archive + commentary remix
- documentary + promotional styling
- webconference + talk-show conventions

This is not only a technical nuisance. It can be analytically meaningful.

That is why VAA1 should later support:

- primary genre
- secondary genre
- situational primary
- situational secondary
- intertextual mix notes

So mixed genre should become visible rather than suppressed.

## 9. Human correction and learning

Genre weighting becomes more valuable when users can correct the context directly.

If analysts can adjust:

- media genre
- genre subtype
- situational genre
- situational subtype
- privacy
- expertise

then VAA1 gains:

- better immediate interpretation
- better traceability
- better training data for the learning module

So correction is not separate from weighting. It is part of its refinement path.

## 10. Practical reading order

For human readers, the safest order is:

1. inspect the raw detector output
2. inspect the ontology interpretation
3. inspect the active context axes
4. inspect the applied weights
5. inspect the weighted reading
6. check whether a runner-up remains close

This keeps weighting transparent.

## 11. Summary principle

Genre weighting in VAA1 should be understood as:

- context-sensitive interpretation
- not replacement of raw evidence
- not automatic truth
- not hidden behind the interface

Its purpose is to help VAA1 read audiovisual meaning more honestly by acknowledging that cues are interpreted differently in different media and situations.
