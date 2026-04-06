# VAA1 camera movement design note

Date: 2026-04-06

## Why camera movement needs its own design

Camera movement is not the same thing as scene motion.

In VAA1, a robust movement reading must distinguish among:

- camera movement
- subject movement
- background movement
- edit-driven discontinuity
- graphic or overlay churn

If these are not separated, the system quickly overstates motion and produces misleading cinematic claims.

## What VAA1 should detect first

The first useful movement layer should remain modest.

Initial labels should be:

- mostly static
- mild motion or reframing
- strong camera or scene motion

These are operationally useful without overclaiming.

Only later should VAA1 try to separate:

- pan
- tilt
- zoom
- push-in / pull-out
- handheld instability
- tracking motion

## Recommended three-layer design

### Layer A: deterministic baseline

Start with a rule-based baseline using:

- optical flow or frame displacement
- subject box displacement
- background shift
- horizon or frame-edge drift when available
- transition filtering

The goal is to detect whether the frame is:

- stable
- reframing slightly
- moving strongly

This baseline should also try to answer:

- is movement global across the frame?
- is movement mostly localized to subjects?

That distinction is central.

### Layer B: learned motion classifier

After the baseline works, add a learned movement classifier only if it clearly improves performance on VAA1 material.

Possible future classes:

- pan-like
- tilt-like
- zoom-like
- handheld-like
- tracking-like

But these should not be promised early.

The learned layer should serve as:

- corroborating functionary
- disagreement detector
- calibration aid

### Layer C: temporal arbitration

Movement should never be decided by a single frame pair.

Temporal arbitration should:

- smooth transient spikes
- ignore transition windows
- distinguish continuous movement from brief disruption
- preserve uncertainty where signals disagree

This is necessary because:

- scene cuts can mimic motion
- overlays can mimic camera shift
- subject motion can mimic reframing

## Recommended VAA1 process

### Phase 1: transition-aware preconditioning

Before movement analysis, exclude or bracket:

- cuts
- dissolves
- fades

Movement should be evaluated inside shot containers, not across transitions.

### Phase 2: motion evidence arrays

Within each shot, compute:

- frame-to-frame displacement
- global motion estimate
- dominant-subject displacement
- occupancy change
- background consistency

Output:

- shot-local movement evidence array

### Phase 3: baseline label assignment

From the evidence array, assign:

- mostly static
- mild motion or reframing
- strong camera or scene motion

At this stage, `camera or scene motion` is intentionally combined if the system cannot yet separate them confidently.

### Phase 4: subject-vs-camera separation

Once the baseline is stable, begin separating:

- subject-led motion
- camera-led motion
- mixed motion

This should use:

- dominant subject tracking
- background consistency
- text/graphic stability
- frame-edge behavior

### Phase 5: temporal arbitration

Produce a shot-level movement reading with:

- primary label
- confidence
- support notes
- uncertainty marker when appropriate

## Lean delivery recommendation

VAA1 should first ship a dependable movement baseline rather than a rich motion taxonomy.

Recommended order:

1. transition-aware movement baseline
2. subject-vs-camera separation
3. optional finer movement classes

This keeps the system lean and reduces false confidence.

## Estimated effort

### Baseline movement MVP

Expected work:

- movement evidence arrays
- transition-aware filtering
- label thresholds
- shot-level smoothing
- UI and storage support

Estimated effort:

- approximately 4 to 8 focused development days

### Subject-vs-camera separation

Expected work:

- dominant subject tracking improvement
- background shift logic
- disagreement handling

Estimated effort:

- approximately 3 to 7 focused development days

### Finer movement taxonomy

Expected work:

- add pan / tilt / zoom / handheld-like classes
- benchmark against mixed-source VAA1 material
- integrate only if accuracy justifies the extra complexity

Estimated effort:

- approximately 1 to 3 additional weeks

## Immediate VAA1 recommendation

Do not jump straight to named camera movements.

Instead:

1. make movement shot-bounded
2. separate transition effects from within-shot motion
3. produce a stable baseline movement reading
4. only then attempt finer movement categories

## Relation to constellational support

Camera movement should emerge from patterned support among multiple functionaries, such as:

- frame displacement
- subject displacement
- background coherence
- transition context
- shot continuity

That makes movement:

- more explainable
- less brittle
- more suitable for mixed-source research footage

and prevents the system from mistaking any visible change for cinematic camera motion.
