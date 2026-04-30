# VAA1 SFL + Dependency Substantial Indicative Layer Development Note

Date: 2026-04-29

## 1. Purpose

This note defines the first-iteration development target for VAA1's SFL + Dependency
Parsing layer.

The layer should not be framed merely as a cheap or lightweight pass. It is low-compute
relative to heavy visual recognition, but analytically it is a substantial indicative layer.
It is where VAA1 begins to produce traceable candidates for action, role, interaction,
scene, episode, plot function, affect, judgment, affiliation, and report-writing claims.

The correct framing is:

> SFL + Dependency Parsing is a low-compute but substantial indicative meaning layer.

It may seed candidates and proliferated labels, but it must never override manual
annotations, manual corrections, or source evidence.

## 2. Governing Principles

The layer must obey existing VAA1 evidence governance:

- manual correction wins over all automated and derived signals
- manual annotation wins over base detections and parser output
- all derived interpretation must trace back to source evidence
- source evidence ids, timestamp intervals, speaker references, participant references, and
  traceback paths must be preserved
- open weights must remain visible in artifacts and exports
- analyst confirmation is valuable, but VAA1 must not demand confirmation at every corner
- pattern-level recognition may seed candidates until corrected or strengthened
- analyst corrections should scale across related candidate families
- external LLM review may assist labeling and check-up, but may not become hidden authority

## 3. First-Iteration Pattern Packs

The first iteration should use governed pattern packs rather than a large monolithic
linguistic engine.

Each pattern pack should produce candidate events with:

- pattern id
- pattern family
- target signal
- lexical basis
- dependency/SFL basis
- source evidence ids
- timestamp span
- candidate label families
- open support weights
- confidence and review state
- traceback policy
- genre sensitivity notes

### 3.1 Speech Act / Power Pack

Purpose: detect overt social action and power movement in speech.

Initial candidates:

- directive / command
- request
- refusal
- agreement
- disagreement
- warning
- threat
- accusation
- promise / commitment

Likely proliferation targets:

- Interaction
- Action
- Role
- Situation
- Intensity
- ReportClaim

### 3.2 Affiliation / Care Pack

Purpose: prevent the analysis from over-privileging conflict and under-detecting care,
alignment, kindness, encouragement, and social repair.

Initial candidates:

- affirmation
- approval
- confirmation
- agreement
- greeting
- gratitude
- compliment
- encouragement
- consolation
- reassurance
- apology
- forgiveness
- concern
- protection
- offering help
- sympathy / empathy

Likely proliferation targets:

- Interaction
- Role
- Affect
- Situation
- Micro-ritual
- ReportClaim

Governance rule:

> VAA1 must not privilege conflict patterns over affiliation patterns. Empathy,
> compassion, care, approval, warmth, intimacy, and social repair are structurally
> important evidence for role, interaction, situation, and genre interpretation.

### 3.3 Intimacy / Commitment Pack

Purpose: detect relationship-building, courtship, promise, loyalty, and trust cues.

Initial candidates:

- flirting
- joking intimacy
- affection
- invitation
- vow
- promise
- longing
- trust-building
- loyalty statement
- relational commitment

Likely proliferation targets:

- Interaction
- Role
- Relationship
- Affect
- Situation
- Scene

### 3.4 Judgment / Denigration Pack

Purpose: detect downward social positioning, moral judgment, ridicule, blame, scorn, and
reputational attack.

Initial candidates:

- disapproval
- criticism
- belittling
- mockery
- scorn
- resentment
- sarcasm
- moral judgment
- blame
- shaming
- insult
- smear
- denigration
- dehumanization
- dismissal
- condescension

Likely proliferation targets:

- Interaction
- Role
- Situation
- Affect
- Intensity
- ReportClaim
- Uncertainty

Governance rule:

> Judgment and denigration candidates must remain genre-sensitive and traceback-first.
> VAA1 may surface them as indicative social positioning, but must avoid converting them
> into factual claims without analyst review.

### 3.5 Plot / Narration Pack

Purpose: detect traceable candidates for story-world change, narrative function, genre
movement, and mediated narration.

This pack should not merely identify basic narration structure. It should help analysts
understand the cinematic world where characters act and events unfold.

Character understanding asks:

- who feels what?
- who wants what?
- who helps, harms, loves, judges, threatens, consoles?

Plot understanding asks:

- what changes?
- who wants what outcome?
- what blocks them?
- what raises stakes?
- what event shifts the situation?
- what sequence does this moment belong to?
- is this linear, episodic, flashback, montage, commentary, or recap?

## 4. Plot / Narration Canon Coverage

The Plot / Narration Pack should translate classic dramaturgical schemas into shared VAA1
plot-function candidates. VAA1 should not ask which theory is true first. It should ask
what plot function the evidence appears to perform.

### 4.1 Shared Plot Functions

Initial plot-function candidates:

- setup / exposition
- ordinary order
- goal / desire / mission
- inciting disruption
- obstacle
- trial / test
- escalation
- conflict
- reversal
- recognition / revelation
- choice / moral pressure
- suffering / loss
- climax / decisive confrontation
- fall / failure
- victory / resolution
- reintegration
- transformation
- return
- fragmentation / collapse
- irony / exposure
- catharsis / release

### 4.2 Classical Lens Mapping

Aristotle:

- causal necessity
- reversal
- recognition
- suffering
- catharsis

Freytag:

- exposition
- rising action
- climax
- falling action
- resolution / catastrophe

Campbell:

- call
- refusal
- mentor
- threshold
- trials
- abyss
- transformation
- return

Frye:

- comedy / integration
- romance / quest
- tragedy / isolation and fall
- irony / disintegration and exposure

Booker:

- overcoming the monster
- rags to riches
- quest
- voyage and return
- comedy
- tragedy
- rebirth

One evidence span may carry several candidate readings. Example:

```text
0:53.2
Plot function: recognition / revelation
Aristotle: anagnorisis candidate
Freytag: climax candidate
Campbell: transformation threshold candidate
Frye: tragedy or romance hinge candidate
```

### 4.3 Media-Specific Plot Functions

The first iteration should also cover functions that classical schemas do not capture
cleanly enough for VAA1 media analysis:

- montage compression
- flashback / memory
- parallel action
- episodic return
- recap / narrated summary
- voice-over framing
- trailer escalation beat
- withheld information
- false lead
- identity reveal
- relationship shift
- world-state change
- stakes escalation
- genre cue
- tonal shift
- symbolic motif recurrence

### 4.4 Narration / Commentary Subtypes

Initial narration candidates:

- voice-over narrator
- sports commentator
- news commentator
- documentary explainer
- character narrator
- retrospective narrator
- omniscient narrator
- promotional trailer voice
- diegetic storytelling
- reported event summary

These must feed plot and report-writing needs, not only surface structure. Sports
commentary, for example, can identify action, stakes, reversal, victory, defeat, pressure,
and performance evaluation. Documentary explanation can frame evidence, causality,
institutional context, and claim status.

## 5. Lean First Implementation Target

The first implementation should not attempt full plot theory. It should produce useful
plot-function candidates.

Start with:

1. exposition / setup
2. goal / mission
3. obstacle / conflict
4. reversal / revelation
5. resolution / transformation
6. flashback / memory
7. voice-over / commentary
8. montage / trailer escalation
9. stakes escalation
10. episode / scene transition

These ten signals give VAA1 enough coverage to begin plot-aware annotation proliferation
without forcing premature final interpretation.

## 6. Proliferation Contract

Indicative linguistic and plot evidence may create candidate labels across VAA1, but may
not overwrite manual annotations, corrected evidence, or source detections.

Every proliferated label must preserve:

- source evidence ids
- timestamp interval
- speaker / participant references
- pattern basis
- open weights
- confidence state
- review state
- traceback path

Candidate mapping:

```text
directive / request / refusal / agreement / threat
  -> Interaction, Action, Role, Situation

affirmation / approval / encouragement / consolation
  -> Interaction, Role, Affect, Situation

flirting / affection / vow / promise
  -> Interaction, Role, Relationship, Situation

judgment / denigration / smear / scorn
  -> Interaction, Role, Situation, Affect, Intensity, ReportClaim

reported speech / claim boundary
  -> Episode, Scene, ReportClaim, Uncertainty

material process
  -> Action, Movement, Object relation

verbal process
  -> Interaction, Role, Claim

mental process
  -> Role, Affect, Uncertainty

relational process
  -> Identity, Role, Situation

topic shift
  -> Scene, Episode, Narrative phase

repair / repetition
  -> Expression, Interaction, Intensity

addressivity
  -> Interaction, Identification, Role

plot-function candidate
  -> Scene, Episode, Situation, Action, Interaction, Role, Narrative phase, ReportClaim
```

Bulk affirmation should be supported. The analyst should be able to review groups such as:

```text
VAA1 found 34 probable Interaction candidates from speech-act patterns.
VAA1 found 12 probable Plot Function candidates from goal, obstacle, and reversal patterns.
```

The analyst may approve, filter, edit, reject, or leave them as candidates without being
interrupted for every single indication.

## 7. Report-Writing Needs

The SFL + Dependency indicative layer should serve the human report-writing workflow.

Report candidates should be assembled from traceable evidence:

```text
Claim:
  Character A consoles Character B.

Evidence:
  transcript span
  speaker identity candidate
  prosody cue
  expression cue
  bbox/ROI evidence
  source metadata
  manual confirmations/corrections

Status:
  candidate | probable | strongly supported | analyst confirmed | contested

Traceback:
  source timestamp and evidence objects
```

The report UI should eventually support:

- promoting a candidate into a report claim
- demoting a candidate to an uncertainty note
- showing open weights and evidence basis
- preserving source traceback
- exporting claim-evidence tables
- distinguishing observed evidence from interpretation
- preserving analyst edits as authoritative

## 8. Test Regime

First-iteration tests should cover:

- token-level traceback
- timestamp preservation
- manual correction override
- no hidden overwrite of source evidence
- no forced analyst confirmation at every corner
- open weights visible in artifacts
- pattern packs remain separately identifiable
- candidate labels preserve source evidence ids
- genre-sensitive interpretation flags
- nonlinear and episodic narration policy
- report-writing claim candidates preserve evidence chains

## 9. Implementation Boundary

This first iteration should deliver:

- governed pattern-pack definitions
- SFL/dependency event output fields for the five packs
- plot-function candidates for the ten lean plot signals
- candidate label proliferation to core VAA1 label families
- open-weighted scoring and visible confidence state
- traceback to transcript, panels, and source media
- report-writing ready claim candidates

It should not yet attempt:

- full literary theory automation
- final authoritative plot interpretation
- hidden LLM-only interpretation
- overwrite of manual annotations
- automatic high-stakes claims without analyst review

## 10. Bottom Line

The SFL + Dependency layer should become VAA1's substantial indicative layer:

```text
low compute cost,
high interpretive value,
traceback-first,
manual-correction aware,
open-weighted,
genre-sensitive,
plot-aware,
report-writing ready.
```

That is the first-iteration target.
