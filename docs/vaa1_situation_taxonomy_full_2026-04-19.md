# VAA1 Full Situation Taxonomy 2026-04-19

This document records the full applied VAA1 situation taxonomy currently represented in code.

This is not a soft summary. These are the explicit values that should guide workflow planning, annotation UI review, and later schema formalization.

## Situation Schema

### Event

`event.type`

- `crisis`
- `routine`
- `institutional`
- `turning_point`
- `transition`
- `season_change`

`event.description`

- free text string

### Interaction

`interaction.mode`

- `conflict`
- `cooperation`
- `hierarchy`
- `intimacy`
- `solitude`

`interaction.actors[].role`

- `agent`
- `observer`
- `target`

`interaction.actors[].relation`

- `friend`
- `stranger`
- `family`
- `authority`
- `unknown`

### Communication

`communication.type`

- `informing`
- `persuading`
- `performing`
- `interviewing`
- `witnessing`

`communication.channel`

- `speech`
- `text`
- `gesture`
- `multimodal`

### Experience

`experience.affect`

- `joy`
- `tension`
- `fear`
- `calm`
- `intimacy`
- `ambiguity`

`experience.intensity`

- float from `0.0` to `1.0`

### Context

`context.space`

- `home`
- `work`
- `public`
- `nature`
- `digital`

`context.setting_detail`

- free text string

`context.social_density`

- `alone`
- `pair`
- `group`
- `crowd`

### Time

`time.phase`

- `morning`
- `daytime`
- `evening`
- `night`

`time.seasonal_phase`

- `spring`
- `summer`
- `autumn`
- `winter`
- `season_change`

`time.narrative_role`

- `setup`
- `build`
- `climax`
- `aftermath`
- `loop`

### Epistemic

`epistemic.state`

- `known`
- `uncertain`
- `revealed`
- `contested`

`epistemic.source`

- `expert`
- `participant`
- `observer`
- `algorithm`

### Normative

`normative.frame`

- `moral`
- `legal`
- `neutral`
- `contested`

`normative.evaluation`

- `positive`
- `negative`
- `ambiguous`

### Function

`function.media_role`

- `attention`
- `narrative`
- `context`
- `emotion`
- `identity`

### Multimodal

`multimodal.composition`

- `talking_head`
- `observational`
- `montage`
- `hybrid`

`multimodal.elements`

- `speech`
- `music`
- `text_overlay`
- `object_detection`

### Person Situation

`person_situation.domain`

- `home`
- `work`
- `public`
- `social_relational`
- `inner_life`
- `mobility`
- `leisure`
- `nature`
- `consumption`

`person_situation.subcategory`

- domain-specific string

`person_situation.activity`

- activity-specific string

## Situational Genre Values

These are the current high-level situational genre values.

- `crisis`
- `routine`
- `institutional`
- `turning_point`
- `transition`
- `season_change`
- `briefing`
- `confrontation`
- `celebration`
- `mourning`
- `negotiation`
- `confession`
- `testimony`
- `instruction`
- `debate`
- `interview`
- `announcement`
- `emergency response`
- `intimate interaction`
- `routine coordination`
- `leisure / socializing`
- `performance / entertainment`
- `travel / mobility`
- `personal care / inner life`
- `at home`
- `at work`
- `private time`
- `public everyday`
- `transit`

## Situational Subgenre Values

### crisis

- `emergency`
- `threat escalation`
- `urgent response`
- `breakdown`

### routine

- `everyday repetition`
- `ordinary coordination`
- `habitual action`
- `maintenance`

### institutional

- `bureaucratic process`
- `formal authority`
- `organizational procedure`
- `public service`

### turning_point

- `revelation`
- `decision point`
- `narrative reversal`
- `threshold moment`

### transition

- `arrival`
- `departure`
- `threshold crossing`
- `between activities`
- `waiting`
- `preparation`
- `handover`
- `returning`

### season_change

- `spring transition`
- `summer transition`
- `autumn transition`
- `winter transition`
- `first snow`
- `thaw`
- `heatwave`
- `holiday season shift`
- `school/work season change`
- `seasonal routine change`

### briefing

- `press briefing`
- `status update`
- `organizational briefing`
- `explainer briefing`

### confrontation

- `argument`
- `interrogation`
- `accusation`
- `disciplinary exchange`

### celebration

- `party`
- `ceremony`
- `congratulation`
- `festive gathering`

### mourning

- `memorial`
- `condolence`
- `grief response`
- `funeral-related scene`

### negotiation

- `bargaining`
- `mediation`
- `diplomatic exchange`
- `decision-making`

### confession

- `apology`
- `disclosure`
- `emotional admission`
- `private confession`

### testimony

- `witness account`
- `statement to authority`
- `interview testimony`
- `documentary testimony`

### instruction

- `tutorial`
- `coaching`
- `classroom instruction`
- `procedural guidance`

### debate

- `formal debate`
- `panel debate`
- `argumentative exchange`
- `cross-talk`

### interview

- `profile interview`
- `investigative interview`
- `webcall interview`
- `vox pop`

### announcement

- `public announcement`
- `internal update`
- `launch reveal`
- `policy statement`

### emergency response

- `crisis briefing`
- `rescue coordination`
- `urgent public warning`
- `on-scene response`

### intimate interaction

- `romantic exchange`
- `family intimacy`
- `emotional support`
- `making love`

### routine coordination

- `meeting`
- `scheduling`
- `teamwork`
- `administrative coordination`

### leisure / socializing

- `hanging out`
- `chatting`
- `public leisure`
- `game / pastime`

### performance / entertainment

- `performance`
- `rehearsal`
- `stand-up`
- `musical moment`

### travel / mobility

- `commute`
- `transit update`
- `journey segment`
- `arrival / departure`

### personal care / inner life

- `grooming`
- `self-talk`
- `reflection`
- `therapeutic / self-care moment`

### at home

- `home morning`
- `home daytime`
- `home evening`
- `home night`
- `domestic routine`
- `family time`
- `remote work at home`

### at work

- `work morning arrival`
- `work daytime focused work`
- `work daytime meeting`
- `work daytime collaboration`
- `work evening wrap-up`
- `afterwork transition`

### private time

- `private morning`
- `private daytime`
- `private evening`
- `private night`
- `solitude`
- `intimacy`
- `decompression`
- `self-care`

### public everyday

- `errands`
- `shopping`
- `appointment`
- `bureaucracy`
- `cafe visit`
- `restaurant`
- `street interaction`

### transit

- `commute`
- `walking route`
- `public transport`
- `car transit`
- `arrival`
- `departure`
- `waiting in transit`

## Person Situation Taxonomy

### home / morning

- `waking_up`
- `morning_hygiene`
- `breakfast`
- `getting_ready`
- `schedule_coordination`

### home / daytime

- `remote_work`
- `domestic_chores`
- `childcare`
- `pet_care`
- `receiving_deliveries`
- `home_workout`
- `gardening`

### home / evening

- `decompression`
- `cooking_dining`
- `media_consumption`
- `family_time`
- `preparation_next_day`

### home / night

- `relaxation_ritual`
- `reading`
- `journaling`
- `intimacy`
- `solitude`
- `sleep_routine`

### work / morning

- `commuting`
- `arrival`
- `priority_setting`
- `morning_sync`

### work / daytime

- `meetings`
- `collaboration`
- `focused_work`
- `administration`
- `lunch_social`

### work / evening

- `reporting`
- `wrap_up`
- `afterwork_social`
- `leaving_work`
- `mental_decompression`

### public / morning

- `public_transport`
- `errands`
- `street_interaction`

### public / daytime

- `shopping`
- `appointments`
- `bureaucracy`
- `cafe_visit`
- `restaurant`
- `cultural_visit`
- `public_exercise`

### public / evening

- `social_events`
- `cinema`
- `nightlife_transition`

### public / night

- `nightlife`
- `street_interaction`
- `returning_home`
- `urban_solitude`

### social_relational

- `family_gathering`
- `friend_meeting`
- `romantic_date`
- `parenting_event`
- `community_participation`
- `emotional_exchange`
- `bonding`
- `conflict_discussion`
- `intimate_conversation`
- `physical_intimacy`
- `sexual_interaction`
- `flirtation`
- `seduction`
- `shared_silence`

### inner_life

- `exercise`
- `gym`
- `yoga`
- `meditation`
- `prayer`
- `reflection`
- `reading`
- `creative_hobby`
- `therapy`
- `counseling`
- `journaling`
- `health_appointment`
- `self_maintenance`
- `self_intimacy`

### mobility

- `commute`
- `travel`
- `airport_routine`
- `train_station`
- `hotel_checkin`
- `errands_mobility`
- `waiting`
- `queueing`

### leisure

- `concert`
- `sports_event`
- `theater`
- `festival`
- `volunteering`
- `activism`
- `club_participation`
- `digital_leisure`
- `gaming`
- `streaming`
- `hobby_activity`

### nature

- `walking`
- `hiking`
- `running`
- `swimming`
- `forest_activity`
- `gardening`
- `outdoor_maintenance`
- `picnic`
- `seasonal_ritual`

### consumption

- `shopping`
- `banking`
- `post_office`
- `medical_visit`
- `official_appointment`
- `online_ordering`
- `returns`
- `paperwork`
- `taxes`
- `utilities_management`

## Flattened UI Values

For the native `Situational taxonomy` dropdown, nested person-situation values are flattened as:

```text
domain / subcategory / activity
```

or, for non-time-banded domains:

```text
domain / activity
```

Examples:

- `home / morning / waking_up`
- `work / daytime / focused_work`
- `public / night / returning_home`
- `social_relational / flirtation`
- `inner_life / reflection`
- `mobility / queueing`
- `nature / seasonal_ritual`
- `consumption / official_appointment`
