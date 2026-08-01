# Working Handover Handout — StatsKit and Scene Language Thread

Date: 2026-08-01
Branch: `petteri`
Scope: native statistical interpretation, language/SFL coupling, StatsKit operations, Scene Card delivery, source navigation, and analyst-facing presentation

## Delivered outcome

Datascene/VAA1 now delivers source-linked statistical interpretation as an operating analytical tool rather than a list of future statistical requirements. The implementation joins measured visual, audio, transcript, expression, object/prop, POS, Quant, and SFL evidence at governed time intervals and exposes the results through the existing analyst workspaces.

The statistical implementation preserves the distinction between a measurement, a statistical association, and an analyst interpretation. It does not label findings as unusual by default and does not use intrinsic/social or implicit/explicit frames as if they were outputs of the same equation.

## Native statistical motors

The native statistical interpretation path now provides:

- scene-level measured attributes;
- robust within-video descriptive comparison;
- Spearman rank associations over paired governed scenes;
- paired values for both attributes rather than single-row relationship placeholders;
- contributing-scene records with direct source-video navigation;
- substantive readings that describe what the measured attributes could indicate in the material;
- a compact file-level statistical index for corpus triage and comparison;
- persisted statistical metadata and panel routes;
- report-draft support from measured statistical outputs.

Current cross-signal families include expression/prosody, expression/transcript, SFL/prosody, props/SFL, transcript/prosody, and existing audio, motion, and visual-tone measurements where their governed data is available.

## Motor inputs operationalized

The source-producing layers were extended so the statistical motors consume numeric and categorical evidence rather than reconstructing it from display labels:

- expression artifacts persist valence and activation scores with their scoring method;
- dependency/SFL utterances persist statistical indicators for proposal, question, modality, material process, and verbal process;
- the native statistical interpretation motor reads those persisted values first and retains legacy adaptation only for older saved analyses;
- speculative unavailable relationships are not presented as findings.

## POS, Quant, Transcript, and SFL coupling

A shared scene-language view now joins:

- governed Scene Card intervals;
- transcript utterances and text;
- token-level POS annotations;
- word count, words per second, type-token ratio, question count, and negated-utterance count;
- SFL process type, speech function, and modality;
- exact source-video times.

The view is scene-card based. Scene rows expand into their contributing utterances, and both scene and utterance timestamps seek the existing Video panel. The same governed join is available in Scene Cards, StatsKit, POS, Quant, and Transcript.

## Scene Cards presentation

`Language analysis by scene` and `Scene attributes` are aligned with the selected Scene Card's existing disclosure stack alongside `Said in scene`, `Meaning / plot`, interpretive readings, extraction metadata, ontology facets, and evidence items.

The selected scene remains the primary working object. Language analysis operates on that selected Scene Card rather than appearing as a separate panel-level category. Secondary evidence begins collapsed and follows the neutral POS/Quant visual regime.

## StatsKit presentation and inquiry lifecycle

StatsKit now opens with `Analysis setup`. Its primary categories use compact full-width disclosures according to the existing StatsKit order and Datascene panel regime.

The setup provides operating inquiry controls:

- `Run StatsKit`;
- `Find statistical patterns`;
- `Refresh`, which reloads the active saved analysis and clears the previous inquiry state;
- `Clear`, which removes the previous statistical overview, run artifact, row selections, expanded evidence, scanner/significance selections, and visualization state.

The former `Statistical results` heading is now `Statistical overview`. It begins collapsed in StatsKit, uses one disclosure affordance, and no longer creates a free-standing metadata/status row such as “Statistical pattern results are open below for scene 1.”

Scene-language evidence is accessible as its own collapsed StatsKit category and remains bidirectionally linked to the Video panel.

## Datascene context-menu correction

The shared right-click `Copy content` action now distinguishes the short menu preview from the copied payload:

- when the analyst has selected text, the entire selection is copied;
- otherwise the complete governed row or target content is copied;
- the 120-character truncation applies only to the context-menu preview label.

## Performance boundary

The scene-language artifacts are loaded on explicit disclosure opening for further calibration/configuration to improve efficiency according to Datascene standards. Normal Video panel preparation does not wait for these secondary analytical tables.

## Design contracts applied

The corrective UI pass follows:

- `docs/vaa1_universal_calm_panel_leaf_design_regime_2026-07-15.md`;
- `docs/vaa1_statskit_1_0_delivery_2026-07-16.md`;
- `docs/vaa1_calm_analytical_indication_design_contract_2026-07-14.md`;
- `docs/working_handover_handout_2026-07-06_statskit_mature_matcher_ui_thread.md`.

The implemented presentation uses sentence case, restrained typography and borders, neutral table surfaces, progressive disclosure, local quiet state, dense aligned evidence rows, and source-linked analyst actions.

## Validation completed

- Frontend TypeScript compilation: passed.
- Patch whitespace/integrity check: passed.
- Focused manual annotation and governance suite: 68/68 passed.
- Earlier native statistical interpretation and prerequisite tests passed during the thread.

## Manual retest

After restarting the current frontend/backend build:

1. Open StatsKit and confirm `Analysis setup` is the first open category.
2. Run a statistical inquiry, use `Clear`, and confirm the previous overview and selections disappear.
3. Use `Refresh` and confirm the active saved analysis reloads without retaining the prior inquiry display.
4. Open `Statistical overview` and verify one disclosure marker and no free-standing status row.
5. Select a multi-line passage, right-click, choose `Copy content`, and verify the complete selection reaches the clipboard.
6. Open Scene Cards and verify `Scene attributes` and `Language analysis by scene` align with the other selected-scene disclosures.
7. Expand a language scene and click its scene and utterance timestamps; both must seek the existing Video panel.
8. Open the same language category in StatsKit and verify the scene rows and source navigation agree with Scene Cards.

## Continuation boundary

The next useful step is the browser-level manual retest above. Any later statistical expansion should add actual persisted inputs and source-linked computations first, then expose them through the existing workbench and disclosure regime. It should not reintroduce placeholder statistical rows, disconnected indexes, unsupported meaning claims, or panel-level widget stacks.
