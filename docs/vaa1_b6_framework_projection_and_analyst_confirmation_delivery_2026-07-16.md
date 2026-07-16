# B6 framework projection and analyst confirmation delivery

Date: 2026-07-16

## Outcome

Eligible interpretation-registry propositions can now be projected into Meaning Network, Narrative Agent, and Boje 5B framework artifacts without gaining canonical authority. A separate explicit analyst-confirmation adapter can promote one selected proposition into the existing append-only canonical decision ledger.

## Projection rules

- Meaning Network receives eligible analytical proposition nodes and typed relation edges.
- Narrative Agent receives only propositions explicitly scoped to a `narrative_agent` or `character` subject, plus supported state transitions.
- Boje 5B receives only propositions with an explicit `framework_ref` of `boje_5b.bet`, `beneath`, `between`, `beyond`, or `becoming`.
- Boje orientations are never inferred from keywords.
- Observation-only support, missing support, and invalidated support exclude a proposition from projection while retaining it in the registry for inspection.
- Alternatives, counter-evidence, scope, subject, and source-record traceback survive projection.
- Every projected record remains candidate-authority and declares `canonical: false`.

## What the Boje 5B projection means in Datascene

The Boje feature is an interpretive projection over governed propositions. It is not a second truth store, an automatic narrative classifier, or a shortcut from raw detections to conclusions. Datascene uses the five orientations as explicit analytical lenses:

- `bet` records a consequential wager, commitment, expectation, or prospective claim made by an actor or by an interpretation.
- `beneath` records a materially supported underlying condition, assumption, omission, tension, or less-visible organizing influence.
- `between` records a relation, negotiation, contrast, dependency, or contested meaning formed among actors, events, claims, or evidence.
- `beyond` records a supported alternative, counterfactual, unrealized possibility, or implication extending past the presently observed account.
- `becoming` records an evidenced process of emergence or change across states, identities, relations, or narrative conditions.

These are Datascene operational definitions for consistent analysis; they do not claim that one proposition has a universally correct Boje orientation. An analyst or an upstream governed adapter must deliberately set exactly one supported `framework_ref`, such as `boje_5b.between`. The projection service never assigns an orientation from words, sentiment, topic labels, or model resemblance.

For a proposition to appear in the Boje view, it must remain current and have eligible, non-observation-only support. The projected event retains its proposition reference, subject and scope, supporting evidence, counter-evidence, and alternatives. The event remains a candidate reading until an analyst performs a separate explicit confirmation. Invalidation of the proposition or its support removes it from a rebuilt projection without erasing the historical registry record.

Example: an observed exchange alone does not become `between`. A governed proposition may state that the exchange constructs a contested relation, cite the relevant transcript and timed scene evidence, preserve a plausible alternative reading, and explicitly declare `framework_ref: boje_5b.between`. Datascene then exposes that proposition in the Boje projection as a traceable candidate—not as established fact.

This boundary balances usefulness and scientific restraint: the five lenses help analysts surface prospective, underlying, relational, alternative, and emergent meanings, while explicit assignment, evidence qualification, counter-evidence, and analyst confirmation prevent the framework from manufacturing authority.

## Analyst confirmation

Confirmation requires the explicit action `confirm_proposition` and either `manual_confirmation` or `explicit_user_confirmation` authority. The adapter writes through the existing decision-ledger policy as an `analyst_interaction`, links the originating proposition in `correction_refs`, and retains supporting registry records in `evidence_refs`. Candidate services cannot call the adapter with their own authority.

## Verification

Thirteen combined B3–B6 tests pass in `vaa1_core`. B6 tests cover eligible three-framework projection, observation-only exclusion, explicit-only Boje assignment, canonical decision adaptation, proposition traceback, and rejection of candidate-service confirmation.

The canonical `vaa1_core` backend was also live-probed through `POST /api/analysis/{analysis_id}/framework-projections` with `persist: false`. For a saved analysis without a persisted interpretation registry, the route correctly returned empty Meaning Network, Narrative Agent, and Boje 5B candidate projections, retained `canonical_write: false`, and created no `framework_projections.json` artifact. This verifies the route and its non-fabrication/non-mutation behavior; populated projection and analyst-confirmation behavior are covered by the isolated contract tests.

## Remaining boundary

- Connect these artifacts to the existing panel readers without adding parallel UI authority.
- Execute affected-branch recomputation after registry invalidation or canonical confirmation.
- Implement verified report claims with citation-level source traceback.
