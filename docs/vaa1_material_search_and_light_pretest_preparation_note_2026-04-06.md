# VAA1 material search and light pretest preparation note

This note is for the phase before major training infrastructure.

Its purpose is to support:

- searching for suitable source materials
- screening candidate corpora
- running lightweight pretests on ordinary machines
- deciding what deserves heavier training or HPC-scale preprocessing later

The basic principle is:

- do not begin with expensive training
- begin with search, screening, sampling, and small controlled pretests

## What this phase is for

This phase should answer:

1. What kinds of source materials are actually available?
2. Which of them are usable under acceptable license terms?
3. Which of them match VAA1’s real use cases?
4. Which cues can already be tested cheaply?
5. Which tasks truly require heavier compute later?

## What counts as a useful candidate source

A candidate source should be assessed against these criteria:

- relevance to VAA1 tasks
- media quality diversity
- genre diversity
- timestamp quality
- annotation quality
- license clarity
- storage size
- preprocessing burden
- multilingual value
- whether it supports traceable evaluation

Do not collect sources just because they are famous.

## The source search workflow

### Step 1. Create a source registry

For every candidate source, record:

- source name
- URL
- source family
  - visual
  - audio
  - text/discourse
  - multimodal
- task relevance
- language coverage
- media type
- annotation type
- license status
  - free/open
  - free but constrained
  - paid/licensed
  - unclear
- estimated size
- access friction
- first VAA1 use case
- notes

This should become a living registry, not a one-off memo.

### Step 2. Pull a small sample only

Before large download or preprocessing:

- obtain the documentation
- obtain schema examples
- obtain a tiny usable sample
- inspect the annotation format
- inspect whether timestamps and segments are usable

Do not begin with full ingestion.

### Step 3. Run a relevance check

Ask:

- does this source help with real VAA1 tasks?
- does it support traceability?
- does it cover mixed genres or only benchmark-clean footage?
- does it help with VAA1’s hardest contexts?
  - news
  - archives
  - degraded footage
  - public-affairs video
  - user video

### Step 4. Run a light pretest

Only small-scale tests at this stage.

Examples:

- can we parse the metadata?
- can we open and sample the media?
- can we align timestamps?
- can we extract transcript/OCR/audio features?
- can we test one cue on 20 to 100 clips?
- can we evaluate one module cheaply on a laptop or workstation?

## Recommended lightweight pretests

### A. Visual pretests

Run these before any serious visual training:

- shot-boundary screening on a small clip set
- shot-size baseline check on sampled clips
- role/character continuity check on a handful of scenes
- INT/EXT and time-of-day plausibility pass
- situational-awareness tag sanity pass

Keep the first visual set small:

- 20 to 50 clips
- multiple genres
- mixed quality
- some degraded material

### B. Audio pretests

Run these cheaply first:

- speech/music/noise separation
- audio environment classification
- active speaker alignment check
- prosody extraction stability
- multilingual ASR spot checks

Keep the first audio test set small:

- news
- drama
- TV show segment
- advertisement
- outdoor/public scene
- indoor/private scene

### C. Text and discourse pretests

Use small, controlled tests:

- transcript accuracy spot check
- OCR accuracy spot check
- language-ID spot check
- rhetorical-structure plausibility check
- cue-to-text alignment check

### D. Multimodal pretests

Do not attempt full multimodal interpretation yet.

First test:

- active speaker alignment
- transcript and visual scene consistency
- OCR and scene relation
- cue conflict detection
- support-chain visibility

## Suitable lightweight compute environments

The purpose here is not speed at all costs.
It is to learn what is worth scaling.

### 1. Household Mac

Use for:

- source inspection
- schema inspection
- tiny sample preprocessing
- UI behavior checks
- single-video cue tests
- logic validation

Do not use for:

- large training jobs
- massive frame extraction
- repeated full-corpus experiments

### 2. Local workstation

Use for:

- modest preprocessing
- batch feature extraction on small corpora
- baseline evaluation
- compact fine-tuning experiments
- environment benchmarking

### 3. HPC / supercomputing later

Reserve for:

- bulk preprocessing
- large-scale feature extraction
- modular model training
- broad evaluation across corpora
- storage/index building

## What to measure in the light pretest phase

Even in small tests, log:

- runtime
- memory burden
- storage impact
- annotation usability
- error rate
- ambiguity rate
- percentage of samples needing human correction
- whether the output is actually useful to VAA1

This phase is already an economics phase.

## Source screening categories

Every candidate source should be placed in one of these:

### Category A. Search now, pretest now

Good fit, manageable size, usable licensing, immediately relevant.

### Category B. Search now, defer pretest

Promising but too heavy, too specialized, or dependent on later infrastructure.

### Category C. Watchlist only

Interesting, but currently too far from the next implementation phase.

### Category D. Do not pursue now

Poor fit, unclear licensing, excessive preprocessing cost, or weak VAA1 relevance.

## Early recommended source priorities

For the light pretest phase, the first priority list should likely be:

### Search and pretest now

- MovieNet / MovieShots
- AVA
- AudioSet
- MUSAN
- MediaSpeech
- Common Voice

### Search now, defer heavier use

- Ego4D
- VoxCeleb
- AMI Meeting Corpus

### Likely later licensed acquisition

- PDTB
- RST
- DiscAlign

## Suggested initial pretest bundles

### Bundle 1. Visual baseline

- 10 news clips
- 10 drama clips
- 10 archive or degraded clips

Test:

- shot segmentation plausibility
- shot-size baseline
- continuity behavior
- situational tag plausibility

### Bundle 2. Audio baseline

- 10 news clips
- 10 television/drama clips
- 10 ads or mixed media clips

Test:

- speech/music/noise
- audio environment
- speaking activity
- prosody stability

### Bundle 3. Multimodal alignment baseline

- 10 clips with strong transcript and visible speaking faces

Test:

- active speaker alignment
- transcript-video consistency
- OCR-scene relation
- support/collision cases

## What this phase should produce

This preparation phase should end with:

1. A source registry
2. A license registry
3. A small sampled corpus bank
4. Pretest logs
5. A recommendation on what moves forward
6. A recommendation on what genuinely needs HPC

## Key warning

Do not confuse:

- availability of data

with:

- suitability for VAA1

or:

- suitability for VAA1 learning environment design

The point of this phase is to reduce waste before heavier investment.

## Bottom line

Before large-scale training, VAA1 should:

- search strategically
- document licensing clearly
- pretest lightly
- measure usefulness and cost
- scale only what proves relevant

This is the right bridge between planning and serious learning-environment construction.

