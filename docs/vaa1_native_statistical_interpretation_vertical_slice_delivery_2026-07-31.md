# VAA1 native statistical interpretation vertical slice

Date: 2026-07-31
Status: first operational cross-signal slice

## Outcome

Datascene now has a governed path from normalized source-linked observations to a
cross-signal salience finding, candidate epistemic claim, candidate analytical
proposition, analyst-facing panel projections, and later report eligibility.

The implementation extends the existing measurement, interpretation-registry,
canonical-decision, framework-projection, reporting, and traceback architecture. It
does not introduce another truth store.

## Statistical terminology

- **Observed value** is a descriptive statistic for the declared analytical unit and
  population.
- **Baseline median** is the median of at least three declared comparison
  observations.
- **Median absolute deviation (MAD)** measures baseline dispersion around that
  median.
- **Robust z-score** is `0.67448975 * (observed - median) / MAD`. It is a standardized
  descriptive deviation. It is not a p-value.
- **Salience index** is the mean of absolute robust-z component scores capped at five
  and scaled to `[0, 1]`. It is a transparent composite review-priority index. It is
  not statistical significance, an effect size, a probability, or causal evidence.
- **Cross-signal concurrence** means that measurements from at least two declared
  signal families overlap on `source_media.clock`. Temporal overlap does not prove
  independence, causation, or narrative meaning.
- **Native finding** is a reproducible computational result. It becomes an
  interpretation only through a separate governed proposition and analyst decision.

The service refuses to calculate robust deviation from fewer than three baseline
observations or a zero-MAD baseline. It also rejects missing populations, missing
evidence, single-family inputs, mixed source identities, noncanonical clocks, and
non-overlapping intervals.

## Operational surfaces

- **StatsKit** owns methods, populations, baselines, measurements, standardized
  deviations, diagnostics, and limitations.
- **Search** receives governed discovery records; it does not recompute statistics.
- **Scene Cards** receive scene-local findings only when governed scene membership
  resolves.
- **Narrative Agent** receives subject-local candidates only when the subject is a
  governed Narrative Agent.
- **Meaning Network** receives candidate nodes and relations without authority
  promotion.
- **Meaning / Plot** consumes reviewed propositions as lens inputs. It is not the
  owner of the statistical result.

Required control surfaces are also explicit:

- **Data Maturation** owns review and confirmation queues.
- **Master Schema** receives projections only after canonical confirmation.
- **Traceback** verifies source, population, method, evidence, and lineage.
- **Publication** writes Data Book records and eligible Scientific Report claims.
- **Video, Transcript, Audio, and Tools** remain source-verification surfaces.

## Boje vocabulary correction

The canonical five terms are `Before`, `Bets`, `Becoming`, `Beneath`, and `Between`,
following `docs/VAA1_Bojean_Antenarrative_5B_Genre_Traceability_Schema.json`.
Legacy `bet` and `beyond` framework references are normalized to `bets` and `before`
respectively while retaining the original reference in vocabulary lineage. A 5B
orientation still requires explicit assignment and is never guessed from keywords.

## Delivered contracts and code

- `src/backend/analysis/native_statistical_interpretation.py`
- `docs/schemas/vaa1.native_statistical_interpretation.v1.schema.json`
- `POST /api/analysis/{analysis_id}/native-statistical-interpretation/run`
- `GET /api/analysis/{analysis_id}/native-statistical-interpretation`
- shared `NativeStatisticalInterpretationStrip` projection in StatsKit, Search, Scene
  Cards, Narrative Agent, Meaning / Plot, and Data Maturation
- execution-graph registration and interval-local invalidation path
- canonical Boje vocabulary normalization in framework projection

## Current boundary

StatsKit now provides **Find statistical patterns**. It automatically builds scene-level
statistics from the persisted scene, spatial-tone, adaptive-visual, diarization,
audio-event, and prosody layers; compares each eligible scene with the other governed
scenes in the analysis; selects the strongest eligible multi-signal scene; saves the
finding; and refreshes the consuming panels.

This delivery does not calculate inferential p-values, establish causal effects, create
automatic Narrative Agent transitions, or render a confirmed interpretation as
Scientific Report prose. Those are separate features rather than hidden behavior of the
scene-pattern finder.

## Acceptance

Pass when:

1. every observation declares population, analytical unit, unit, baseline, source
   interval, and evidence;
2. at least two signal families overlap on one canonical source clock;
3. the finding retains its method, limitations, and statistical definitions;
4. the claim and proposition remain candidate-only;
5. every receiving panel identifies its role without locally recomputing or promoting
   the result;
6. analyst confirmation remains the only path to a canonical interpretation; and
7. later publication resolves the claim through a Data Book record to source evidence.
