# Bug Report — User-confirmed BBox incorrectly required a second confirmation

Date: 2026-10-19

Status: resolved in code; runtime acceptance pending.

Design-principle remediation: the invariant is now stated explicitly under
“Confirm Once, Mature Everywhere” in the core UI workflow design review and
under §2.2.1 of the relational-lenses design reader. The general operating
principles and sprint regime already carry the same Master Schema-first rule.

Representative artifact: No Time to Die trailer, analysis
`81920e95-a0b2-4173-bc23-86db7909a0a9`

## Summary

The Narrative Agent analysis path displayed some BBox identity occurrences as
`unreviewed` and offered another `Confirm` action even though those occurrences
already carried `explicit_analyst_confirmation` authority. Other occurrences
with an additional continuity-ledger decision displayed correctly as mature.

This contradicted the Datascene rule that an explicit user confirmation is a
100% authoritative confirmation, immediately mature in Master Schema, and
automatically projected to associated consumers. A later correction may
supersede it; a second acceptance gate may not demote or delay it.

## Root cause

The continuity inventory correctly classified confirmed BBoxes as
`confirmed_source_occurrence`, but the canonical projection selected members
only from `included_occurrence_ids` in a separate continuity decision ledger.
The frontend also derived `included` solely from that ledger. Consequently,
identical confirmed evidence appeared mature or unreviewed depending on whether
an incidental second decision existed.

The earlier distinction between source confirmation and collection membership
was valid for detector-generated candidates but was incorrectly applied to
explicit user confirmations.

## Delivered correction

- Explicitly analyst-confirmed occurrences automatically enter the canonical mature member set.
- Explicit rejection or deferral remains able to supersede that automatic state as a correction.
- A collection-confirmation decision remains required only for proposed or machine-derived membership.
- The UI derives mature state from canonical automatic membership and from explicit confirmation authority.
- The redundant `Confirm` action is removed for already confirmed BBoxes.
- Mature occurrences continue to show source navigation, a calm confirmation receipt, and Master Schema proliferation.

## Expected invariant

`explicit user confirmation → mature Master Schema occurrence → canonical projection → all associated consumers`

There is no intermediate confirmation gate. Corrections remain append-only and
traceable through reject, defer, revise, or later replacement decisions.

## Acceptance gate

Refresh the Narrative Agent panel and select Nomi. Every occurrence whose
authority is `explicit_analyst_confirmation` must display `Confirmed ✓ · mature`
without asking for another confirmation. Candidate detections may still require
review. Verify the same mature occurrence in Master Schema and after save/reopen.
