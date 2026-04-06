# VAA1 transition detection design note

Date: 2026-04-06

## Why transition detection must come first

Transition detection is a prerequisite for robust cinematic analysis in VAA1.

Without dependable transition detection:

- shot size drifts across edits
- movement readings blend unrelated shots
- composition is aggregated across discontinuities
- subject continuity is overstated
- temporal arbitration becomes unreliable

So for VAA1, transition detection is not an optional flourish.

It is a foundational segmentation step.

## What transition detection should do in VAA1

At minimum, the transition layer should:

1. identify likely shot boundaries
2. separate hard cuts from softer changes when possible
3. preserve timestamps
4. provide confidence
5. expose support traces for later traceback

The purpose is not only to detect edits for their own sake, but to create:

- shot-bounded units
- reliable temporal containers
- more meaningful cinematic inference

## Recommended design for VAA1

### Layer A: rule-based baseline

Start with a deterministic baseline using:

- frame-difference measures
- histogram change
- luminance change
- color/tone mass change
- OCR mass change
- subject occupancy change

This baseline should be explainable and fast enough for lean environments.

Output should include:

- timestamp
- transition flag
- transition strength
- probable type

Probable type can begin modestly:

- possible cut
- possible dissolve/fade
- continuity stable

### Layer B: scene-cut model support

After the baseline is stable, add a learned cut detector.

Candidates previously discussed as license-compatible options include:

- PySceneDetect
- TransNet V2

Recommended position:

- baseline first
- model second
- arbitration third

The learned layer should function as:

- corroborating functionary
- disagreement detector
- performance upgrade on difficult footage

### Layer C: temporal arbitration

Do not let one raw spike alone declare a transition.

Temporal arbitration should:

- smooth very short spikes
- allow uncertainty windows
- distinguish abrupt change from motion-heavy continuity
- carry forward the strongest supported boundary

This matters especially in:

- handheld material
- degraded archives
- rapid news graphics
- footage with overlay churn
- scene motion without editing

## Recommended VAA1 process

### Phase 1: local frame-change measures

For sampled or continuous frames, compute:

- pixel/frame difference
- brightness shift
- tone distribution shift
- occupancy shift
- text/graphic shift

This creates a basic transition evidence array.

### Phase 2: support clustering

At each candidate timestamp, cluster support from:

- frame difference
- color/tone shift
- OCR/graphic change
- subject occupancy change

This step should already align with constellational support.

No single metric should decide a transition alone where avoidable.

### Phase 3: candidate transition labeling

Initial labels:

- continuity stable
- possible cut
- possible dissolve/fade

These should remain modest until a stronger segmentation regime exists.

### Phase 4: shot container creation

Once boundaries are accepted, build:

- shot id
- shot start
- shot end
- transition-in
- transition-out
- shot-local evidence references

This shot container is what later powers:

- shot size
- movement
- composition
- subject continuity
- traceback

### Phase 5: model corroboration

Once the deterministic baseline is working, test model support.

Recommended process:

1. benchmark baseline on mixed-source clips
2. benchmark PySceneDetect or TransNet V2
3. compare disagreement cases
4. keep the smaller and more robust addition first

### Phase 6: arbitration and confidence

Transition output should include:

- primary boundary decision
- confidence
- supporting functionaries
- uncertainty note when needed

## Lean delivery recommendation

Because VAA1 must remain lean, the recommended order is:

1. deterministic transition baseline
2. evaluation on real VAA1 material
3. optional learned model addition only if baseline is insufficient

This avoids:

- premature dependency weight
- double integration work
- false precision from a model that is not yet calibrated to VAA1 footage

## Estimated effort

### Baseline transition MVP

Expected work:

- implement change metrics
- design threshold logic
- create shot container schema
- surface timestamps and summary
- test on mixed footage

Estimated effort:

- approximately 3 to 6 focused development days

### Model-supported transition layer

Expected work:

- evaluate PySceneDetect and/or TransNet V2
- compare performance against VAA1 footage
- integrate only if it clearly improves robustness

Estimated effort:

- approximately 4 to 10 focused development days

### Arbitration and traceback readiness

Expected work:

- disagreement handling
- confidence logic
- support-array storage
- shot-boundary provenance

Estimated effort:

- approximately 2 to 5 focused development days

## Immediate VAA1 recommendation

Do not keep relying on crude transition hints as if they are enough.

Instead:

1. deliver a true transition baseline
2. make shot containers first-class analysis units
3. let shot-size and other cinematic clues consume those containers
4. only then decide what kind of model support is truly needed

## Relation to constellational support

Transition detection should not be a one-metric switch.

For VAA1, a transition becomes meaningful when multiple functionaries converge, such as:

- frame difference
- tone shift
- occupancy change
- text/graphic change
- temporal pattern

That makes transition detection:

- more robust
- more explainable
- more suitable for mixed-source research material

and it creates the proper basis for later cinematic reasoning.
