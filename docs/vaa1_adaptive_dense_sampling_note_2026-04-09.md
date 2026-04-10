# VAA1 Adaptive Dense Sampling Note

Date: 2026-04-09

## Purpose

This note records a key finding from testing action-oriented trailer material in VAA1:

- fixed sparse object-detection sampling at `1.0s` is too coarse for fast-cut audiovisual material
- this causes human targets to be missed or only weakly detected
- the problem is especially visible in trailers, action scenes, interior car shots, and other cinematic sequences with:
  - short shot duration
  - partial occlusion
  - glare or reflections
  - strong grading / low contrast
  - rapid reframing

The aim is to replace overly sparse fixed sampling with a more cinema-appropriate adaptive scheme.

## Current Problem

In the current `science_scan` profile, object detection runs at:

- `detection_interval_seconds = 1.0`

For a 24 fps trailer, this means VAA1 may inspect roughly one frame out of every twenty-four.

That is acceptable for:

- broad metadata-like inventory
- slow documentary material
- coarse scene overview

But it is not acceptable for:

- protagonist-presence reliability
- action trailer analysis
- fast montage sequences
- robust object continuity
- accurate human tracking across short shots

## Proposed Direction

VAA1 should move from:

- fixed sparse sampling

to:

- adaptive dense sampling

This means the system should not sample all moments equally. It should sample more densely when there are signs that the current region is visually or analytically important.

## Sampling Policy V1

### 1. Base Sweep

Use a denser baseline than `1.0s`.

Recommended starting point:

- base visual sampling every `0.25s`

This gives much better continuity coverage for film and trailer material while remaining lighter than full-frame inference.

### 2. Transition / Motion Boost

When VAA1 detects likely scene change or strong motion cues, temporarily increase sampling density.

Trigger examples:

- possible cut
- possible dissolve / fade
- strong occupancy shift
- rapid tonal-zone change
- sudden reframing

Recommended local boost:

- inspect a local window of `+- 0.5s`
- inside that window, sample at `0.08s` to `0.12s`

Purpose:

- catch short-lived human/object appearances
- stabilize scene-boundary interpretation
- reduce misses in fast-cut sequences

### 3. Human-Salience Boost

When the detector finds weak or uncertain human presence, increase local sampling density around that moment.

Trigger examples:

- weak `person` confidence
- inconsistent person boxes across nearby samples
- likely face / torso / silhouette but unstable detection
- human-like framing cues from spatial composition

Recommended local boost:

- inspect a local window of `+- 0.5s`
- sample at `0.08s` to `0.12s`

Purpose:

- improve person continuity
- rescue partially occluded or weakly visible people
- reduce protagonist misses without requiring full-frame brute force

### 4. Optional Full-Density Mode

For especially important materials, VAA1 should still retain a high-cost mode:

- full-frame or near-full-frame object sweep

This belongs to:

- `forensic_sensor`
- later GPU / power-computing environment

This mode should be reserved for:

- institutional partners
- difficult cinematic material
- verification passes
- model evaluation and calibration

## Why This Matters

Adaptive dense sampling is not merely an engineering optimization. It is analytically important because:

- cinema distributes meaning unevenly over time
- short shots often carry decisive narrative evidence
- protagonists may appear briefly, partially, or under complex lighting
- trailers are especially hostile to coarse interval-based detection

So a better sampling policy directly improves:

- person detection
- object continuity
- action and movement analysis
- later genre-relevant object schemas
- traceback reliability
- manual correction efficiency

## Immediate Recommendation

For VAA1 near-term development:

1. lower the baseline object-detection interval from `1.0s` to `0.25s` for cinema-oriented analysis
2. add local adaptive densification around:
   - motion spikes
   - transition clues
   - weak human detections
3. reserve full-density analysis for `forensic_sensor` and later GPU workflows

## Connection to Broader Roadmap

This note supports:

- action and motion detection improvement
- stronger person detection
- genre-relevant object schemas
- manual CVAT annotation efficiency
- traceback and evidence-linking reliability

In short:

- object recognition quality is not only a model problem
- it is also a temporal sampling-policy problem

