# VAA1 learning model training

This note draws together the planning discussion on VAA1 learning, corpus strategy, multimodal scope, and learning-environment design.

The main principle is simple:

- VAA1 should not be trained as one giant end-to-end black box.
- VAA1 should be built as a layered learning environment.
- The learning environment should eventually absorb analyst corrections, provenance, and multimodal support relations.
- `Constellational support` remains the governing method principle.

## What VAA1 is actually trying to learn

VAA1 is not only learning:

- visual detection
- audio recognition
- transcript accuracy

It is also learning:

- support relations between modalities
- when evidence is insufficient
- when cues converge
- when cues conflict
- how human correction should stand while raw output remains preserved

So the training target is not just `classification`.
It is `traceable multimodal interpretation under governed support`.

## Early major training tracks

The following tracks should be included early in the design, even if they are not all implemented immediately:

1. Visual cue learning
- shot size
- transition detection
- movement
- composition
- subject arrangement
- camera angle
- role and character continuity

2. Situational awareness learning
- `INT / EXT`
- morning / day / evening / night
- home / work / study
- public / private
- social / relational
- mobility / transition
- leisure / culture
- nature / outdoors
- consumption / bureaucracy
- sport
- intimacy / sexual context
- personal care / inner life

3. Audio cue learning
- speech / music / noise separation
- environmental sound recognition
- mass-media audio environments
- prosodic patterns
- speaker activity alignment

4. Text and discourse learning
- language detection
- word and transcript accuracy
- OCR-text integration
- rhetorical structure
- discourse relations

5. Dramatic understanding learning
- scene function
- tension and conflict cues
- role alignment
- motivation hypotheses
- narrative directionality
- later: plot structure

6. Learning-environment design
- corpus registry
- ontology registry
- experiment tracking
- benchmark splits
- feedback ingestion
- compute/cost management

## Corpus families VAA1 will need

VAA1 should plan for multiple corpus families, not one corpus.

### 1. Visual corpus

Purpose:
- cinematic cues
- role and character continuity
- scene-bound visual interpretation

VAA1-specific need:
- role and character continuum detection must be part of the baseline

Useful existing sources:

#### MovieNet
- Best early visual base for VAA1-style cinematic and character work.
- Includes character bbox and ID, scene segmentation, place/action tags, and shot cinematic style.
- Official site: https://movienet.github.io/
- ECCV project page: https://movienet.github.io/projects/eccv20movienet.html
- License/access:
  - Publicly presented as `freely available`.
  - The official site does not clearly present a standard open license on the main dataset page.
  - Treat as `free to access, but license clarity should be checked before redistribution`.
- Status for VAA1:
  - Very promising.
  - Use with license caution.

#### MovieShots / MovieNet shot style material
- Useful for shot scale and shot movement bootstrap.
- Official project page: https://movienet.github.io/projects/eccv20shot.html
- License/access:
  - Closely tied to MovieNet access conditions.
  - Treat as `free research access, license to verify`.
- Status for VAA1:
  - Strong for shot-size and movement bootstrap.

#### AVA
- Useful for tracked persons, actions, speech activity, and realistic video conditions.
- Official page: https://research.google.com/ava/index.html
- Download page: https://research.google.com/ava/download.html
- License:
  - Google states datasets listed there are under `CC BY 4.0`.
- Status for VAA1:
  - Strong `free/open` source for person/action/speech-linked visual work.

#### AVA-ActiveSpeaker
- Useful for visible face + speaking alignment.
- Official paper page: https://research.google/pubs/ava-activespeaker-an-audio-visual-dataset-for-active-speaker-detection/
- License/access:
  - Built on AVA ecosystem; use together with AVA access assumptions and benchmark terms.
- Status for VAA1:
  - Strong support source for audiovisual speaking alignment.

#### Ego4D
- Useful for scenarios, activity contexts, tracked objects, social activity, and daily-life situational awareness.
- Official docs: https://ego4d-data.org/docs/
- Start here: https://ego4d-data.org/docs/start-here/
- Annotation schemas: https://ego4d-data.org/docs/data/annotations-schemas/
- License/access:
  - Requires accepting a dataset license agreement.
  - Not a simple public-domain/open-license dataset.
- Status for VAA1:
  - Very valuable.
  - `Terms-constrained`, not a frictionless free-license source.

#### VoxCeleb
- Useful for audio-visual speaker identity and speaking-face robustness.
- Official site: https://www.robots.ox.ac.uk/~vgg/data/voxceleb/
- License/access:
  - Publicly available for research use, but not a simple permissive open-content license.
- Status for VAA1:
  - Useful, but `terms-constrained`.

### 2. Audio cue corpus

Purpose:
- common mass-media audio recognition
- speech/music/noise recognition
- environment recognition across news, drama, television, advertising, and mixed media

Useful existing sources:

#### AudioSet
- Best broad bootstrap for environmental and media audio categories.
- Official site: https://research.google.com/audioset/
- Dataset page: https://research.google.com/audioset/dataset/
- Ontology: https://research.google.com/audioset/ontology/
- Strength:
  - speech
  - narration
  - crowd
  - traffic
  - television
  - radio
  - sound effect
  - outside/rural/natural
- License/access:
  - Publicly released and widely used, but clips are drawn from YouTube and availability depends on YouTube-hosted media.
  - Treat as `free to use for research workflows, but terms/source dependence should be handled carefully`.
- Status for VAA1:
  - Extremely useful baseline source.

#### MUSAN
- Very useful practical baseline for speech/music/noise.
- Official page: https://openslr.org/17/
- License:
  - `CC BY 4.0`
- Status for VAA1:
  - Strong `free/open` baseline source.

#### MediaSpeech
- Directly useful for mass-media speech in French, Arabic, Turkish, and Spanish.
- Official page: https://www.openslr.org/108/
- License:
  - `CC BY 4.0`
- Status for VAA1:
  - Strong `free/open` media-speech source, especially useful for Turkish inclusion.

#### Room Impulse Response and Noise Database
- Useful for environmental robustness and acoustic simulation.
- Official page: https://www.openslr.org/28/
- License:
  - `Apache 2.0`
- Status for VAA1:
  - Strong `free/open` augmentation source.

#### AMI Meeting Corpus
- Useful for multimodal speech, turn-taking, conversational structure, and meeting-like interaction.
- Official page: https://groups.inf.ed.ac.uk/ami/corpus/
- OpenSLR mirror listing: https://openslr.org/resources.php
- License/access:
  - Access is generally available, but treat the corpus as `free research-use resource` rather than permissive public-domain material.
- Status for VAA1:
  - Useful for conversational multimodality, though not specifically mass-media.

### 3. Text / discourse corpus

Purpose:
- language accuracy
- word detection
- rhetorical structures
- discourse relations

Useful existing sources:

#### Common Voice
- Useful for multilingual speech-text coverage and ASR robustness.
- Data page: https://commonvoice.mozilla.org/data
- Terms example noting CC0 release of contributions: https://commonvoice.mozilla.org/terms/fr.html
- License:
  - Mozilla states Common Voice contributions are made available under `CC0`.
- Status for VAA1:
  - Strong `free/open` multilingual speech-text source.

#### Penn Discourse Treebank 3.0
- Excellent for discourse relations and connective-grounded discourse structure.
- Official page: https://catalog.ldc.upenn.edu/LDC2019T05
- License/access:
  - `LDC User Agreement`
  - paid or membership-based access
- Status for VAA1:
  - High-value but `costs money / licensed`.

#### RST Discourse Treebank
- Strong for rhetorical structure and nuclearity.
- Official page: https://catalog.ldc.upenn.edu/LDC2002T07
- License/access:
  - `LDC User Agreement`
  - paid or membership-based access
- Status for VAA1:
  - High-value but `costs money / licensed`.

#### DiscAlign for Penn and RST
- Useful for aligning the PDTB and RST worlds instead of forcing an early choice.
- Official page: https://catalog.ldc.upenn.edu/LDC2021T16
- License/access:
  - available at no additional cost to licensees of PDTB 2.0 and RST-DT
  - but still depends on owning those LDC corpora
- Status for VAA1:
  - Valuable, but indirectly `costs money / licensed`.

#### RST Continuity Corpus
- Useful if continuity becomes a core discourse variable.
- Official page: https://catalog.ldc.upenn.edu/LDC2024T08
- License/access:
  - `LDC User Agreement`
  - paid or membership-based access
- Status for VAA1:
  - Useful later; `costs money / licensed`.

### 4. Multimodal corpus

Purpose:
- aligned video + audio + transcript + OCR + metadata
- support chains
- ambiguity cases
- contradiction cases

Useful existing sources:

#### MELD
- Helpful for multimodal conversation and emotion in dialogue.
- Official repository: https://github.com/declare-lab/MELD
- License:
  - `GPL-3.0` on the repository
- Status for VAA1:
  - Free/open enough for research exploration.
  - But copyleft implications should be considered if code/data handling becomes coupled.

#### Ego4D
- Very useful for scenario-rich multimodal daily-life understanding.
- Official docs: https://ego4d-data.org/docs/
- License/access:
  - agreement-based
- Status for VAA1:
  - Important, but `terms-constrained`.

#### AVA + AVA-ActiveSpeaker
- Very strong for audiovisual alignment.
- AVA: https://research.google.com/ava/index.html
- AVA-ActiveSpeaker: https://research.google/pubs/ava-activespeaker-an-audio-visual-dataset-for-active-speaker-detection/
- License:
  - AVA download page states `CC BY 4.0`
- Status for VAA1:
  - Strong `free/open` support source.

## Free/open vs paid/licensed summary

### Strong free/open candidates

- MUSAN
  - `CC BY 4.0`
  - https://openslr.org/17/
- MediaSpeech
  - `CC BY 4.0`
  - https://www.openslr.org/108/
- Room Impulse Response and Noise Database
  - `Apache 2.0`
  - https://www.openslr.org/28/
- Common Voice
  - `CC0`
  - https://commonvoice.mozilla.org/data
- AVA
  - `CC BY 4.0`
  - https://research.google.com/ava/download.html
- MELD
  - `GPL-3.0`
  - https://github.com/declare-lab/MELD

### Free to access, but with caution / terms constraints

- MovieNet
  - free access signaled, but license clarity should be checked
  - https://movienet.github.io/
- MovieShots / MovieNet shot-style data
  - likely tied to MovieNet access conditions
  - https://movienet.github.io/projects/eccv20shot.html
- AudioSet
  - powerful and public, but depends on YouTube-hosted source material
  - https://research.google.com/audioset/
- Ego4D
  - requires license agreement
  - https://ego4d-data.org/docs/start-here/
- VoxCeleb
  - public research dataset, but not a simple permissive open-content source
  - https://www.robots.ox.ac.uk/~vgg/data/voxceleb/
- AMI Meeting Corpus
  - useful research resource, but not the same as public-domain/open-content material
  - https://groups.inf.ed.ac.uk/ami/corpus/

### Costs money / licensed

- Penn Discourse Treebank 3.0
  - https://catalog.ldc.upenn.edu/LDC2019T05
- RST Discourse Treebank
  - https://catalog.ldc.upenn.edu/LDC2002T07
- DiscAlign for Penn and RST
  - depends on licensed parent corpora
  - https://catalog.ldc.upenn.edu/LDC2021T16
- RST Continuity Corpus
  - https://catalog.ldc.upenn.edu/LDC2024T08

## What VAA1 still needs beyond existing sources

Existing sources help, but they do not solve VAA1 directly.

VAA1 still needs its own internal corpora:

1. `VAA1 role and character continuity corpus`
- especially for news, archives, research footage, and public-affairs formats

2. `VAA1 situational awareness corpus`
- INT/EXT
- time of day
- public/private
- work/home/outdoors/transit/social/intimacy/etc.

3. `VAA1 dramatic function corpus`
- scene function
- conflict
- objective/obstacle cues
- motivation hypotheses
- narrative direction

4. `VAA1 correction and feedback corpus`
- machine output
- analyst correction
- provenance
- disagreement
- trace-back links

This last one may become the most valuable long-term training asset.

## Multimodal framework clarification before training

Before serious multimodal training begins, VAA1 must decide what it is actually trying to infer.

Recommended multimodal targets:

- audiovisual speaking alignment
- scene-bound cue arbitration
- situational awareness inference
- support and contradiction detection
- discourse plus scene interpretation
- governed dramatic-function inference

Do not begin with:
- broad “general multimodal understanding”
- full automatic plot reading
- free-floating motivation inference

Begin instead with:
- traceable multimodal support tasks

## Learning environment is the key

The learning environment should be treated as a first-class system.

It should include:

- corpus registry
- ontology registry
- train/validation/stress split manager
- experiment tracking
- model registry
- correction-ingestion pipeline
- provenance store
- compute benchmarking
- cost benchmarking

In practice, this means the environment should support:

- household Mac development
- workstation-scale experiments
- supercomputing / HPC preprocessing and training

## What supercomputing resources should be used for

Do not use HPC first for blind giant-model training.

Best early uses:

1. corpus preprocessing
- frame extraction
- shot segmentation
- OCR alignment
- audio feature extraction
- metadata normalization

2. evaluation at scale
- genre-specific accuracy
- robustness on degraded media
- ambiguity/failure clustering

3. modular training
- shot-size model
- transition model
- movement model
- audio environment model
- active speaker / audiovisual alignment model

4. embedding and retrieval infrastructure
- similar-case retrieval
- support-case lookup
- correction-aware retrieval

5. environment economics
- runtime benchmarking
- memory/storage behavior
- inference cost profiles
- training cost profiles

## Recommended next planning document

The next planning note should be:

`VAA1 learning environment and corpus architecture`

It should define:

- the corpus schema
- what counts as a VAA1 training item
- open vs licensed acquisition strategy
- experiment and benchmark design
- correction-feedback ingestion
- HPC usage plan
- environment economics

## Bottom line

The strongest near-term open/free base for VAA1 likely combines:

- MovieNet / MovieShots for cinematic bootstrap, with license caution
- AVA for action/speech-linked visual data
- AudioSet for sound ontology and media-environment baseline
- MUSAN + MediaSpeech for practical audio robustness
- Common Voice for multilingual speech-text support

The strongest higher-cost discourse layer is likely:

- PDTB
- RST
- DiscAlign

And the decisive long-term asset will be:

- VAA1’s own correction-fed internal corpus and learning environment

