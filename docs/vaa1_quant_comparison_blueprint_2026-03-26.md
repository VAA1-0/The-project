# VAA1 Quant comparison blueprint

## Date
- 2026-03-26

## Use case anchor
The Quant lens must support corpus-scale comparison work such as:
- all James Bond films
- all COP30 news clips from major global broadcasters
- any historical media corpus where the user wants to compare language use over time

The core analytical question is not only:
- what terms appear in one video

but also:
- how do terms, themes, and language-use patterns change by volume over time across many videos

## Purpose
Turn Quant from a single-video exploratory panel into a small comparison workspace that supports:
- single-video inspection
- cross-video comparison
- term trends over time
- concordance / keyword-in-context review
- future multimodal triangulation

## Core design principle
Quant must separate:
1. `single-item detail`
2. `multi-item comparison`
3. `term trend exploration`

These should not be forced into one stacked panel.

## Product views

### 1. Quant Detail
Purpose:
- inspect one selected video or film closely

Contents:
- token info
- corpus sentence/word stats
- frequency distribution
- TF-IDF top terms
- bigrams
- concordance
- sentence tagging
- later: confidence and multilingual support notes

Panel title:
- `Quant Detail`

Behavior:
- resizable
- dockable
- draggable to another part of the layout

### 2. Quant Compare
Purpose:
- compare many videos side by side

Contents:
- one row per video
- sortable columns
- filterable corpus list

Recommended columns:
- title
- date / year
- language
- total words
- filtered tokens
- type-token ratio
- unique terms
- WHO hits
- WHY hits
- bigram count
- selected keyword frequency
- normalized keyword frequency per 1,000 words

Panel title:
- `Quant Compare`

Behavior:
- resizable
- dockable
- draggable
- optimized for wide layouts and second-screen work

### 3. Term Trends
Purpose:
- trace one or more selected keywords across many videos

Contents:
- selected keyword list
- raw frequency by item
- normalized frequency by item
- time trend line or bar view
- click-through to concordance examples for any selected item

Panel title:
- `Term Trends`

Behavior:
- resizable
- dockable
- draggable

### 4. Concordance View
Purpose:
- inspect keyword usage in context

Contents:
- selected keyword
- KWIC lines
- source video / document label
- later: direct timestamp jump into source media

Panel title:
- `Concordance View`

Behavior:
- resizable
- dockable
- draggable

## Layout principle
Quant should support both:
- embedded use inside the main VAA1 layout
- dedicated scalable panels that can be moved to another area or another screen

Near-term implementation:
- use Golden Layout panels with clear titles
- allow drag/drop and resizing

Later implementation:
- detached browser windows / popout panels
- synchronized state between main VAA1 and popped-out views

## Comparison logic
Raw counts are not enough.

Quant comparison must support:
- raw count
- normalized count per 1,000 words
- percentage share within document
- trend over time

Reason:
- otherwise longer films or longer transcripts dominate unfairly

## Minimal comparison data model
Each analyzed item should expose a compact Quant summary record:

```json
{
  "analysis_id": "uuid",
  "title": "Dr. No",
  "year": 1962,
  "language": "en",
  "word_count": 4200,
  "filtered_token_count": 2600,
  "ttr": 0.41,
  "unique_terms": 1720,
  "who_hits": 38,
  "why_hits": 11,
  "bigram_count": 22,
  "top_terms": ["bond", "dr", "missile", "jamaica"],
  "keyword_counts": {
    "empire": 2,
    "russia": 0,
    "technology": 5
  },
  "keyword_norm_per_1000": {
    "empire": 0.48,
    "russia": 0.0,
    "technology": 1.19
  }
}
```

## Concordance model
Concordance should be user-directed, not only auto-selected.

Required behaviors:
- user can choose a keyword from top terms
- user can type a custom keyword
- concordance lines show context around the term
- each concordance line should later become timestamp-linkable if transcript segments permit alignment

Suggested shape:

```json
{
  "keyword": "bond",
  "lines": [
    {
      "text": "agent bond was sent to jamaica to investigate",
      "analysis_id": "uuid",
      "document": "dr_no_transcript.json",
      "segment_index": 12,
      "start": 315.2,
      "end": 320.8,
      "timestamp_ready": true
    }
  ]
}
```

## Timestamp regime
Quant should preserve navigability.

This means:
- summary stats may remain corpus-level
- concordance lines should become segment-linked wherever possible
- sentence tagging rows should later carry segment or time references
- keyword trend comparisons should be able to open the source item at the relevant context

So Quant should be marked in stages:

### Stage A
- corpus-level outputs only

### Stage B
- transcript-segment linkage

### Stage C
- cross-lens timestamp triangulation

## Multilingual requirement
Quant must follow the same shared language-support framework as POS.

That means Quant should expose:
- language
- support level
- fallback path used
- confidence / caution notes where relevant

Support levels:
- `enhanced`
- `multilingual`
- `limited`

## Confidence principle
Quant should avoid false precision.

Rules:
- raw counts are acceptable
- normalized values are acceptable
- sentence tags and keyword trends should carry support notes where language support is weak
- concordance is evidence display, not final interpretation

## UI principle
The Quant workspace should read as analytical, not cluttered.

Recommended design:
- summary chips for high-level stats
- tables for comparison
- charts only where they clarify trends
- simple titles
- one main scroll area per panel
- avoid stacked mini-scroll regions

## Recommended implementation order
1. stabilize `Quant Detail`
  - frequency distribution visible
  - concordance visible
  - cleaner layout dynamics

2. build `Concordance View`
  - keyword-selectable
  - dedicated draggable panel

3. build `Quant Compare`
  - one row per analyzed item
  - sortable / filterable
  - normalized counts

4. build `Term Trends`
  - compare selected keywords over time

5. add transcript-segment and timestamp linkage

6. align Quant support/confidence with multilingual capability registry

## First practical delivery target
The first real milestone should support:
- comparing multiple videos
- selecting one keyword
- seeing raw and normalized frequency across items
- opening concordance for each item

That already enables corpus studies such as:
- James Bond language change over decades
- broadcaster framing differences across COP30 coverage

## Working conclusion
Quant should no longer be treated as one narrow results leaf.

It should evolve into a dedicated comparison workspace with:
- `Quant Detail`
- `Quant Compare`
- `Term Trends`
- `Concordance View`

all as clear, draggable, scalable panels.
