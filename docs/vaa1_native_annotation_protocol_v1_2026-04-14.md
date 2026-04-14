# VAA1 Native Annotation Protocol v1 2026-04-14

## Purpose

This note defines the first hard protocol basis for a native VAA1 annotation system.

The protocol is not designed to replace VAA1 analysis with manual annotation. Its role is narrower and more important:

- manual visual annotation should add what VAA1 missed
- manual visual annotation should correct what VAA1 misread
- manual visual annotation should teach the VAA1 regime by supplying grounded spatiotemporal evidence where automated analysis is incomplete or wrong

Therefore the annotation protocol must be built to support the VAA1 annotation regime rather than stand apart from it.

## Core Rule

The annotation system must support the full VAA1 timestamp regime and the full VAA1 coordinate regime.

This is a non-negotiable compatibility requirement.

## Hard Compatibility Requirement

For VAA1, adaptability means full spatiotemporal annotation support.

The annotation backbone must be able to represent:

### 1. Temporal anchoring

- frame number
- timestamp
- interval start
- interval end
- track continuity across frames
- persistent linkage between local annotation events and timeline positions

### 2. Spatial anchoring

- point
- bounding box
- polygon / free region
- persistent region identity over time where needed

### 3. Annotation context linkage

- source analysis id
- media item reference
- annotation author / source
- manual vs automated origin
- provenance state
- review state

### 4. VAA1-native UI conformity

The annotation system must conform to the VAA1 interface regime.

This includes:

- VAA1 color logic
- VAA1 font logic
- VAA1 layout logic
- VAA1 interaction logic

So the annotation experience must look and behave like VAA1 rather than appearing as a foreign embedded shell.

### 5. Side-by-side comparison support

The annotation system must support actual side-by-side comparison of visual surfaces.

This means the layout must allow:

- stable side-by-side visibility of compared video or annotation views
- simultaneous access to navigation and annotation context
- comparison as a first-class working state rather than as a hidden or improvised mode

### 6. Open-use licensing without ambiguity

The annotation backbone must use an open-use license that does not rely on interpretive excuses, restrictive exceptions, or compromise-heavy legal uncertainty.

This requirement exists because VAA1 needs:

- license clarity
- future adaptability
- freedom to integrate, extend, and maintain the annotation system without structural licensing friction

If a candidate tool or protocol cannot support the timestamp regime, the coordinate regime, VAA1-native UI conformity, side-by-side comparison, and open-use licensing, it is not adaptable enough for VAA1.

## Role Of Manual Visual Annotation In VAA1

The manual visual annotation system is not the primary analytical authority.

Its function is to:

- capture what automated detection missed
- refine ambiguous detections
- affirm identities or roles when the analyst has grounded evidence
- add contextual visual tags that support later interpretation
- produce teachable correction data for future learning

So the protocol should be optimized for:

- correction
- supplementation
- confirmation
- contextualization

and not for rebuilding the whole analysis manually from zero unless necessary.

## VAA1 Native Annotation Object

Each native VAA1 annotation item should minimally support:

- `analysis_id`
- `annotation_id`
- `source_type`
  - `manual_visual`
  - `automated_visual`
  - `automated_audio`
  - `llm_assisted`
  - `reviewed`
- `review_status`
- `created_at`
- `updated_at`

### Temporal block

- `frame`
- `timestamp_seconds`
- `start_seconds`
- `end_seconds`
- `track_id`

### Spatial block

- `geometry_type`
  - `point`
  - `box`
  - `polygon`
- `coordinates`

### Regime block

- `object_label`
- `object_detail`
- `scene`
- `action`
- `movement`
- `interaction`
- `expression`
- `genre`
- `identity_affirmation`
- `role_affirmation`
- `audio_foley_note`
- `open_note`

### Provenance block

- `entered_by`
- `entered_via`
- `evidence_note`
- `confidence_note`
- `correction_of`
- `teaches_regime`

## Manual Annotation As Regime Teaching

The protocol should explicitly support the idea that a manual annotation may exist to teach the VAA1 system.

That means an annotation can carry not only a visual mark, but also the meaning:

- this object was missed
- this identity was wrong
- this role was missing
- this scene reading was incomplete
- this movement or interaction should have been recognized

This is why the annotation object should support:

- `correction_of`
- `teaches_regime`
- `open_note`

These fields allow VAA1 to learn from manual work instead of merely storing it.

## First Native MVP Scope

The first native VAA1 visual annotation MVP does not need to cover every future case.

It should cover the smallest serious spatiotemporal correction set:

1. draw a box
2. assign a timestamped or frame-anchored mark
3. optionally extend into a track
4. assign:
   - object label
   - identity affirmation
   - role affirmation
   - scene
   - action
   - movement
   - interaction
   - expression
   - open note
   - audio foley note
5. store provenance and review state
6. write into the VAA1 master annotation schema

This is enough to make manual annotation useful inside VAA1 without waiting for a full enterprise annotation suite.

## Relation To External Tools

External tools such as CVAT may still be used.

But under this protocol:

- they are adapters
- they are not the canonical model
- they are not the defining VAA1 UX

An external tool is acceptable only if it can map cleanly into this native VAA1 spatiotemporal regime.

## Benchmark For Candidate Tools

Any candidate annotation system considered for VAA1 should be tested against these questions:

1. Does it support full timestamp anchoring?
2. Does it support coordinate annotation as first-class data?
3. Can it preserve frame/track continuity?
4. Can it conform to VAA1 visual and layout design?
5. Can it support actual side-by-side comparison as a working mode?
6. Does it use a clear open-use license without problematic restrictions?
7. Can it export or expose enough structure to populate the VAA1 annotation regime?
8. Can it function as a teacher/correction surface rather than as an isolated annotation silo?

If the answer is no to any of the first six, it is not suitable as a VAA1 annotation backbone.

## Summary

The VAA1-native annotation protocol is not defined by generic annotation convenience.

It is defined by:

- full spatiotemporal support
- compatibility with the VAA1 annotation regime
- VAA1-native interface conformity
- side-by-side comparison readiness
- open-use licensing clarity
- the ability of manual annotation to add, correct, and teach what VAA1 missed

That is the benchmark the native annotation system must meet.
