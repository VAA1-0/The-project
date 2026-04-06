# VAA1 subject arrangement design note

Date: 2026-04-06

## Why subject arrangement needs a distinct layer

Subject arrangement is not the same thing as composition, and it is not reducible to person count alone.

In VAA1, subject arrangement should capture relations such as:

- single-subject
- multi-subject
- human-plus-graphic
- text-dominant
- scene-dominant

This is useful because many research and broadcast frames are organized around:

- presenter plus screen
- presenter plus lower-third
- crowd vs single speaker
- graphic takeover
- scene without dominant human subject

## What subject arrangement should do in VAA1

The first subject-arrangement layer should answer:

- how many relevant subjects are present?
- is one subject dominant?
- is the frame text/graphic-led rather than human-led?
- is the frame scene-led with no dominant human subject?

These are strong descriptive cues for later cinematic and discourse reasoning.

## Recommended three-layer design

### Layer A: deterministic baseline

Start with a rule-based baseline using:

- person count
- person prominence
- text mass
- graphic mass
- occupancy spread
- subject centrality

This layer should remain simple enough to inspect and correct.

### Layer B: learned arrangement support

After the baseline is stable, add learned support only if it clearly improves cases such as:

- overlapping people
- person-plus-screen ambiguity
- mixed crowd and signage scenes
- degraded archive footage

The learned layer should act as:

- corroborating functionary
- disagreement detector
- calibration aid

### Layer C: temporal arbitration

Subject arrangement should be stabilized across the shot.

Temporal arbitration should:

- suppress one-frame subject count spikes
- distinguish sustained arrangement from momentary intrusion
- preserve meaningful arrangement change within the shot if sustained

## Recommended VAA1 process

### Phase 1: subject evidence collection

Collect:

- person detections
- dominant person estimate
- text/graphic presence
- occupancy mass
- depth hints

### Phase 2: baseline arrangement logic

Assign provisional labels such as:

- single-subject
- multi-subject
- human-plus-graphic
- text-dominant
- scene-dominant
- dispersed or low-activity

These should remain descriptive rather than interpretively inflated.

### Phase 3: shot-level arbitration

Within each shot:

- smooth transient changes
- suppress false multi-subject spikes
- preserve genuine arrangement change if it lasts

Output:

- shot-level subject arrangement
- confidence
- support notes

### Phase 4: relation to other cinematic cues

Subject arrangement should later feed:

- composition
- shot size
- movement interpretation
- discourse and role reasoning

It is especially useful for:

- presenter footage
- interviews
- debates
- lecture recordings
- screen-led broadcasts

## Lean delivery recommendation

Subject arrangement is a good near-term cinematic clue because it can be built from the substrate already present.

Recommended order:

1. deterministic subject-arrangement baseline
2. shot-level smoothing
3. correction and traceback preparation
4. optional learned support later

## Estimated effort

### Baseline subject-arrangement MVP

Expected work:

- prominence rules
- text/human balancing rules
- shot-level smoothing
- storage and UI output

Estimated effort:

- approximately 2 to 5 focused development days

### Learned support layer

Expected work:

- harder ambiguity handling
- validation across mixed-source footage
- integration as a support layer

Estimated effort:

- approximately 1 to 2 additional weeks

## Immediate VAA1 recommendation

Keep subject arrangement as a descriptive, shot-bounded layer.

Do not yet convert it into richer social or narrative claims.

Instead:

1. use it to stabilize cinematic interpretation
2. use it to support later multimodal reasoning
3. connect it to correction and traceback as the workflow matures

## Relation to constellational support

Subject arrangement should emerge from patterned support among:

- person presence
- person prominence
- text/graphic dominance
- occupancy distribution
- shot continuity

That makes it more robust than any single count or box heuristic and better suited to VAA1’s mixed-source mission.
