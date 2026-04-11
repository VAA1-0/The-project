# VAA1-CVAT Access And Annotation Protocol

Date: 2026-04-11
Status: draft protocol based on a successful local connection test
Purpose: define how VAA1 and CVAT should work together for real users, not just for runtime recovery

## Why This Protocol Exists

The local runtime now works well enough to open CVAT from VAA1 and create annotation tasks.  
However, the successful test also showed that a working runtime is not the same thing as a usable analyst workflow.

The current local setup still has important maturity gaps:

- CVAT browser login can belong to the wrong user
- shared `admin/admin123` is still part of the practical recovery path
- repeated task creation can happen during retries
- CVAT exposes more annotation controls than VAA1 analysts should need
- VAA1 does not yet automatically surface CVAT annotations into the VAA1 master schema

This document defines the intended operating model.

## Confirmed Local Baseline

Observed in the successful connection test on 2026-04-11:

- Docker-backed CVAT stack was online
- VAA1 frontend and backend were online
- VAA1 annotation page created CVAT tasks
- CVAT eventually created valid interpolation jobs with segments
- VAA1 stored a nonzero `cvatID`
- annotation canvas opened inside VAA1 without `403`
- browser user shown in CVAT was `admin`

This proves the technical path exists.  
It does not yet prove the workflow is mature for many users.

## Governing Product Principle

VAA1 must remain the analyst’s primary workspace.

CVAT may be used as the annotation engine, but the analyst should not be forced to think in CVAT-native administration, ports, route patterns, or raw export taxonomy.

In other words:

- VAA1 is the command center
- CVAT is the annotation engine
- VAA1 must explain, frame, and absorb the annotation work

## User Model

Every real user should have an individual CVAT identity.

Do not rely on shared day-to-day credentials.

### Roles

- `Platform admin`
  Creates users, resets access, manages emergency recovery, owns system settings.
- `Project manager`
  Organizes tasks, assigns work, supervises annotation readiness.
- `Annotator / analyst`
  Performs the actual annotation work inside the guided VAA1 workflow.
- `Reviewer / observer`
  Reads or reviews outputs without broad platform access.

### Shared Accounts

Shared accounts should be restricted to emergency-only use.

Current local example:

- `admin/admin123`

This is acceptable only as a temporary local recovery credential during development.

Target rule:

- no ordinary analyst should need the shared admin account

## First-Time Access Protocol

First-time annotation access must be empowering and instructive.

The analyst should not be dropped into a tool mismatch or permission failure.

### Intended First-Time Sequence

1. User signs into VAA1.
2. User opens an analysis and clicks `Annotations`.
3. VAA1 checks whether the user has a valid CVAT session and permission.
4. If not yet connected, VAA1 shows a clear onboarding message:
   - what annotation workspace is
   - why the connection is needed
   - that this is usually a one-time setup
5. User clicks `Connect Annotation Workspace`.
6. VAA1 establishes or verifies the CVAT account/session.
7. User returns automatically to the same annotation task.

### Tone Requirement

The first-time message should feel:

- calm
- competent
- empowering
- procedural without sounding technical

It should never feel like:

- a raw infrastructure failure
- a permission panic
- a route/port puzzle

## Repeated Use Protocol

After first-time setup, annotation should become routine.

### Intended Repeated Sequence

1. User opens analysis in VAA1.
2. User clicks `Annotations`.
3. VAA1 checks the stored `cvatID` and session state.
4. If valid:
   - open the correct CVAT job directly
   - do not create a duplicate task
5. If session expired:
   - show a small reconnect prompt
   - restore the user to the same task after reconnect

### Explicit Anti-Pattern

Repeated annotation opens must not create duplicate CVAT tasks for the same analysis unless the user explicitly requests a fresh task.

## Current Duplicate-Task Risk

Observed locally during iterative testing:

- multiple tasks with the same video name were created
- some were failed or partial attempts
- later ones were valid interpolation tasks

Interpretation:

- the current system can create duplicate tasks during recovery/retry flows

Protocol consequence:

- VAA1 must check for an existing valid `cvatID` before creating a new task
- duplicate task creation must be treated as a workflow defect

## Audio Policy

Observed locally:

- CVAT did not provide a useful audio experience for annotation

This matters because VAA1 analysis is multimodal.

### Protocol Position

CVAT should be treated primarily as a visual annotation engine unless proven otherwise.

If annotation decisions depend on audio, one of the following must be true:

1. VAA1 provides synchronized transcript/audio context beside CVAT, or
2. VAA1 provides a parallel media panel with sound while CVAT handles frame-based labeling

### Product Rule

If sound matters to annotation quality, VAA1 must provide that context directly.  
Analysts should not be expected to improvise around missing audio support.

## Annotation Style And Label Policy

Observed locally:

- CVAT’s annotation style/tooling is broad
- the available list is long and cryptic for a VAA1 analyst

### Protocol Position

VAA1 should never expose analysts to raw CVAT complexity without guidance.

### Required VAA1 Behavior

VAA1 should define and communicate:

- which annotation mode is approved
- which labels are valid
- which object types are in-scope
- what should not be annotated
- how annotation contributes to the VAA1 schema

### Target Product Behavior

VAA1 should provide a reduced annotation profile such as:

- approved label set
- approved workspace mode
- approved export mapping
- practical examples of correct annotation

In effect:

- CVAT remains powerful in the background
- VAA1 presents only the subset needed for the current method

## VAA1 Annotation Surfacing Requirement

Observed locally:

- CVAT opened successfully
- but VAA1-native annotations did not automatically surface back into the VAA1 master schema

### Protocol Position

Automatic surfacing is the target behavior.

Analysts should be able to see that their annotation work is entering the VAA1 model, not disappearing into a separate tool.

### Preferred Behavior

VAA1 should show:

- linked CVAT task status
- linked job status
- imported or synchronized annotation status
- mapping into the VAA1 master schema

### Temporary Fallback

If manual export/import is still required, then a formal exchange protocol is mandatory.

That protocol must define:

- source format
- export step
- import step
- field mapping
- validation rules
- schema ownership
- error handling and versioning

## Parallel Workspace Requirement

VAA1 should not force the analyst to mentally switch between unrelated worlds.

### Target Interaction Model

The annotation window should run parallel with VAA1, not as an isolated detour.

That means VAA1 should eventually provide:

- a synchronized CVAT panel or embedded workspace
- the video or contextual reference in parallel
- visible relation to the VAA1 annotation master schema
- practical instructions for the analyst in the same working context

### Analyst Experience Goal

The analyst should understand:

- what they are annotating
- why they are annotating it
- how the annotation will be used
- where the result will appear in VAA1

## Session And Permission Policy

The successful test also exposed a critical rule:

- a technically valid task is not enough
- the browser must be logged into the correct CVAT user

Observed real failure mode:

- task created by `admin`
- browser still logged into another user
- iframe returned `403`

### Protocol Requirement

VAA1 must explicitly own the user-session story.

The analyst should not have to debug:

- CVAT username mismatch
- permission mismatch
- stale browser session

### Desired Future State

One of these must eventually be implemented:

1. shared identity or SSO-style handoff
2. VAA1-managed CVAT browser session bootstrap
3. clearly guided reconnect flow with guaranteed return to the same annotation job

## What VAA1 Must Tell The Analyst

VAA1 should give the analyst practical, confidence-building information before annotation starts.

Minimum items:

- the annotation objective
- the approved label set
- what evidence to look for
- what not to over-annotate
- how this task contributes to the VAA1 method
- whether audio/transcript context matters
- where the completed annotation will appear in VAA1

This information should be delivered in product language, not developer language.

## Immediate Operating Rules

Until the full protocol is implemented in product form, use these interim rules:

1. Each real user should have their own CVAT account.
2. Shared admin credentials should be used only for emergency recovery.
3. Analysts should enter annotation through VAA1, not by manually browsing CVAT tasks first.
4. If annotation fails with `403`, first verify the browser’s current CVAT user.
5. If annotation opens, verify that the correct `cvatID` is being reused rather than creating duplicates.
6. If manual export/import is used, treat it as a governed protocol step, not an informal workaround.

## Next Deliverables

This protocol implies three follow-up deliverables:

1. `VAA1-CVAT user onboarding flow`
   - first-time connect
   - reconnect
   - session expiry handling

2. `VAA1-CVAT annotation exchange protocol`
   - export/import format
   - schema mapping
   - validation and versioning

3. `VAA1 analyst guidance layer`
   - practical instructions
   - approved labels and annotation style
   - visible relation to the VAA1 master schema

## Current Conclusion

The local system has crossed an important threshold:

- connection can work
- task creation can work
- job creation can work
- embedded CVAT can open inside VAA1

But the workflow is not yet mature enough for many users without a formal protocol.

This document should therefore be treated as the design baseline for the next implementation steps.

## Appendix: Current Taxonomy Snapshot For VAA1-CVAT Annotation

This appendix is included for second-opinion review and workflow upgrading.

It separates:

- taxonomies that are already formalized in code
- controlled vocabularies that are partially formalized
- draft schemas that are still primarily defined in working notes

This distinction matters because CVAT-facing dropdowns and VAA1-facing interpretation should not be confused with each other.

### Status Key

- `Formalized in code now`
  Present as actual options or weighting structures in the current codebase.
- `Controlled vocabulary, not yet full dropdown`
  Present as a meaningful vocabulary, but not yet surfaced as a strict dropdown list.
- `Draft schema`
  Present in notes and protocol logic, but not yet fully encoded as a production taxonomy.

## A. Media Genre Taxonomy With Subcategories

Status:

- `Formalized in code now`

Current top-level media genres:

- `news`
  - breaking news
  - studio anchor read
  - field report
  - panel discussion
  - investigative segment
- `interview`
  - studio interview
  - field interview
  - profile interview
  - vox pop
  - interrogative interview
- `documentary`
  - tv documentary
  - observational documentary
  - explanatory documentary
  - participatory documentary
  - archival documentary
  - docudrama
  - biography documentary
  - music documentary
  - science documentary
- `research video`
  - experiment recording
  - research interview
  - counseling session
  - fieldnotes video
  - observation session
  - lab demonstration
- `drama / fiction`
  - comedy
  - tragedy
  - suspense / thriller
  - romance
  - horror
  - parody / satire
  - epic / historical
  - action / adventure
  - crime / detective
  - sci-fi
  - fantasy
  - melodrama
- `advertising / promo`
  - commercial spot
  - brand film
  - product demo
  - campaign promo
  - teaser
- `music video`
  - performance clip
  - narrative clip
  - lyric video
  - live session
  - dance-driven clip
- `stand-up / performance`
  - stand-up set
  - monologue
  - stage sketch
  - spoken word
  - live act
- `vlog`
  - daily vlog
  - personal update
  - travel vlog
  - confessional vlog
  - family vlog
- `explainer / commentary`
  - explainer
  - commentary
  - essay video
  - analysis breakdown
  - news commentary
- `livestream / talk-to-camera`
  - solo livestream
  - chat stream
  - creator monologue
  - Q&A stream
  - event stream
- `podcast video`
  - studio podcast
  - remote podcast
  - panel podcast
  - interview podcast
  - video essay conversation
- `reaction video`
  - live reaction
  - duet / stitch reaction
  - commentary reaction
  - trailer reaction
  - watch-along reaction
- `tutorial / how-to`
  - screen tutorial
  - hands-on demo
  - step-by-step guide
  - lesson
  - workshop
- `short-form social clip`
  - short skit
  - trend clip
  - micro-vlog
  - promo clip
  - highlight snippet
- `meme / remix / edit`
  - remix
  - supercut
  - meme edit
  - mashup
  - found-audio edit
- `archive / found footage`
  - newsreel
  - advertisement archive
  - newscast archive
  - news archive
  - home video archive
  - surveillance clip
  - historical footage
  - recovered media
- `institutional / campaign / public information`
  - press conference
  - campaign message
  - public information notice
  - ceremonial address
  - organizational briefing
- `webconferencing / meetings / webcalls`
  - team meeting
  - webinar
  - remote interview
  - panel call
  - classroom session
- `other / mixed`
  - hybrid format
  - unclear / mixed genre
  - other

## B. Expression Taxonomy Per Genre

Status:

- `Controlled vocabulary, not yet full dropdown`

Important current reality:

- `performance_expression` is currently a free-text field in the UI
- the expression-weighting engine already uses a controlled family of interpretive labels
- this family is the strongest current candidate for a standardized annotation vocabulary

Current expression-family labels in code:

- amused
- assertive
- composed
- concerned
- emphatic
- focused
- formal_neutral
- reflective
- reassuring
- serious
- skeptical
- warm

These are currently weighted by:

- media genre
- genre subtype
- situational genre
- situational subtype
- privacy axis
- expertise axis

Examples of genre-sensitive expression tendencies already encoded:

- `news`
  - serious
  - focused
  - formal_neutral
  - concerned
  - composed
- `interview`
  - reflective
  - focused
  - skeptical
  - serious
- `institutional / campaign / public information`
  - formal_neutral
  - assertive
  - serious
  - reassuring
- `drama / fiction`
  - emphatic
  - amused
  - reflective
  - assertive
- `vlog`
  - warm
  - amused
  - emphatic
  - reflective

Examples of subtype-sensitive expression tendencies already encoded:

- `breaking news`
  - concerned
  - emphatic
  - serious
- `studio anchor read`
  - formal_neutral
  - serious
  - composed
- `profile interview`
  - reflective
  - warm
  - focused
- `interrogative interview`
  - skeptical
  - focused
  - assertive
- `campaign message`
  - emphatic
  - assertive
  - warm
- `confessional vlog`
  - reflective
  - warm
  - concerned

Recommended protocol position:

- use the 12-label expression family above as the current controlled vocabulary
- allow free-text only as analyst note or override rationale
- do not treat raw detector emotions such as `happy`, `sad`, or `angry` as the final VAA1 annotation vocabulary

## C. Objects Per Genre

Status:

- `Draft schema`

Important current reality:

- this is not yet a fully formalized dropdown taxonomy in the product
- the most structured current source is the object build-up note
- CVAT labels should eventually be narrowed to approved VAA1 object schemas rather than left generic

Current genre-oriented object schema directions:

- `Action / Spy / Thriller`
  - firearm-likely object
  - long-weapon-likely object
  - tactical gear
  - explosive / blast cue
  - surveillance device
  - command / control interface
  - pursuit vehicle
  - luxury-status prop
  - security checkpoint cue
- `Horror`
  - blade / sharp-threat object
  - ritual object
  - masking / disguise object
  - confinement cue
  - body-remains cue
  - medical / invasive instrument
- `News / Journalism / Documentary`
  - microphone
  - press camera
  - podium
  - official document
  - protest sign
  - public-address equipment
  - institutional emblem
- `Domestic / Intimate / Everyday`
  - dining prop
  - childcare object
  - grooming object
  - cleaning object
  - personal-device object
  - leisure object
- `Web / Social / Platform Video`
  - ring light
  - headset
  - webcam setup
  - streamer microphone
  - chat / interface screen
  - phone-as-recording-device

Recommended protocol position:

- treat this as the current draft schema for second-opinion upgrading
- next implementation step should convert it into a controlled VAA1 object-label profile per annotation mode
- CVAT should not expose a long uncontrolled label list if VAA1 only wants a small approved set

## D. Scenery / Scenario / Situational Taxonomy

Status:

- `Formalized in code now` for situational genre and situational subtype
- `Draft schema` for the deeper scenery / scenario model

### D1. Current Situational Genre Dropdown

Current top-level situational genres:

- `briefing`
  - press briefing
  - status update
  - organizational briefing
  - explainer briefing
- `confrontation`
  - argument
  - interrogation
  - accusation
  - disciplinary exchange
- `celebration`
  - party
  - ceremony
  - congratulation
  - festive gathering
- `mourning`
  - memorial
  - condolence
  - grief response
  - funeral-related scene
- `negotiation`
  - bargaining
  - mediation
  - diplomatic exchange
  - decision-making
- `confession`
  - apology
  - disclosure
  - emotional admission
  - private confession
- `testimony`
  - witness account
  - statement to authority
  - interview testimony
  - documentary testimony
- `instruction`
  - tutorial
  - coaching
  - classroom instruction
  - procedural guidance
- `debate`
  - formal debate
  - panel debate
  - argumentative exchange
  - cross-talk
- `interview`
  - profile interview
  - investigative interview
  - webcall interview
  - vox pop
- `announcement`
  - public announcement
  - internal update
  - launch reveal
  - policy statement
- `emergency response`
  - crisis briefing
  - rescue coordination
  - urgent public warning
  - on-scene response
- `intimate interaction`
  - romantic exchange
  - family intimacy
  - emotional support
  - making love
- `routine coordination`
  - meeting
  - scheduling
  - teamwork
  - administrative coordination
- `leisure / socializing`
  - hanging out
  - chatting
  - public leisure
  - game / pastime
- `performance / entertainment`
  - performance
  - rehearsal
  - stand-up
  - musical moment
- `travel / mobility`
  - commute
  - transit update
  - journey segment
  - arrival / departure
- `personal care / inner life`
  - grooming
  - self-talk
  - reflection
  - therapeutic / self-care moment

### D2. Current Situational Axes Already Formalized In UI

- `Privacy axis`
  - public
  - semi-public
  - private
- `Expertise axis`
  - professional
  - mixed professional-lay
  - lay / non-professional

### D3. Deeper Scenery / Scenario Model For Upgrade Work

The situational-awareness note proposes a broader layered scenery / scenario structure that should inform later VAA1-CVAT protocol upgrades.

Recommended deeper axes:

- `Domain`
  - at home
  - at work or study
  - in public / out and about
  - social & relational scenes
  - personal care & inner life
  - mobility & transition
  - leisure & cultural participation
  - nature & outdoors
  - consumption & bureaucracy
- `Time band`
  - morning
  - daytime
  - evening
  - night
- `Social mode`
  - alone
  - dyadic
  - family
  - group
  - institutional
  - private
  - public
- `Situational stance axes`
  - private / semi-public / public
  - lay / mixed professional-lay / professional
  - formal / informal
  - institutional / personal
  - routine / exceptional
  - staged / spontaneous

Recommended protocol position:

- current product can already use situational genre, subtype, privacy axis, and expertise axis
- the deeper scenery / scenario ontology should be treated as the upgrade path for better analyst guidance and better CVAT-to-VAA1 mapping

## Practical CVAT Relevance

These taxonomy layers matter directly to CVAT workflow.

Why:

- CVAT label choices should align with approved VAA1 schema categories
- VAA1 dropdowns should tell the analyst which interpretive context applies before annotation begins
- annotation should not be produced in a taxonomy vacuum
- exported or synchronized annotations should land in a stable VAA1 master-schema structure

Immediate implication:

- `Genre`
- `Genre subtype`
- `Situational genre`
- `Situational subtype`
- `Privacy axis`
- `Expertise axis`

should already be treated as required context fields for guided annotation.

Near-term upgrade implication:

- `Expression family`
- `Object schema per genre`
- `Scenery / scenario layers`

should be tightened into a formal annotation-exchange contract so CVAT work and VAA1 interpretation use the same language.
