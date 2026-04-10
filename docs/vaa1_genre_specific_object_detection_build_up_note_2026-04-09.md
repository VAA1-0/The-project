# VAA1 Genre-Specific Object Detection Build-Up Note

Date: 2026-04-09

## Status

This is not a cosmetic enhancement.

Genre-specific object detection is a core requirement for VAA1.

Without it, VAA1 may still produce:

- generic scene inventory
- broad everyday-object detection
- rough visual context

But it will not yet produce analytically adequate object recognition for:

- film studies
- trailer analysis
- action cinema
- institutional research use
- interpretive audiovisual scholarship

In other words:

- genre-specific object detection is not a nice extra
- it is part of the platform’s serious interpretive capability

## Core Problem

The current object layer is based on a generic detector vocabulary.

This means it can often identify:

- person
- car
- truck
- chair
- bottle
- knife
- cell phone

But it cannot yet reliably identify many genre-relevant objects and props such as:

- gun
- pistol
- rifle
- silencer
- holster
- surveillance device
- control terminal
- tactical equipment
- ceremonial object
- propaganda sign
- period prop
- genre-specific costume accessories

This creates an analytic mismatch.

For example:

- a Bond trailer without reliable firearm or espionage-prop recognition is not yet properly readable at the object level
- a horror sequence without reliable knife / ritual / threat-prop recognition remains semantically under-read
- a newsroom or campaign clip without media-device and signage distinctions remains socially under-described

## Required Direction

VAA1 should move toward a layered object-recognition architecture:

1. base object detection
2. genre-relevant object schema
3. specialist detector layers
4. analyst correction and teaching loop

## Layer 1: Base Object Detection

Keep a broad generic object detector.

Purpose:

- detect everyday visual entities
- provide rough inventory
- support spatial and scene-level analysis
- give fallback object presence when specialist layers are absent

This layer remains useful, but it is not enough on its own.

## Layer 2: Genre-Relevant Object Schema

VAA1 should introduce schema-level categories that are analytically meaningful even when the base detector is imperfect.

These should not merely mirror generic detector labels. They should reflect audiovisual interpretation.

Examples:

### Action / Spy / Thriller

- firearm-likely object
- long-weapon-likely object
- tactical gear
- explosive / blast cue
- surveillance device
- command / control interface
- pursuit vehicle
- luxury-status prop
- security checkpoint cue

### Horror

- blade / sharp-threat object
- ritual object
- masking / disguise object
- confinement cue
- body-remains cue
- medical / invasive instrument

### News / Journalism / Documentary

- microphone
- press camera
- podium
- official document
- protest sign
- public-address equipment
- institutional emblem

### Domestic / Intimate / Everyday

- dining prop
- childcare object
- grooming object
- cleaning object
- personal-device object
- leisure object

### Web / Social / Platform Video

- ring light
- headset
- webcam setup
- streamer microphone
- chat / interface screen
- phone-as-recording-device

These schema labels can initially be interpretive categories rather than pure detector-native classes.

## Layer 3: Specialist Detector Layers

Some categories require more than ontology remapping. They require added model capacity.

Likely specialist domains include:

- weapons and tactical gear
- surveillance and control devices
- signage and graphic propaganda material
- film-relevant props
- later costume / accessory cues

So VAA1 should support specialist second-pass detectors that activate when:

- a genre context suggests they matter
- a base detection is uncertain but promising
- the analyst requests a deeper sweep

This allows the platform to remain efficient while still offering deeper domain recognition where needed.

## Layer 4: Analyst Correction and Teaching Loop

This is essential.

VAA1 should not only detect objects. It should learn from analyst correction.

That means manual correction must be structured so that user work becomes:

- correction
- supervision
- training evidence
- calibration evidence

## Manual Correction Requirements

Object correction should support:

- label correction
- object drop / false-positive removal
- missing-object addition
- timestamp- or interval-scoped correction
- note / rationale
- provenance

Corrections should be stored with:

- analysis id
- object label
- corrected label
- timestamp or interval
- track id where relevant
- user / source
- update time
- optional note

## Teaching with User Data

VAA1 should explicitly treat corrected object records as reusable learning material.

That means the system should be able to build:

- correction corpora
- high-frequency confusion maps
- genre-specific false-positive logs
- candidate fine-tuning sets
- active-learning queues

Examples:

- repeated correction from `cell phone` to `gun` in action trailers
- repeated correction from `tv` to `control monitor`
- repeated addition of `surveillance device`
- repeated removal of `person` false positives in reflective glass scenes

These patterns are not noise. They are model-teaching evidence.

## Build-Up Strategy

### Phase 1: Schema and Logging

Deliver:

- genre-relevant object schema note / taxonomy
- structured manual correction for object detections
- persistent correction logging

### Phase 2: Correction-Aware Surfacing

Deliver:

- corrected labels shown in UI
- raw detector label preserved underneath
- correction history available to Traceback

### Phase 3: Confusion Analysis

Deliver:

- reports of frequent object confusions
- genre-specific miss patterns
- category clusters needing specialist support

### Phase 4: Specialist Detector Integration

Deliver:

- second-pass object models for high-priority domains
- selective activation by genre or analyst request

### Phase 5: Learning Loop

Deliver:

- reusable training datasets from analyst corrections
- calibration / fine-tuning workflow
- later institution-grade teaching and benchmarking

## Relation to Manual Annotation

This note is directly tied to the broader VAA1 annotation strategy.

Manual correction is not a detour from automation.
It is part of the route toward better automation.

For object detection this is especially important because:

- generic models will miss genre-specific props
- analyst corrections reveal what matters in each domain
- interpretive significance is often genre-dependent

So object annotation should be designed from the start as:

- correction
- supervision
- future training material

## Relation to Traceback

Genre-specific object detection also matters for Traceback.

Traceback should eventually be able to show:

- what the detector first said
- what the analyst corrected
- what evidence supported the revised reading
- whether a later specialist model agreed

This is important not only for transparency but for institutional trust.

## Practical Conclusion

VAA1 should not remain dependent on generic object vocabularies alone.

It needs:

- genre-relevant object schemas
- manual object correction
- user-data teaching pathways
- specialist detector expansion

This is a foundational build direction for the platform.

