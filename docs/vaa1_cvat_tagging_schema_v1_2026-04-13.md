# VAA1 CVAT Tagging Schema v1

## Purpose

This schema defines what CVAT is allowed to capture as manual notation and context for VAA1.

The rule is:

- CVAT records manual visual notation and local annotation context.
- VAA1 performs interpretation, weighing, cross-modal comparison, identity logic, role logic, and master-schema integration.

CVAT is therefore a notation surface, not the final interpretation authority.

## Core Principle

Each CVAT annotation should be able to contribute contextual information to the wider VAA1 multimodal regime without forcing the analyst to leave the manual annotation flow.

The annotation payload should support:

- visual object confirmation
- person identity affirmation
- role affirmation
- scene context
- action context
- movement context
- interaction context
- expression context
- genre context
- audio foley notation
- open additions where the controlled list is insufficient

## CVAT Annotation Layers

### 1. Object Label

The primary CVAT label remains the object anchor.

Examples:

- `Person`
- `Vehicle`
- `Weapon`
- `Animal`
- `Building`
- `Screen`

This layer marks what is visually anchored in the frame or track.

### 2. Annotation Context Attributes

Each relevant object, shape, track, frame span, or segment may carry contextual attributes.

Recommended v1 attributes:

- `scene`
- `object_detail`
- `expression`
- `genre`
- `action`
- `movement`
- `interaction`
- `audio_foley`
- `note`

These are notation fields. They do not by themselves decide final interpretation.

### 3. Person-Specific Affirmation Attributes

If the object label is `Person`, the annotation should support person-specific affirmation.

Recommended v1 person fields:

- `person_identity`
- `person_role`
- `new_identity`
- `new_role`

The dropdown values for `person_identity` and `person_role` should be populated from VAA1 metadata where available.

Sources for dropdown population:

- source media metadata `persons`
- named characters
- named roles
- prior affirmed identities in the same analysis
- later, approved shared project identities

If the needed identity or role does not exist, the analyst can use the open fields:

- `new_identity`
- `new_role`

These additions should be treated as contextual notation candidates until VAA1 reviews and integrates them.

## Controlled vs Open Fields

The schema should support both controlled and open-entry fields.

### Controlled-preferred fields

These should prefer VAA1-provided dropdown values when available:

- `scene`
- `object_detail`
- `expression`
- `genre`
- `action`
- `movement`
- `interaction`
- `person_identity`
- `person_role`

### Open fields

These remain open text in v1:

- `audio_foley`
- `note`
- `new_identity`
- `new_role`

Open fields are necessary because the analyst may observe context that the current controlled vocabulary does not yet cover.

## Field Intent

### `scene`

Used for local scene reading.

Examples:

- `interrogation`
- `escape`
- `arrival`
- `domestic confrontation`

### `object_detail`

Used to specify the type or social meaning of the object beyond the raw label.

Examples:

- `service pistol`
- `military vehicle`
- `family photograph`

### `expression`

Used for visually inferable expression or delivery cues.

Examples:

- `fear`
- `anger`
- `hesitation`
- `controlled calm`

### `genre`

Used for local genre cue notation, not final genre truth.

Examples:

- `thriller`
- `surveillance`
- `romantic tension`

### `action`

Used for what the annotated subject is doing.

Examples:

- `running`
- `aiming`
- `embracing`
- `entering`

### `movement`

Used for directional or kinetic description.

Examples:

- `approaching`
- `retreating`
- `falling`
- `crossing frame`

### `interaction`

Used for relational conduct between subjects.

Examples:

- `confrontation`
- `assistance`
- `seduction`
- `command`

### `audio_foley`

Open field for notable sound-context notation even though CVAT is not the audio analysis system.

Examples:

- `glass shatter`
- `footsteps on metal`
- `muffled breathing`
- `gun cocking`

This field exists to preserve analyst context at the moment of visual notation. VAA1 later decides how that note is weighed against audio evidence.

### `note`

Open contextual note when the analyst needs a compact free-form observation.

## Recommended CVAT Representation

To keep CVAT manageable, the structure should be:

- object label as the main CVAT label
- contextual items as attributes or tags
- task-level or segment-level tags for broader scene/genre notes where appropriate

This is preferable to exploding the object label list into hundreds of mixed object-and-interpretation labels.

## VAA1 Integration Rule

After sync, VAA1 should transform CVAT notation into the VAA1 master annotation regime.

VAA1 should:

- store the raw CVAT annotation
- store the mapped annotation record
- propagate the new information across VAA1 panels
- connect the notation to Time Bank intervals
- connect person affirmations to identity and role candidates
- connect contextual tags to interpretive layers
- decide weighting and confidence at the VAA1 layer

## Immediate Panel Propagation Targets

When a CVAT manual addition is synced, VAA1 should be able to surface the result in:

- object annotation views
- scene/context views
- expression views
- action and movement views
- interaction views
- audio/timeline context
- interpretive layer

The audio-related panels should not treat CVAT as an audio engine. They should treat CVAT input as contextual notation that can be weighed alongside transcript and audio evidence.

## Identity Affirmation Rule

Person identity affirmation is allowed and encouraged when the analyst has a contextual basis.

The logic should be:

- CVAT lets the analyst affirm `Person`
- the analyst may also choose an identity and role from VAA1-fed dropdowns
- or enter a new identity and role if needed
- VAA1 records this as a manual affirmation with provenance
- VAA1 then weighs that affirmation against the broader evidence environment

This lets manual visual annotation contribute directly to identity reasoning without pretending the CVAT dropdown itself is final truth.

## Provenance Rule

All synced CVAT tagging should preserve provenance.

Recommended provenance markers:

- `source_system: cvat`
- `source_type: manual_visual_annotation`
- `review_status`
- `created_by`
- `created_at`
- `task_id`
- `job_id`

If person identity or role is affirmed, that provenance should remain attached through later VAA1 interpretation.

## v1 Summary

CVAT v1 tagging for VAA1 should support:

- object anchors
- contextual interpretation cues
- person identity affirmation
- role affirmation
- open additions
- audio foley notation

VAA1 remains responsible for:

- interpretation
- weighting
- multimodal comparison
- schema normalization
- temporal alignment
- audit and traceback

This division keeps the analyst close to the visual evidence while preserving VAA1 as the real multimodal reasoning environment.
