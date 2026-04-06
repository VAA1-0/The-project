# VAA1 camera angle design note

Date: 2026-04-06

## Why camera angle needs care

Camera angle is easy to overclaim.

In VAA1, camera angle should not be treated as a simple visual label attached to any frame with a visible person.

It is a relation among:

- camera height relative to subject
- subject pose
- head and body orientation
- horizon or architectural cues
- crop and framing
- shot continuity

If these are not considered together, the system will confuse:

- close framing with low angle
- partial crop with high angle
- subject pose with camera position
- degraded footage with perspective cues

## What VAA1 should detect first

The first useful angle layer should stay modest.

Initial labels should be:

- eye-level
- high-angle tendency
- low-angle tendency
- angle unclear

That is safer than early claims such as:

- overhead
- worm's-eye
- Dutch angle

unless the evidence is genuinely strong.

## Recommended three-layer design

### Layer A: deterministic baseline

Start with a rule-based baseline using:

- face position in frame
- body landmarks or pose orientation
- relative head-to-body geometry
- dominant subject vertical placement
- horizon or dominant line cues when available

This baseline should remain:

- explainable
- inspectable
- correction-friendly

### Layer B: learned angle support

After the baseline is stable, add a learned support layer only if it clearly improves robustness on VAA1 material.

This layer can help with:

- ambiguous subject pose
- partial visibility
- more complex perspective cues
- non-ideal archive material

But it should operate first as:

- corroborating functionary
- disagreement detector
- calibration aid

### Layer C: temporal arbitration

Camera angle should be stabilized across the shot.

Temporal arbitration should:

- smooth one-frame anomalies
- suppress pose-driven false shifts
- preserve real angle change if sustained
- carry uncertainty when cues disagree

## Recommended VAA1 process

### Phase 1: shot-bounded precondition

Evaluate camera angle inside shot containers, not across transitions.

This prevents:

- edit-driven angle confusion
- mixed-angle aggregation
- unstable frame-by-frame jumping

### Phase 2: subject-relative geometry

For each sampled frame, estimate:

- dominant subject
- visible body proportion
- head and shoulder placement
- subject vertical relation to frame center
- global line cues if available

Output:

- angle evidence tuple per sample

### Phase 3: baseline angle assignment

Assign modest labels:

- eye-level
- high-angle tendency
- low-angle tendency
- angle unclear

These labels should remain descriptive and reversible.

### Phase 4: shot-level arbitration

Across the shot:

- smooth transient uncertainty
- privilege stable angle evidence
- preserve ambiguity where needed

Output:

- shot-level angle label
- confidence
- support notes

### Phase 5: stronger special classes later

Only after the baseline is stable should VAA1 attempt:

- overhead
- extreme low-angle
- Dutch angle

Those should require much stronger support.

## Lean delivery recommendation

Camera angle should not be one of the first cinematic cues to operationalize fully.

Recommended order:

1. transition detection
2. shot containers
3. shot size baseline
4. movement baseline
5. composition and subject arrangement
6. then camera angle baseline

This is because angle depends heavily on:

- stable shot segmentation
- reliable subject detection
- more than one geometric cue

## Estimated effort

### Baseline angle MVP

Expected work:

- subject-relative geometry rules
- pose or landmark support
- shot-level smoothing
- UI and storage output

Estimated effort:

- approximately 4 to 9 focused development days

### Learned support layer

Expected work:

- benchmark selection
- perspective classification support
- validation on mixed-source VAA1 footage

Estimated effort:

- approximately 1 to 3 additional weeks

## Immediate VAA1 recommendation

Add camera angle to the design process now, but do not rush it into the operational cue set as if it were easy.

Instead:

1. keep it in the design sequence
2. let it follow shot segmentation and subject geometry
3. treat early results as provisional

## Relation to constellational support

Camera angle should emerge from patterned support among:

- subject geometry
- pose landmarks
- framing
- line/horizon cues
- shot continuity

That makes angle more robust, more explainable, and less likely to drift into false stylistic certainty on mixed-source material.
