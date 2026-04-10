## VAA1 Panel Maturation Governance Note

Date: 2026-04-10
Branch: `petteri`

### Purpose

VAA1 panel development has now reached a point where panel maturity should be treated as a dedicated frontend governance package rather than as incidental cleanup.

The issue is no longer only visual polish. Different panels currently communicate different epistemic attitudes:

- some panels read as governed evidence registers
- some panels still read as experimental widgets
- some panels are functionally useful but visually too loud
- some panels still mix tool controls, diagnostics, and interpretation without enough structural restraint

This creates inconsistency in both usability and analytic credibility.

### Current Maturity State

The calmer governance-oriented layout language is currently strongest in:

- `OCR`
- `OBJ`
- `Expressions`
- `POS Matrix`
- `Quant Matrix`

It is now also materially improved in:

- `Transcript`
- `POS`
- `Quant`

These panels now more clearly use:

- restrained headers
- flatter bordered evidence surfaces
- quieter chips and metric tiles
- less widget-like visual emphasis
- more legible evidence-first reading order

### Panels Still Needing Maturation

The broader panel system is still uneven. Likely remaining maturity candidates include:

- `Download`
- `Tools`
- `TimeBank`
- `Video Compare`
- `Speech / Audio`
- parts of the main `Video` side panel
- any remaining governance-support surfaces that still feel louder than the matrix standard

These should be reviewed not only for styling but also for:

- evidence hierarchy
- tone of labels and helper text
- separation of extracted data from heuristic interpretation
- in-panel correction behavior
- navigability and review ergonomics

### Design Principle

The governing visual principle should be:

- evidence register first
- widget second

This means VAA1 panels should generally prefer:

- quiet headers
- row-based or register-like evidence presentation
- clear provenance and correction affordances
- restrained emphasis
- fewer decorative containers
- explicit distinction between:
  - extracted evidence
  - analyst correction
  - heuristic description
  - unresolved or provisional material

### Working Conclusion

Panel maturation is now a real sprint package.

It should be treated as part of VAA1 governance design, not as cosmetic cleanup. The aim is a coherent analytic workspace where all major panels support the same calm, evidence-oriented, correction-aware operating style.
