# VAA1 composition design note

Date: 2026-04-06

## Why composition needs a dedicated design

Composition is not just where the largest object sits.

In VAA1, composition should be understood as a relation among:

- subject placement
- frame balance
- text and graphic occupation
- empty space
- foreground / background distribution
- shot continuity

If composition is reduced to a single center-weight calculation, the result becomes brittle and misleading across:

- news studio footage
- archive material
- multi-subject footage
- graphic-led frames
- degraded sources

## What composition should do in VAA1

The first composition layer should answer modest but useful questions:

- is the frame center-weighted?
- left-weighted?
- right-weighted?
- text-led?
- balanced or dispersed?

These are already useful for research and far safer than stronger cinematic claims too early.

## Recommended three-layer design

### Layer A: deterministic baseline

Start with a rule-based baseline using:

- left / center / right occupancy
- upper / middle / lower occupancy
- person placement
- text/graphic placement
- empty-space balance

This baseline should remain:

- explainable
- fast
- inspectable
- correction-friendly

### Layer B: learned composition support

After the baseline is stable, a learned layer can be added to support harder cases such as:

- strongly asymmetric framing
- human-plus-graphic news layouts
- frames with conflicting occupancy signals

This layer should not replace the baseline at first.

It should operate as:

- corroborating functionary
- disagreement detector
- calibration aid

### Layer C: temporal arbitration

Composition should not be decided by one arbitrary sampled frame.

Temporal arbitration should:

- smooth within-shot variation
- preserve short layout shifts when meaningful
- ignore transition noise
- produce one shot-level composition reading plus optional local variation notes

## Recommended VAA1 process

### Phase 1: spatial occupancy baseline

Build composition from existing substrate signals:

- margin scan
- spatial scan
- text/graphic scan
- human presence
- depth scan

This gives a shot-local composition evidence array.

### Phase 2: layout weighting

For each sampled frame or shot sample:

- estimate left / center / right mass
- estimate text-ledness
- estimate human centrality
- estimate dispersion vs concentration

Output:

- composition evidence tuple per sample

### Phase 3: baseline label assignment

Initial labels:

- center-weighted
- left-weighted
- right-weighted
- text-led
- balanced or dispersed
- human-centered

These are descriptive enough to be useful without overshooting.

### Phase 4: shot-level arbitration

Within each shot:

- smooth momentary layout fluctuation
- suppress one-frame anomalies
- preserve major layout transitions if sustained

Output:

- shot-level composition label
- confidence
- support notes

### Phase 5: multi-functionary corroboration

Composition claims should later be checked against:

- shot continuity
- subject arrangement
- text/graphic distribution
- transition structure
- analyst override

## Lean delivery recommendation

Composition is a good early cinematic clue because it can be built largely from the substrate already present.

Recommended order:

1. deterministic composition baseline
2. shot-level smoothing
3. correction hooks
4. optional learned support only if needed

This keeps the system lean and explainable.

## Estimated effort

### Baseline composition MVP

Expected work:

- spatial weighting rules
- text/human weighting rules
- shot-level smoothing
- storage and UI output

Estimated effort:

- approximately 3 to 6 focused development days

### Learned composition support

Expected work:

- collect or align benchmark material
- define task taxonomy for VAA1
- integrate model as support layer only

Estimated effort:

- approximately 1 to 3 additional weeks

## Immediate VAA1 recommendation

Do not escalate composition into strong cinematic language yet.

Instead:

1. keep composition descriptive
2. make it shot-bounded
3. let it draw from existing substrate
4. use overrides and later traceback to refine it

## Relation to constellational support

Composition should emerge from patterned support among:

- subject placement
- text/graphic position
- occupancy balance
- empty-space relation
- shot continuity

That makes the result more robust than a single center-of-mass shortcut and better suited to VAA1’s mixed-source material.
