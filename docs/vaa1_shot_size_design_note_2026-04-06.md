# VAA1 shot-size design note

Date: 2026-04-06

## Why the current heuristic is insufficient

Shot size is not only a vision problem.

In VAA1, shot size should be understood as a relation among:

- subject size
- framing
- crop
- number of people
- shot continuity

Pure end-to-end classifiers can perform well on benchmark material, but VAA1 is meant for:

- mixed genres
- news
- archives
- research footage
- user video
- degraded material

Because of that, the most robust design is not a single-frame or single-model shortcut.

## Robust design direction

The preferred VAA1 design is:

1. segment video into shots
2. sample representative frames inside each shot
3. detect the dominant subject or subjects
4. estimate subject-to-frame proportion
5. map that proportion to a shot-size ontology
6. smooth decisions across the shot
7. store the result with timestamps, confidence, and traceback links

## Three-layer tool design

### Layer A: rule-based baseline

Start with a deterministic baseline that uses:

- person detection
- face detection
- pose landmarks

This gives VAA1:

- a working MVP quickly
- explainable behavior
- inspectable failure modes
- a correction-friendly base

MediaPipe Pose Landmarker is useful here because it can help estimate:

- how much of the body is visible
- how the subject sits in the frame
- whether the framing is upper-body, waist-up, full-body, or partial crop

The baseline output should always remain:

- timestamped
- shot-bounded
- confidence-scored
- linked to source detections

### Layer B: learned classifier

After the baseline works, add a learned shot-scale classifier.

Candidate data references for this layer:

- MovieShots
- CineScale

MovieShots can support:

- scale labels
- movement context
- shot-level supervision

CineScale can support:

- broader shot-scale taxonomy
- frame-level shot-size annotation
- validation against finer granularity

The learned layer should not replace the baseline completely.

Instead, it should function as:

- corroborating functionary
- arbitration input
- calibration aid

### Layer C: temporal arbitration

Single frames should not decide the label.

Temporal arbitration should:

- smooth labels across a shot
- penalize single-frame spikes
- privilege shot continuity
- allow short uncertainty windows near edits
- produce one shot-level label plus optional local variation notes

This layer is essential for mixed-source footage where:

- individual detections fluctuate
- degraded material creates noisy boxes
- presenter cuts and inserts interrupt visual continuity

## Recommended process description for VAA1

### Phase 1: shot segmentation

Deliver a dependable shot boundary stage first.

Output:

- shot id
- shot start
- shot end
- transition type hint when available

### Phase 2: representative frame sampling

Inside each shot, sample frames:

- near start
- near middle
- near end
- plus optional extra samples for longer shots

Output:

- representative frame timestamps
- shot-local sample set

### Phase 3: dominant subject estimation

For each sampled frame, identify:

- number of people
- dominant person
- face visibility
- pose/body visibility
- subject centrality

Output:

- dominant subject candidate
- subject proportion estimate
- multi-subject flag
- framing confidence

### Phase 4: ontology mapping

Map the sampled subject proportion and body visibility to a shot-size ontology.

Initial ontology can include:

- extreme close-up
- close-up
- medium close-up
- cowboy shot
- medium shot
- long shot
- extreme long shot
- no human framing

### Phase 5: temporal arbitration

Across sampled frames inside the same shot:

- smooth unstable readings
- suppress outliers
- preserve uncertainty where evidence conflicts

Output:

- primary shot-size label
- confidence
- alternates if needed
- support notes

### Phase 6: storage and traceback

Persist:

- shot id
- timestamps
- label
- confidence
- support arrays
- correction hooks
- traceback links

This is important because shot-size in VAA1 should later participate in:

- manual annotation
- analyst override
- traceback
- calibration
- constellational support

## What it likely takes to deliver

### Layer A: baseline MVP

Expected work:

- shot segmentation integration
- rule design for subject proportion
- pose/face support integration
- ontology mapping
- confidence logic
- storage schema
- UI surfacing
- correction path

Estimated effort:

- approximately 5 to 10 focused development days

This depends on:

- whether shot segmentation is already in place
- whether MediaPipe or equivalent is adopted
- how much degraded footage must be tolerated in the first release

### Layer B: learned classifier

Expected work:

- dataset selection and taxonomy alignment
- annotation/schema reconciliation
- training or fine-tuning pipeline
- evaluation on VAA1-relevant material
- integration as second-layer support

Estimated effort:

- approximately 2 to 5 weeks for a first serious delivery

This can extend if:

- model licensing or redistribution is complex
- VAA1 footage diverges strongly from benchmark datasets
- extra validation across archives and news footage is required

### Layer C: temporal arbitration

Expected work:

- shot-local smoothing logic
- arbitration rules across baseline and learned outputs
- confidence and uncertainty policy
- storage and traceback integration

Estimated effort:

- approximately 3 to 7 focused development days after Layers A and B are materially available

## Recommended immediate next step

Do not keep pushing the current bbox-only shot-size heuristic as if it were enough.

Instead:

1. treat the current version as provisional
2. keep the navigable tool surface
3. deliver shot segmentation as a prerequisite
4. build the Layer A deterministic baseline properly
5. use that baseline as the ground for later learned support

## Relation to method

This design aligns with VAA1's constellational-support direction.

Shot size should not be produced as a single detached cue.

It should emerge from a patterned relation among:

- visual subject evidence
- pose evidence
- face evidence
- shot continuity
- transition structure
- temporal smoothing
- later analyst correction

That makes it more robust, more explainable, and more suitable for mixed-source research use than a single-model shortcut.
