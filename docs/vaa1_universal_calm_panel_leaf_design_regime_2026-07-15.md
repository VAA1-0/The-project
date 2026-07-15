# Datascene/VAA1 Universal Calm Panel and Leaf Design Regime

Date: 2026-07-15
Status: implemented foundation and component-level corrective pass

## Outcome

Every GoldenLayout leaf receives one shared visual language derived from the POS and Quant
analytical panels: compact controls, restrained contrast, sentence-case presentation, quiet
secondary text, and progressive disclosure. The interface foregrounds the analyst's working
object rather than presenting metadata as a wall of independent widgets.

## Universal rules

1. Analytical canvases, media, active tables, graphs, and editors remain directly visible.
2. Metadata, provenance, diagnostics, support lists, configuration, and secondary analytical
   families use disclosure rows and begin collapsed.
3. Disclosure rows use compact 12 px typography, restrained weight, close letter spacing, and
   low-contrast borders derived from POS and Quant.
4. UI labels use sentence case. Acronyms, identifiers, quoted source text, scientific symbols,
   and controlled taxonomy values retain their correct authored form.
5. Sibling disclosures and independent options are alphabetical by default.
6. Analytical sequence overrides alphabetical order when order communicates a pipeline, temporal
   progression, ontology, evidence maturity, causal dependency, or an existing design contract.
7. Missing or uncertain data remains a quiet local indication; it does not become a banner or an
   uppercase alarm.

## Current ordered exceptions

- POS category families retain grammatical grouping.
- Quant sections retain the analytical processing sequence.
- Audio sections retain extraction and interpretation sequence.
- Source Media sections retain the metadata ontology.
- StatsKit retains its contracted workbench and visualization order.
- Video controls retain spatial/cinematic workflow order.

These are semantic sequences, not arbitrary menu ordering.

## Implementation boundary

The shared `vaa1-panel-leaf` wrapper makes typography, disclosure tone, labels, tables, inputs,
buttons, and selects consistent across all current and future leaves. This wrapper is only the
visual foundation: dense panel renderers must also place repeated records and secondary evidence
inside real disclosures. The 2026-07-15 screenshot review exposed that distinction and prompted
the component-level pass below.

## Component-level corrective pass

- Objects, OCR, and Expressions now render each computed occurrence as a compact, closed record.
  The label, source time, hit count, confidence, or ranking margin form the first-read summary;
  correction, deletion, provenance, variants, weighting, and source navigation remain inside.
- Master Schema and category leaves now close reliability, confirmations, profiles, matcher
  suggestions, candidate labels, computed evidence, and manual annotations by default.
- Narrative Agent closes character selection, relevance/significance, recommendations, review
  modes, and matching memory by default.
- Scene Cards retains the selected scene and its source actions as the working object, while scene
  account summary remains visible. Scene attributes, speech, meaning/plot readings, interpretive
  readings, extraction metadata, ontology facets, and evidence inventories begin closed.
- Tools treats analysis and morphology setup as supporting configuration and begins it closed.
  Every Tools workspace now has one closed task-named boundary, including visual cues,
  annotation, forensic, language, mission, face, and auxiliary configuration workspaces.
- Source Media keeps source identity visible while Primary metadata, its editable fields, profile
  support, mature-fill review, and candidate table begin inside one closed disclosure.
- Search results are concise closed evidence rows; actions, keywords, source metadata, and maturity
  details appear when a result is opened.
- Data Maturation keeps the active governance queue available while packing its metric-card
  overview into one closed summary row.
- Admin/Observability retains its identity and active analysis header, while navigation, scope,
  performance, economics, and artifact-status contracts begin closed.
- StatsKit retains its compact workbench headings; POS and Quant remain the visual reference.

Across leaves, saturated cyan, teal, green, amber, violet, and red tile backgrounds and borders
are normalized to the neutral POS/Quant evidentiary surface. Subdued semantic text remains for
recognition, including destructive actions, without turning governance state into a coloured
dashboard.

Meaning/Plot's graph remains directly visible because it is the active analytical canvas, not a
metadata support surface. Video playback and source controls follow the same rule.

Lazy-mounted panels must recover the current analysis without waiting for the analyst to select it
again. The shared panel event channel therefore retains the latest analysis-selection payload;
Audio initializes from that retained selection and remains subscribed to later changes.

## Universal coverage

The shared leaf contract applies automatically through `ReactComponentWrapper`, so it covers
Project, Video, Video compare, Downloads, Tools, Transcript, Audio, Objects, OCR, Expressions,
POS, POS matrix, Quant, Quant matrix, Source Media, Time Bank, Meaning Plot, Meaning Network,
Scene Cards, Search, Master Schema, Data Maturation, StatsKit, CVAT, Traceback, and developer
observability leaves, including future leaves registered through the same wrapper.

Primary working objects remain visible. The following are treated as supporting surfaces and
therefore begin closed where present:

- summaries and secondary readings;
- project/video export groups and file inventories;
- provenance, traceback detail, governance metadata, and diagnostics;
- configuration and advanced tools;
- optional comparison, visualization, and source-signal groups;
- audio prosody inside the Transcript leaf;
- unavailable-output explanations.

The Download leaf was migrated from large export/file cards to four compact closed
rows: Whole project, Per analysed video, Analysis files, and Some outputs are not available.

## Verification

The frontend TypeScript check and 64 governance/architecture tests pass after the corrective
pass. A regression test now requires record-level disclosures in Objects, OCR, and Expressions
and closed section boundaries in Master Schema, Scene Cards, and Tools.
