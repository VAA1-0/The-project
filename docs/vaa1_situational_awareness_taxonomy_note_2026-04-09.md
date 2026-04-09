# VAA1 Situational Awareness Taxonomy Note

Date: 2026-04-09
Status: working taxonomy draft
Scope: operational ontology and learning-loop implications for situational awareness in VAA1

## 1. Why this track matters

Situational awareness in VAA1 should not be reduced to a single genre label. It is a layered description of:

- where something is taking place
- when in the day or social cycle it takes place
- what kind of activity is occurring
- how public or private the situation is
- how professional or lay the situation is
- how social relations are configured

This makes situational awareness a major interpretive bridge between:

- visual cues
- audio cues
- transcript and OCR
- metadata
- multimodal interpretation
- later learning and calibration

## 2. Recommended structure

Situational awareness should be modeled as a layered ontology with separate but combinable axes.

### A. Domain

- at home
- at work or study
- in public / out and about
- social & relational scenes
- personal care & inner life
- mobility & transition
- leisure & cultural participation
- nature & outdoors
- consumption & bureaucracy

### B. Time band

- morning
- daytime
- evening
- night

### C. Activity / scene type

Each domain should carry a set of activity types rather than forcing one universal flat list.

#### At Home

Morning:
- waking up / morning hygiene
- preparing or having breakfast
- getting ready
- coordinating schedules

Daytime:
- remote work or study
- domestic chores
- childcare or pet care
- receiving deliveries or service visits
- home workouts / gardening

Evening:
- returning home and decompressing
- cooking and dining
- watching TV / streaming / gaming
- household conversations or family time
- preparing for the next day

Night:
- relaxation rituals
- intimacy or solitude moments
- sleep routines

#### At Work or Study

Morning:
- commuting / arriving
- checking messages / setting priorities
- coffee break small talk / morning sync

Daytime:
- meetings / collaborative tasks
- focused individual work
- lunch break sociality
- administrative routines

Evening:
- wrapping up
- afterwork socializing or networking
- leaving the office / decompression

#### In Public / Out and About

Morning:
- commuting / public transport
- buying coffee / groceries / errands
- brief street interactions

Daytime:
- shopping / appointments / bureaucracy
- cafe or restaurant lunches
- cultural visits
- exercising in public space

Evening:
- social dining / bars / cinemas / events
- public transport rush / nightlife transitions

Night:
- partying / nightlife scenes
- street interactions / returning home
- urban solitude moments

#### Social & Relational Scenes

- family gatherings
- friendship encounters
- romantic dates
- parenting and school events
- community or neighborhood participation
- flirtation / seductive interaction

#### Personal Care & Inner Life

- exercising / gym / yoga
- meditation / prayer / reflection
- reading / creative hobbies
- therapy / counseling / journaling
- health appointments / self-maintenance
- sexual self-care

#### Mobility & Transition

- daily commute
- travel routines
- errands by foot or vehicle
- waiting / queuing scenes

#### Leisure & Cultural Participation

- attending events
- volunteering / activism / club participation
- digital leisure
- hobby scenes

#### Nature & Outdoors

- walking / hiking / running
- seaside, lake, or forest activities
- gardening / outdoor maintenance
- seasonal rituals

#### Consumption & Bureaucracy

- shopping
- banking / post office
- medical or official appointments
- online ordering and returns
- utilities, taxes, or paperwork

### D. Social mode

- alone
- dyadic
- family
- group
- institutional
- private
- public

### E. Situational stance axes

- private / semi-public / public
- lay / mixed professional-lay / professional
- formal / informal
- institutional / personal
- routine / exceptional
- staged / spontaneous

## 3. Important methodological rule

Situational awareness should not be treated as one flat genre list. VAA1 should be able to represent combinations like:

- at home + evening + cooking and dining + family + private
- in public / out and about + daytime + bureaucracy + institutional + professional
- mobility & transition + morning + commute + solitary + semi-public

This layered representation is much closer to actual audiovisual meaning than one coarse scene tag.

## 4. Sensitive categories

Intimate or sexual categories should be handled conservatively.

Recommendations:

- prefer neutral ontology wording
- require unusually strong multimodal support before surfacing them
- preserve uncertainty explicitly
- avoid overclaiming from one visual cue or one conversational hint

Examples:

- `intimate interaction` is safer than premature final claims
- `sexual self-care` should remain highly guarded and context-dependent

## 5. Relation to genre

Situational awareness is related to genre but should not be collapsed into genre.

Examples:

- a `vlog` may contain `at home + morning + getting ready`
- a `news` item may contain `in public / out and about + emergency response`
- a `documentary` may contain `nature & outdoors + seasonal rituals`
- a `webconference` may contain `at work or study + daytime + meeting`

So:

- media genre describes the type of media object
- situational awareness describes the lived or staged situation inside it

## 6. Adjustable detection-frame integration

These modalities should eventually be adjustable within detection frames and record panels.

Reason:

- analysts can correct situational and genre context while reviewing material
- the correction becomes part of the live interpretive context
- the same act improves immediate reading and later learning

Recommended operational principle:

- context axes should be editable in-frame, not only in static metadata forms
- edits should remain source-linked and timestamp-aware where relevant
- corrections should update downstream interpretive layers as soon as technically viable
- raw context inference and analyst override should both remain traceable

This would allow:

- better immediate interpretation
- richer traceback
- stronger calibration sets
- learning-module refinement from real analyst use

## 7. Intertextual and mixed-genre indication

Genres and situational modes often mix intertextually.

That mixing should not be treated as a nuisance only. It is itself analytically meaningful and can function as audiovisual wordplay.

Examples:

- news using dramatic suspense cues
- documentary borrowing advertising polish
- vlog adopting institutional briefing style
- parody remixing archive footage with current commentary
- webcalls reproducing talk-show or panel-show conventions

Recommended rule:

- VAA1 should later support mixed-genre indication, not just one winning label
- runner-up and hybrid readings should remain visible when margins are small
- genre blending should be available as a traceable analytical feature

Possible future fields:

- primary_genre
- secondary_genre
- situational_primary
- situational_secondary
- intertextual_mix_note
- audiovisual_wordplay_indicator

## 8. Learning-module implication

This taxonomy fits the VAA1 learning model well because it supports:

- layered annotation
- contestable interpretation
- correction-based refinement
- multimodal support logic
- hybrid and ambiguous readings

So situational awareness should be treated as:

- an ontology track
- a metadata track
- a correction track
- a learning-module track

not merely as a decorative UI category.

## 9. Recommended next implementation order

1. keep the current metadata dropdown structure
2. expand situational choices into this layered model
3. allow post-upload editing in Source Media
4. later allow time-linked situational adjustments inside detection and interpretation panels
5. later connect those adjustments to traceback and learning-module ingestion

## 10. Summary principle

Situational awareness in VAA1 should be:

- layered rather than flat
- editable rather than frozen
- traceable rather than hidden
- contestable rather than treated as truth
- useful both for immediate interpretation and for long-term learning
