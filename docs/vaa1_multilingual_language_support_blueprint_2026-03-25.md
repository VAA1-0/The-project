# VAA1 multilingual language support blueprint

## Date
- 2026-03-25

## Purpose
Build one shared multilingual language-support layer for VAA1 so that:
- `POS`
- `Quant`
- and future language-based lenses

all use the same language intake, support registry, fallback logic, and user-facing status model.

This is a core system requirement for major global broadcaster analysis, not an optional enhancement.

## Design principle
Language handling must be solved once at platform level, not separately inside each lens.

The system should always answer:
- what language was detected
- whether the user provided a language hint
- whether the content may be mixed-language
- what support level each lens has
- what fallback path each lens used
- whether the result is `enhanced`, `multilingual`, or `limited`

## Core distinction
VAA1 must distinguish between:
1. `language`
2. `regional variety / dialect`
3. `register / speech style`

Example:
- language: `en`
- variety: `us`, `uk`, `au`, `international`
- register: optional note such as `formal`, `colloquial`, `broadcast studio`, `street interview`

This avoids treating English variants as separate languages while still supporting broadcaster reality.

## First-wave broadcaster languages
The first-wave target set should include major global broadcaster languages:

- English
- Spanish
- Portuguese
- French
- German
- Italian
- Dutch
- Flemish
- Finnish
- Swedish
- Norwegian
- Danish
- Icelandic
- Estonian
- Polish
- Czech
- Hungarian
- Romanian
- Greek
- Hebrew
- Arabic
- Persian (Farsi)
- Russian
- Ukrainian
- Mandarin
- Cantonese
- Japanese
- Hindi
- Turkish
- Swahili
- Yoruba

## English requirement
VAA1 must support English broadly enough for:
- US English
- Australian English
- international English
- upper-class UK English
- working-class UK English

Implementation note:
- these should be handled as English with variety and register metadata, not as separate languages

## Language intake model
Each analysis should create one shared `language_profile`.

Suggested shape:

```json
{
  "primary_language": "fi",
  "primary_language_name": "Finnish",
  "confidence": 0.95,
  "source": "auto+user_hint",
  "user_hint": {
    "language": "fi",
    "variety": null,
    "mixed_language": false,
    "notes": null
  },
  "auto_detection": {
    "speech_language": "fi",
    "text_guess": "fi"
  },
  "mixed_language": false,
  "secondary_languages": [],
  "variety": null,
  "register": null
}
```

## User guidance model
Users should be allowed to help indicate language conditions lightly.

Recommended UI fields:
- `Language hint`
- `Regional variety`
- `Mixed languages`
- `Use auto-detect`
- optional `Language note`

Important:
- user hints should guide the system
- user hints should not silently override all automatic evidence

## Support levels
Use only three support levels:
- `enhanced`
- `multilingual`
- `limited`

Meaning:

### `enhanced`
- strong language-specific tooling is available
- lens can use a dedicated model or language-aware rules

### `multilingual`
- no dedicated high-quality per-language model is available
- lens can still run through a multilingual fallback path

### `limited`
- the lens can only produce basic or partial outputs
- UI must say so clearly

## Shared capability registry
VAA1 should maintain one internal capability registry.

Suggested shape:

```json
{
  "fi": {
    "language_name": "Finnish",
    "pos": "multilingual",
    "quant": "enhanced",
    "future_discourse": "limited"
  },
  "en": {
    "language_name": "English",
    "pos": "enhanced",
    "quant": "enhanced",
    "future_discourse": "enhanced"
  }
}
```

This registry must be lens-specific.

Reason:
- a language may have strong `Quant` support but weaker `POS` support
- the same language should not be treated as globally supported or unsupported

## Lens execution policy
Every language-based lens should follow the same rule:

1. read shared `language_profile`
2. look up support level from capability registry
3. run the best available path
4. record the actual path used
5. surface the support level to the UI

## POS lens policy

### Enhanced path
- use language-specific POS model where available

### Multilingual path
- use a multilingual fallback tagger or multilingual parsing strategy
- output should remain structured and lens-compatible

### Limited path
- if no meaningful tagger is available, do not pretend POS succeeded
- produce a clear support warning
- optionally expose token/sentence information as minimal fallback output

## Quant lens policy

### Enhanced path
- language-aware stopwords
- language-aware token cleanup
- language-aware sentence handling
- stronger lexical metrics

### Multilingual path
- universal tokenization
- frequency distributions
- n-grams
- sentence counts
- repetition / lexical diversity metrics

### Limited path
- basic counts only
- clearly label interpretive limits

## Future language-based lenses
Any future lens must consume the same shared language layer.

Examples:
- framing lens
- rhetoric lens
- discourse lens
- sentiment / stance lens
- actor / narrative lens

Rule:
- no future lens should invent its own language detection logic in isolation

## Checkup regime
The checkup regime must stay light.

For each analysis, record only:
- primary language
- secondary languages if any
- confidence
- user hint
- mixed-language flag
- support level by lens
- actual fallback path by lens
- warnings

This is enough for:
- debugging
- transparency
- user trust

without building a heavy observability burden too early.

## UI surfacing
The UI should show a small language-support summary.

Recommended display:
- `Detected language: Finnish`
- `Source: auto + user hint`
- `Mixed language: no`
- `POS support: multilingual`
- `Quant support: enhanced`

If support is limited:
- show the limitation in the relevant lens panel
- never let empty output look like a mysterious failure

## Immediate implementation order
1. create a shared backend `language capability registry`
2. add user language hint fields to analysis start options
3. expose shared language profile in status responses
4. refactor `POS` to use the shared support registry
5. refactor `Quant` to use the same registry
6. add UI status surfacing for language and support levels
7. add multilingual fallback logic before expanding future lenses

## Recommended next engineering target
The next real engineering target is:

- `shared multilingual language-support framework`

not:

- isolated Finnish POS patching

because the COP30 broadcaster workflow requires broad language resilience.

## Short practical conclusion
VAA1 should become:
- language-aware
- dialect-aware
- mixed-language-aware
- lens-specific in its support logic
- transparent about its confidence and fallback modes

That is the right base for `POS`, `Quant`, and every future interpretive lens.
