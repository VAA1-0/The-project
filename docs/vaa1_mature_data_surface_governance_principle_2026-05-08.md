# VAA1 Mature Data Surface Governance Principle

Date: 2026-05-08

## Principle

VAA1 should always surface the most mature available indication first.

The user-facing analytic panels should not independently privilege raw detections when a more mature governed indication exists. Matured data must be promoted into the Master Schema, and the Master Schema must act as the redistribution layer for associated panels.

Raw detections remain preserved as source evidence, but they should not be the first-read indication when manual, corrected, or triangulated evidence is available.

## Authority Order

VAA1 resolves competing indications in this order:

1. Manual correction
2. Manual annotation
3. Mature triangulated or proliferated indication
4. Grouped / interpreted automatic detection
5. Raw detection

This order governs labels, transcript text, object labels, expressions, scene-card facets, identity indications, and other linked evidence surfaces.

## User Confirmed Anchor

User confirmed data is the primary anchor for sense-making.

This includes corrections and confirmations made in panels, BBox/ROIBox overlays, metadata fields,
transcript surfaces, identity/narrative-agent surfaces, and any other analysis workspace. Once a user
has corrected or confirmed an indication, that thread of data must be treated as the known-priority
evidence route regardless of where it was entered.

Confirmed user data should be consulted before broader proliferation. The system may propose pattern
confirmations, but it should first ask:

- does this pattern agree with existing user-confirmed corrections?
- does it preserve traceback to the original raw evidence and the confirming user action?
- can the confirmation be stated concisely enough to be useful during analysis?
- if accepted, which Master Schema surface should receive the matured claim?

The strongest early confirmation families are:

- character audio trail recognition
- character visual pattern recognition
- language, names, places, and text confirmation
- narrative structure, meaning, and plot confirmation
- mise-en-scene level understanding

These confirmation families should remain concise and analyst-facing. Their purpose is not to force
constant approval, but to make high-leverage confirmations available at the moments where they can
proliferate mature data responsibly across the program.

## Master Schema Practice

The Master Schema is the canonical mature-evidence coordination layer.

When an indication matures, VAA1 should update the Master Schema or its correction/annotation ledger first. Associated panels should then read from that matured view and surface it as the first visible indication.

Examples:

- corrected transcript text should surface before the original transcript text in transcript-linked panels
- corrected object labels should surface before raw detector class labels
- corrected expression labels should surface before raw emotion labels
- manual scene notes should surface before system-generated scene interpretations
- mature identity triangulation should surface before anonymous track labels

## Raw Evidence Preservation

Raw detection repositories are preserved and remain downloadable.

This preservation is not optional. Raw detections are the evidentiary substrate for traceback, audit, reproducibility, and correction. The rule is not to erase raw detections; the rule is to avoid presenting raw detections as the best current claim when a more mature governed claim exists.

## Panel Behavior

Associated panels should use the matured Master Schema view as their first-read layer.

Panels may still expose raw detections, but raw indications should be visually secondary when superseded by a mature indication. A panel should make it clear whether a surfaced indication is manual, corrected, triangulated, interpreted, or raw.

Scene Cards follow the same rule:

- `said_in_scene` should use corrected and manual transcript evidence when available
- props/persons should use corrected object labels and manual visual annotations when available
- expressions and situations should use corrected expression labels when available
- source extraction metadata summaries should describe the mature scene-card view without mutating original source metadata

## Implementation Implication

VAA1 should move toward a single backend resolved-evidence view:

```text
raw artifacts
  -> correction / annotation ledger
  -> mature triangulation and proliferation
  -> Master Schema resolved evidence
  -> associated panels and reports
```

Until that resolved-evidence view is fully centralized, every new panel or report must explicitly apply the same authority order and preserve links back to raw evidence.

## Master Schema Acid Test

The Master Schema is the core maturity coordination layer. VAA1 should not add a competing
"core" layer beside it. Instead, the Master Schema must carry a visible maturity audit that
answers:

- which evidence producers currently feed the schema
- which mature surfaces are populated
- which panels still risk bypassing the schema
- which traceback routes and maturity routes are available
- what hardening work is required next

The acid-test artifact is `master_schema_maturity_audit`.

It should be present in every rebuilt Master Schema payload and should preserve the authority
order:

```text
manual correction
> manual annotation
> mature triangulated/proliferated indication
> interpreted automatic detection
> raw detection
```

The first hardening target remains the video panel BBox/ROIBox surface, because it is the
place where mature labels must visibly supersede raw detector labels while raw evidence remains
available for traceback.

The maturity audit must also name the user-confirmed anchor and the active confirmation program.
This keeps the iterative process systematic: user confirmations anchor current meaning, detected
patterns propose concise confirmation opportunities, accepted confirmations proliferate through the
Master Schema, and downstream panels surface the most mature data first.

## Design Constraint

The Master Schema must not become a destructive overwrite layer.

It is a governed mature-data coordination layer. It should keep provenance, source references, timestamps, correction history, and raw artifact links intact while redistributing the best available indication across VAA1.
