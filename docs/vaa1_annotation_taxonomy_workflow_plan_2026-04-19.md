# VAA1 Annotation Taxonomy And Workflow Plan 2026-04-19

## Purpose

This document records the first working order of the VAA1 manual annotation system and sets up the fuller annotation taxonomy document needed for workflow planning.

The full explicit situation taxonomy is recorded in:

- `docs/vaa1_situation_taxonomy_full_2026-04-19.md`

It explicitly distinguishes:

- automatic detections
- source metadata annotations
- manual native annotations
- mature mixed panels
- universal manual governance leaves
- planned derived or propagated annotations

The goal is to prevent category drift. `Objects` is not the master schema. The Master Schema is the full manual annotation account, and mature detection panels should combine automatic evidence with manual additions where possible.

## Current Working Order

The native annotation workflow is operational at first working order:

1. The analyst selects a video analysis.
2. The analyst opens `Tools -> Annotation workspace`.
3. The analyst uses `Native annotation console`.
4. The analyst opens `Open native annotator`.
5. The analyst chooses a manual category and subcategory.
6. The analyst draws a box and saves the manual annotation.
7. The annotation is persisted in `annotation_corrections.json`.
8. The annotation appears in Master Schema.
9. The annotation appears in its category leaf or mature mixed panel.

## Current Panel Rule

Manual categories route in two ways.

Mature mixed panels should show automatic evidence plus manual additions:

- `Audio`
- `Expressions`
- `OBJ`
- `OCR`
- `Transcription`

Universal manual governance leaves are used where a specialist mixed panel is not mature yet:

- `Action`
- `Cinematic Cues`
- `Genre`
- `Identification`
- `Interaction`
- `Metadata`
- `Movement`
- `Notes`
- `Role`
- `Scene`

The universal leaf is acceptable as an interim panel only if it clearly preserves category governance and points back to the Master Schema.

## Automatic Detection Attributes

### Objects

Status: automatic and manual-mixed.

Automatic object attributes currently include:

- `timestamp`
- `class_id`
- `class_name`
- `raw_class_name`
- `confidence`
- `bbox.x1`
- `bbox.y1`
- `bbox.x2`
- `bbox.y2`
- `startTimestamp`
- `endTimestamp`
- `occurrenceCount`
- `trackId`
- `displayLabel`
- `demographicSummary`
- `screenPresenceProfile`
- `sourceType`

Manual object additions may add:

- `identityAffirmation`
- `roleAffirmation`
- `audioFoleyNote`
- `openNote`
- `teachesRegime`
- `annotationCategory`
- `annotationSubcategory`
- `customLabel`
- `metadataCorrelation`

### OCR

Status: automatic and manual-mixed.

Automatic OCR attributes currently include:

- `timestamp`
- `text`
- `rawText`
- `confidence`
- `bbox.x`
- `bbox.y`
- `bbox.w`
- `bbox.h`

Manual OCR annotations should appear in the OCR panel and in Master Schema.

### Expressions

Status: automatic and manual-mixed.

Automatic expression attributes currently include:

- `timestamp`
- `frame_index`
- `face_id`
- `dominant_emotion`
- `rawDominantEmotion`
- `emotion`
- `top_emotion_score`
- `score_margin`
- `quality`
- `face_signal`
- `expression_evidence`
- `affect_hints`
- `social_function_profile`
- `interpreted_expression`
- `error`
- `bbox.x`
- `bbox.y`
- `bbox.w`
- `bbox.h`

Manual expression annotations should be treated as analyst evidence, not as replacement for automatic expression scoring.

### Audio Prosody

Status: automatic and manual-mixed.

Automatic audio prosody attributes currently include:

- `cue_id`
- `start`
- `end`
- `text`
- `word_count`
- `pace.words_per_second`
- `pace.label`
- `pauses.before_seconds`
- `pauses.after_seconds`
- `pauses.before_label`
- `pauses.after_label`
- `turn_structure.gap_before_seconds`
- `turn_structure.transition`
- `turn_structure.likely_turn_boundary`
- `turn_structure.overlap_seconds`
- `turn_structure.overlap_cue`
- `interaction_cues.run_length`
- `interaction_cues.run_position`
- `interaction_cues.role_support`
- `rhythm_profile.label`
- `tonality_profile.label`
- `emphasis.score`
- `emphasis.label`
- `pitch_energy_contour.pitch_hz`
- `pitch_energy_contour.energy_rms`
- `pitch_energy_contour.energy_dbfs`
- `pitch_energy_contour.label`
- `sound_environment.label`
- `sound_environment.zero_crossing_rate`
- `sound_environment.spectral_variation`

Manual audio annotations may add foley, ambience, music, speaker-state, prosody interpretation, and open notes.

### Transcript And Transcription

Status: automatic and manual-mixed.

Automatic transcript attributes currently include:

- `start`
- `end`
- `text`
- `status`
- synthetic coverage markers where transcript coverage is degraded

Manual transcription annotations include:

- manual transcript entries
- speech content corrections
- transcript notes
- unresolved or unconfirmed speech markers

### Source Genre And Metadata

Status: source metadata plus manual governance.

Source annotation context currently includes:

- `genre`
- `genre_subtype`
- `situational_genre`
- `situational_subtype`

Manual genre annotations should appear beside source genre evidence, not isolated from it.

## Manual Native Annotation Categories

The authoritative manual categories are:

- `Action`
- `Audio`
- `Cinematic Cues`
- `Expressions`
- `Genre`
- `Identification`
- `Interaction`
- `Metadata`
- `Movement`
- `Notes`
- `OBJ`
- `OCR`
- `Role`
- `Scene`
- `Transcription`

## Manual Subcategories And Current Ready Labels

### Action

Subcategories:

- `Action`

Ready labels:

- `Driving`
- `Entering`
- `Exiting`
- `Holding`
- `Running`
- `Sitting`
- `Standing`
- `Walking`

### Audio

Subcategories:

- `Ambience`
- `Foley`
- `Music`
- `Prosody`
- `Sound event`
- `Speaker-state`

Ready labels:

- `Crowd noise`
- `Indoor hum`
- `Street noise`
- `Wind`
- `Door close`
- `Footsteps`
- `Glass impact`
- `Walking on snow`
- `Background score`
- `Dissonant cue`
- `Suspense cue`
- `Theme cue`
- `Emphasis`
- `Flat delivery`
- `Raised voice`
- `Whisper`
- `Door slam`
- `Explosion`
- `Gun shot`
- `Phone ring`
- `Agitated`
- `Calm`
- `Fearful`
- `Urgent`

### Cinematic Cues

Subcategories:

- `Composition`
- `Lighting`
- `Shot size`
- `Transition`

Ready labels:

- `Center-weighted`
- `Foreground obstruction`
- `Symmetry`
- `Wide isolation`
- `Backlit`
- `Cold lighting`
- `High contrast`
- `Low-key lighting`
- `Close-up`
- `Extreme close-up`
- `Long shot`
- `Medium shot`
- `Cut`
- `Dissolve`
- `Fade`
- `Match cut`

### Expressions

Subcategories:

- `Emotion`
- `Expression`

Ready labels:

- `Anger`
- `Fear`
- `Joy`
- `Sadness`
- `Surprise`
- `Concern`
- `Determination`
- `Neutral`
- `Tension`

### Genre

Subcategories:

- `Media genre`
- `Media subgenre`
- `Situational genre`
- `Situational subgenre`
- `Situational taxonomy`

Ready labels are supplied by the metadata taxonomy and custom taxonomy stores.

Situational genre remains under active schema review.

Everyday-situation coverage has been added to the metadata taxonomy so analysts can mark ordinary life contexts without forcing them into event-heavy categories.

The applied situation schema includes these dimensions:

- `event.type`: `crisis`, `routine`, `institutional`, `turning_point`
- `event.type` additionally includes `transition` and `season_change`
- `interaction.mode`: `conflict`, `cooperation`, `hierarchy`, `intimacy`, `solitude`
- `interaction.actorRole`: `agent`, `observer`, `target`
- `interaction.actorRelation`: `friend`, `stranger`, `family`, `authority`, `unknown`
- `communication.type`: `informing`, `persuading`, `performing`, `interviewing`, `witnessing`
- `communication.channel`: `speech`, `text`, `gesture`, `multimodal`
- `experience.affect`: `joy`, `tension`, `fear`, `calm`, `intimacy`, `ambiguity`
- `context.space`: `home`, `work`, `public`, `nature`, `digital`
- `context.socialDensity`: `alone`, `pair`, `group`, `crowd`
- `time.phase`: `morning`, `daytime`, `evening`, `night`
- `time.seasonalPhase`: `spring`, `summer`, `autumn`, `winter`, `season_change`
- `time.narrativeRole`: `setup`, `build`, `climax`, `aftermath`, `loop`
- `epistemic.state`: `known`, `uncertain`, `revealed`, `contested`
- `epistemic.source`: `expert`, `participant`, `observer`, `algorithm`
- `normative.frame`: `moral`, `legal`, `neutral`, `contested`
- `normative.evaluation`: `positive`, `negative`, `ambiguous`
- `function.mediaRole`: `attention`, `narrative`, `context`, `emotion`, `identity`
- `multimodal.composition`: `talking_head`, `observational`, `montage`, `hybrid`
- `multimodal.elements`: `speech`, `music`, `text_overlay`, `object_detection`

Current everyday situational genre coverage:

- `at home`
- `at work`
- `private time`
- `public everyday`
- `transit`

Current everyday situational subgenre examples:

- `home morning`
- `home daytime`
- `home evening`
- `home night`
- `domestic routine`
- `family time`
- `remote work at home`
- `work morning arrival`
- `work daytime focused work`
- `work daytime meeting`
- `work daytime collaboration`
- `work evening wrap-up`
- `afterwork transition`
- `private morning`
- `private daytime`
- `private evening`
- `private night`
- `solitude`
- `intimacy`
- `decompression`
- `self-care`
- `errands`
- `shopping`
- `appointment`
- `bureaucracy`
- `cafe visit`
- `restaurant`
- `street interaction`
- `commute`
- `walking route`
- `public transport`
- `car transit`
- `arrival`
- `departure`
- `waiting in transit`

The applied `PersonSituationTaxonomy` domains are:

- `home`
- `work`
- `public`
- `social_relational`
- `inner_life`
- `mobility`
- `leisure`
- `nature`
- `consumption`

The native annotation UI now uses the shared metadata taxonomy source for `Situational taxonomy` options instead of a local copy in the video panel.

### Identification

Subcategories:

- `Character`
- `Identity`

Ready labels:

- `Character present`
- `Unidentified person`
- `Identity affirmed`
- `Identity uncertain`

Important workflow note:

`identity_affirmation` is the meaningful analyst field. Generic labels such as `Character present` should not be treated as the final identity.

### Interaction

Subcategories:

- `Exchange`
- `Interaction`

Ready labels:

- `Confrontation`
- `Conversation`
- `Observation`
- `Pursuit`
- `Assistance`
- `Conflict`
- `Contact`
- `Threat`

### Metadata

Subcategories:

- `Context`
- `Correlation`

Ready labels:

- `Metadata supports annotation`
- `Metadata updated from annotation`
- `Contradicts metadata`
- `Extends metadata`
- `Matches metadata`
- `Supports metadata`

### Movement

Subcategories:

- `Camera movement`
- `Subject movement`

Ready labels:

- `Pan`
- `Static camera`
- `Tilt`
- `Zoom`
- `Approach`
- `Retreat`
- `Turn`
- `Walk`

### Notes

Subcategories:

- `Timestamped note`

Ready labels:

- `Analyst note`
- `Correction note`
- `Open note`

### OBJ

Subcategories:

- `Object label`

Ready labels:

- `Bag`
- `Car`
- `Door`
- `Person`
- `Phone`
- `Weapon`

### OCR

Subcategories:

- `Visible text`

Ready labels:

- `Name card`
- `On-screen caption`
- `Signage`
- `Subtitle`

### Role

Subcategories:

- `Role affirmation`

Ready labels:

- `Authority`
- `Customer service`
- `Driver`
- `Guard`
- `Police officer`

### Scene

Subcategories:

- `Location`
- `Scene type`

Ready labels:

- `Indoor`
- `Outdoor`
- `Street`
- `Waiting area`
- `Arrival`
- `Checkpoint`
- `Conversation scene`
- `Transition scene`

### Transcription

Subcategories:

- `Speech content`
- `Transcript note`

Ready labels:

- `Correct transcript`
- `Missing utterance`
- `Speaker overlap`
- `Ambiguous phrase`
- `Manual clarification`
- `Timestamp note`

## Shared Manual Annotation Fields

All native manual visual annotations currently support:

- `id`
- `category`
- `subcategory`
- `label`
- `custom_label`
- `geometry_type`
- `coordinates.x`
- `coordinates.y`
- `coordinates.w`
- `coordinates.h`
- `timestamp_seconds`
- `start_seconds`
- `end_seconds`
- `identity_affirmation`
- `role_affirmation`
- `audio_foley_note`
- `open_note`
- `metadata_correlation.target_type`
- `metadata_correlation.target_id`
- `metadata_correlation.target_label`
- `metadata_correlation.relation`
- `metadata_correlation.note`
- `teaches_regime`
- `created_at`
- `updated_at`
- `updated_by`

## Planned Cross-Annotation Propagation

Cross-annotation propagation is not yet implemented as a workflow.

Required design principle:

One manual annotation may imply another category, but VAA1 should not silently create authoritative records.

Examples:

- `Interaction` between two characters may imply `Identification` candidates.
- `Identification` may imply `Role`.
- `Action` involving multiple participants may imply `Interaction`.
- `Scene` may imply `Action`, `Movement`, or `Cinematic Cues`.

Recommended propagation states:

- `explicit`
- `derived_candidate`
- `analyst_confirmed`
- `analyst_rejected`

Recommended identity statuses:

- `confirmed`
- `suspected`
- `insinuated`
- `withheld`
- `ambiguous`
- `contested`

This is essential for visual narrative cultures where identity may be partial, delayed, disguised, insinuated, or narratively withheld.

## Workflow Planning Tasks

Before pushing this as a stable annotation workflow milestone, review:

- whether every mature automatic detector has a mixed panel
- whether every manual-only leaf clearly says when no automatic detector exists
- whether `Interaction` should support multi-subject linking
- whether `Identification` should support identity status
- whether propagated annotations should be saved as candidates
- whether `Role` should be separable from identity
- whether `Scene` and `Genre` need stronger source metadata links
- whether manual annotations should be exportable as a standalone CSV/JSON package

## Current Operational Status

Current status: first working order.

The system can:

- create native manual annotations
- preserve them in correction files
- surface them in Master Schema
- route mature categories into mixed panels
- route non-mature categories into universal governance leaves
- preserve timestamp and coordinate anchoring
- distinguish analyst fields such as identity, role, audio note, and open note

The system still needs:

- cross-annotation propagation design
- identity uncertainty schema
- richer relation modeling
- full manual taxonomy review
- export-ready annotation documentation
