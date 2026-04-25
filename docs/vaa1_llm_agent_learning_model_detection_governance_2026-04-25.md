# VAA1 LLM, Agent, And Learning Model Detection Governance

Date: 2026-04-25

## 1. Purpose

This note defines a governance protocol for VAA1 LLM APIs, AI agents, and learning models.

VAA1 is developing a process for first-order, second-order, and third-order detection, and for
the interpretive accumulation that turns multimodal evidence into responsible sense-making.

The aim is to deliver annotation logic that can serve several analytical purposes at once:

- one detected occurrence may support multiple evidence tracks
- one annotation may contribute to several interpretive layers
- one model output may become useful only after provenance, uncertainty, and authority are made explicit

This protocol applies to automatic outputs, manual annotations, source metadata, Master Schema,
traceability, forensic deepening, report claims, LLM-assisted interpretation, AI-agent workflows,
and learning-model outputs.


## 2. Core Epistemic Layers

VAA1 needs a multimodal detection-to-interpretation matrix where each layer has a different
epistemic function:

- First-order detections = what is directly observed
- Second-order detections = what is inferred from patterns across observations
- Third-order detections = what can be claimed interpretively, with evidence and uncertainty

This fits the existing architecture:

- automatic outputs
- manual annotations
- source metadata
- Master Schema
- linked evidence authority
- traceback
- forensic deepening
- report claims


## 3. Ordering Principle

Each detection or evidence-producing process should be scored by:

| Criterion | Meaning |
|---|---|
| A. Speed of delivery | How early can it be produced? |
| B. Interpretive power | How much does it help the analyst understand the content? |
| C. Interpretive power at scale | How useful is it across many videos/cases? |
| D. Computational cost | How much compute, latency, storage, and operational capacity does it consume? |

Scale:

- Low
- Medium
- High
- Very High

Computational cost uses the same scale, but in reverse: Low cost is operationally favorable,
and Very High cost should be reserved for cases where the interpretive or forensic gain justifies it.

This matters because visual recognition, dense frame analysis, and forensic visual re-rendering can
consume an order of magnitude more computational power and operational capacity than transcript,
metadata, text parsing, OCR consolidation, prosody summarization, or lightweight semantic analysis.
VAA1 should therefore treat visual recognition as high-value but expensive evidence, not as the
default answer to every analytical need.


## 4. First-Order Detections

First-order detections are direct observable signals. They are the fastest and most concrete.
They should appear early in the UI.

| Detection | Modality | Speed | Interpretive power | Scale power | Function |
|---|---|---|---|---|---|
| Video duration / frame map | structural | Very High | Medium | High | Creates time skeleton |
| Scene / shot segmentation | visual | High | High | Very High | Gives the analyst a navigable map |
| Object detection | visual | High | Medium | High | Shows what is physically present |
| Person detection | visual | High | High | Very High | Core for role/character workflow |
| Bounding boxes / ROI | visual | High | High | High | Spatial anchoring |
| OCR / visible text | visual-text | Medium | High | Very High | Often gives names, places, institutional context |
| Transcript | speech-text | Medium | Very High | Very High | Main semantic anchor |
| Dependency parsing | speech/text | High | High | Very High | Extracts grammatical relations, actions, subjects, objects, and claims |
| SFL analysis | speech/text | Medium | Very High | Very High | Surfaces process types, participants, circumstances, modality, stance, and social meaning |
| Speech/non-speech / VAD | audio | Very High | Medium | High | Separates voice from noise |
| Audio prosody features | audio | Medium | High | High | Signals emphasis, urgency, tension |
| Expressions | visual-human | Medium | Medium | Medium | Useful, but context-sensitive |
| Face samples | visual-human | Medium | High | High | Supports identity cloud |
| Motion / movement cues | visual | Medium | Medium | High | Supports action and intensity |
| Source metadata | metadata | Very High | Very High | Very High | Frames interpretation from the start |
| Manual annotation | analyst | Variable | Very High | Very High | Highest-value human evidence |

Current VAA1 already includes object detection, OCR, transcript, prosody, expressions, source
metadata, and manual annotation pathways. The first iteration should also include dependency
parsing and SFL analysis as low-to-medium cost semantic enrichments of transcript, OCR, and
manual text evidence.

First-order detections answer:

What is visibly, audibly, textually, or metadata-wise present?

They do not yet answer what the scene means.


## 5. Second-Order Detections

Second-order detections are profiles, patterns, and hypotheses built from first-order detections.
This is where VAA1 begins to become analytically powerful.

| Detection / profile | Built from | Speed | Interpretive power | Scale power | Function |
|---|---|---|---|---|---|
| Person presence profile | person boxes, frame coverage, screen share | High | High | Very High | Shows who visually matters |
| Screen dominance profile | bbox size, center, persistence | High | Very High | Very High | Detects dominant but possibly unlabeled figures |
| Visual sample cloud | confirmed IDs, high-confidence detections, reference photos | Medium | Very High | Very High | Stabilizes identity over time |
| Cinematic salience profile | shot size, composition, lighting | Medium | High | High | Shows visual/narrative emphasis |
| Audio sample cloud | diarization, embeddings, reference voice | Medium | Very High | Very High | Stabilizes speaker identity |
| Speaker profile | VAD, diarization, transcript, prosody | Medium | Very High | Very High | Links speech to recurring entities |
| Role hypothesis | actions, speech, interaction, metadata | Medium | Very High | Very High | Identifies social/narrative function |
| Character hypothesis | visual cloud, audio cloud, annotations, metadata | Medium | Very High | Very High | Identifies recurring persons/characters |
| Interaction profile | co-presence, speech turns, gestures, annotations | Medium | Very High | Very High | Detects conflict, cooperation, hierarchy, intimacy |
| Situation profile | event, interaction, communication, affect, context | Medium | Very High | Very High | Classifies type of situation |
| Metadata-alignment profile | metadata vs detections vs annotations | High | High | High | Checks whether evidence supports context |
| Detection gap alert | visual salience without detection | High | Very High | High | Flags false absence |
| Hotspot ranking | transcript, prosody, OCR, annotations, visual salience | High | Very High | Very High | Directs analyst attention |
| Epistemic status profile | confidence, review state, contradictions | Medium | Very High | Very High | Separates known/likely/uncertain/contested |
| SFL role/process profile | transcript, OCR, dependency parsing, annotations | Medium | Very High | Very High | Identifies participants, process types, agency, modality, evaluation, and stance |
| Dependency relation profile | transcript, OCR, annotations | High | High | Very High | Links actors, actions, objects, negations, conditions, and reported claims |

Second-order detections answer:

What patterns are forming across time, modalities, and evidence sources?

This is where VAA1 moves from detection to hypothesis formation.


## 6. Third-Order Detections

Third-order detections are not detections in the narrow technical sense. They are
evidence-weighted claims.

| Claim type | Built from | Speed | Interpretive power | Scale power | Function |
|---|---|---|---|---|---|
| Descriptive summary | transcript, OCR, objects, metadata | High | High | Very High | Gives early overview |
| Narrative summary | transcript, interaction, situation, prosody | Medium | Very High | High | Explains development |
| Identity claim | visual cloud, audio cloud, metadata, annotation | Medium | Very High | Very High | Says who is likely present |
| Role claim | action, speech, interaction, metadata | Medium | Very High | Very High | Says what function they serve |
| Interaction claim | co-presence, turns, gestures, annotations | Medium | Very High | Very High | Explains relations between actors |
| Scene claim | scene type, setting, objects, metadata | Medium | High | High | Explains where/what type of scene |
| Affect claim | expression, prosody, transcript, situation | Medium | Medium-High | Medium | Interprets emotion carefully |
| Intensity claim | prosody, transcript, motion, annotation | High | High | High | Marks moments of tension/emphasis |
| Situation claim | taxonomy plus multimodal evidence | Medium | Very High | Very High | Classifies what kind of event this is |
| Uncertainty note | contradictory or weak evidence | High | Very High | Very High | Prevents false certainty |
| Forensic observation | deepened evidence from selected span | Low | Very High | Medium | Supports high-stakes verification |
| Report claim | all evidence plus review status | Medium | Very High | Very High | Produces auditable analyst output |

Third-order detections answer:

What can the analyst responsibly claim, based on what evidence, involving whom, at what time,
and with what confidence?

That is the core VAA1 concept.


## 7. Process Rhythm

VAA1 should move from cheap orientation to deep interpretation.

### Wave 1: Immediate Orientation

Fastest, highest early value:

1. Source metadata
2. Video duration / timeline skeleton
3. Scene / shot segmentation
4. VAD / speech segments
5. Rough transcript
6. Basic person/object detection
7. OCR

Purpose:

Give the analyst a first map quickly.

### Wave 2: Semantic Anchoring

1. Transcript refinement
2. Prosody extraction
3. OCR consolidation
4. Dependency parsing
5. SFL analysis
6. Source metadata review
7. Initial summary
8. Initial hotspot ranking

Purpose:

Give the analyst early understanding.

### Wave 3: Human Presence Profiling

1. Person presence profile
2. Screen dominance profile
3. Detection gap alerts
4. Face/body sample extraction
5. Visual sample cloud
6. Cinematic salience profile

Purpose:

Prevent false absence and begin role/character tracking.

### Wave 4: Audio Identity Profiling

1. VAD refinement
2. Speaker diarization
3. Speaker embeddings
4. Audio sample cloud
5. Analyst reference voice matching
6. Speaker-role hypothesis

Purpose:

Turn speech into recurring speaker evidence.

### Wave 5: Multimodal Fusion

1. Link visual person candidates to speaker candidates
2. Link transcript mentions to character hypotheses
3. Link OCR/metadata to scene and role hypotheses
4. Link prosody to interaction and intensity
5. Link dependency relations to actions, roles, and claims
6. Link SFL process/participant/modality patterns to role, interaction, and situation hypotheses
7. Link manual annotation to all relevant hypotheses

Purpose:

Move from parallel detections to composed meaning.

### Wave 6: Situation And Role Synthesis

1. Situation profile
2. Interaction profile
3. Role hypothesis
4. Character hypothesis
5. Epistemic status profile

Purpose:

Create analyst-facing hypotheses.

### Wave 7: Analyst Verification

1. Confirm/reject identity
2. Confirm/reject role
3. Correct transcript or OCR
4. Confirm interaction
5. Promote samples into cloud
6. Mark uncertainty/contestation

Purpose:

Let analyst governance strengthen the system.

### Wave 8: Forensic Deepening

1. Select hotspot
2. Re-render or re-analyze selected span
3. Adopt existing context
4. Produce forensic evidence
5. Update claims

This matches the roadmap principle:

Quick sweep first, forensic deepening only where needed.


## 8. Interpretive Power By Modality

Highest early interpretive power:

| Modality | Reason |
|---|---|
| Metadata | Tells expected context immediately |
| Transcript | Gives semantic content |
| Dependency parsing | Gives low-cost actor/action/object and claim structure |
| SFL analysis | Gives interpretable social, functional, and stance-oriented linguistic structure |
| Prosody | Gives urgency, emphasis, turn-taking |
| OCR | Gives names, places, institutional labels |
| Manual annotation | Gives analyst-grounded meaning |

These should be prioritized early.

Highest identity/role power:

| Modality | Reason |
|---|---|
| Visual sample cloud | Stabilizes person identity |
| Audio sample cloud | Stabilizes speaker identity |
| Screen dominance | Detects important visible figures |
| Interaction profile | Reveals social/narrative function |
| Metadata reference | Gives external identity/role anchor |
| Analyst confirmation | Highest epistemic authority |

Highest scale power:

| Detection | Why it scales |
|---|---|
| Transcript | Searchable and comparable |
| Dependency parsing | Makes relational language patterns comparable |
| SFL analysis | Makes participant/process/modality patterns comparable |
| OCR | Extracts institutional/textual context |
| Metadata | Standardizes cases |
| Scene segmentation | Creates comparable units |
| Person/speaker profiles | Tracks actors across time |
| Situation taxonomy | Enables comparative social-scientific analysis |
| Claim-evidence tables | Enables audit and research reuse |

The situation taxonomy is especially important for scale because it gives repeatable categories
for event type, interaction mode, communication type, affect, context, time, epistemic state,
normative frame, and person-situation domain.


## 9. Recommended Scoring Model

Each detection should receive four scores:

```json
{
  "speed_score": 0.0,
  "interpretive_power_score": 0.0,
  "scale_power_score": 0.0,
  "compute_cost_score": 0.0
}
```

`compute_cost_score` should be normalized from 0.0 to 1.0, where 0.0 means low cost and
1.0 means very high cost. For example, source metadata, text parsing, and lightweight transcript
analysis should usually score low; dense visual recognition, repeated frame sampling, and forensic
rendering should usually score high.

Default delivery priority:

```text
delivery_priority =
  speed_score * 0.35
+ interpretive_power_score * 0.40
+ scale_power_score * 0.25
```

Quick Sweep priority:

```text
quick_sweep_priority =
  speed_score * 0.50
+ interpretive_power_score * 0.35
+ scale_power_score * 0.15
```

Research export priority:

```text
research_priority =
  speed_score * 0.20
+ interpretive_power_score * 0.35
+ scale_power_score * 0.45
```

Efficiency-aware priority:

```text
efficiency_priority =
  speed_score * 0.30
+ interpretive_power_score * 0.35
+ scale_power_score * 0.25
- compute_cost_score * 0.10
```

For Quick Sweep, computational cost should act as a stronger brake:

```text
quick_sweep_efficiency_priority =
  speed_score * 0.45
+ interpretive_power_score * 0.35
+ scale_power_score * 0.15
- compute_cost_score * 0.20
```

The practical rule is that low-cost semantic signals should be harvested early, while expensive
visual recognition should be staged, sampled, cached, or selectively deepened unless it is needed
for orientation, identity, evidence correction, or forensic verification.


## 10. LLM And Agent Governance Rules

LLMs, AI agents, and learning models must obey the evidence layer boundary.

They may:

- summarize first-order detections
- propose second-order hypotheses
- draft third-order claims with explicit supporting evidence
- rank hotspots according to declared scoring models
- use dependency parsing and SFL signals to propose second-order language patterns
- suggest missing evidence, uncertainty, contradictions, or detection gaps
- help prepare report language when provenance is available

They must not:

- turn first-order detections directly into third-order claims without intermediate evidence
- treat SFL or dependency parsing as proof without timestamped source text
- hide uncertainty
- treat raw detections as confirmed identities
- overwrite manual corrections
- erase provenance links
- collapse multiple tracks into one because the UI is simpler
- produce report claims without source evidence references

Every LLM/agent output that becomes evidence must declare:

- evidence id
- evidence layer: first_order | second_order | third_order
- source evidence ids
- modality inputs
- confidence or uncertainty statement
- review state
- whether the output is automatic, analyst-confirmed, or contested


## 11. Practical Processing Hierarchy

VAA1 should not process everything as equal.

First:

Fast orientation signals:

- metadata
- timeline
- transcript
- dependency parsing
- SFL analysis
- OCR
- VAD
- basic person/object detection

Second:

High-value profiles:

- screen dominance
- speaker profile
- visual sample cloud
- audio sample cloud
- interaction profile
- dependency relation profile
- SFL role/process profile

Third:

Interpretive synthesis:

- role hypotheses
- character hypotheses
- situation hypotheses
- uncertainty notes
- claim-evidence tables

Fourth:

Selective deepening:

- forensic rendering
- dense re-analysis
- analyst-confirmed final claims

Efficiency governance:

- prefer metadata, transcript, OCR, dependency parsing, SFL, VAD, and prosody for early orientation
- cache expensive visual detections and reuse them through evidence authority links
- avoid repeating dense visual recognition when a lower-cost semantic signal already answers the analyst need
- escalate to dense visual recognition when screen presence, identity, spatial evidence, or forensic certainty requires it
- record compute cost and model path as provenance when an expensive process produces evidence

The core concept:

VAA1 should deliver understanding first, precision second, and forensic certainty only where the
analyst chooses to deepen.


## 12. Relationship To Linked Evidence Authority

This protocol depends on the linked evidence authority model:

- manual correction > manual annotation > grouped detection > raw detection
- one evidence occurrence may participate in many tracks
- tracks may have different scopes and durations
- interpretive claims must preserve parent/child evidence links
- forensic deepening must adopt context instead of creating detached clips
- traceback must remain navigable to source evidence

The detection-to-interpretation matrix is therefore not separate from annotation governance. It
is the epistemic operating layer above it.


## 13. Identity-Dependent Detection Proliferation

Confirmed identity is a high-value dependency for other detection labels. It should enrich
linked evidence, not replace the evidence regime of those labels.

When an identity is confirmed through analyst review or strong multimodal triangulation, VAA1 may
propose dependent label updates for:

- Interaction
- Movement
- Action
- Role
- Scene
- Situation
- Expression
- Audio / speaker
- OCR mentions
- Report claims

The governing rule:

Confirmed identity may travel across associated evidence objects, but timing, geometry, modality
source, and uncertainty must remain local to each evidence object.

Examples:

- An interaction label may inherit the confirmed participant identity.
- A movement label may inherit who moved, but not invent a movement path.
- An action label may inherit who performed the action, but not confirm the action without action evidence.
- A speaker segment may inherit a candidate identity only when audio sample cloud evidence supports it.
- A report claim may cite the identity as confirmed only when the claim links back to the confirming evidence.

Forbidden proliferation:

- identity must not overwrite BBox/ROI geometry
- identity must not stretch or move timestamps
- identity must not turn weak action/movement/expression evidence into confirmed labels
- identity must not collapse separate tracks into one track
- identity must not erase provenance for the original detection

Allowed proliferation:

- add participant identity references
- add speaker identity references
- add candidate role links
- add report-claim support links
- add traceback references
- raise prioritization for analyst review

The practical model is:

```text
confirmed identity + dependent evidence = enriched dependent label
confirmed identity alone != confirmed interaction/action/movement/expression
```

This keeps identity powerful without letting it become a false universal shortcut.
