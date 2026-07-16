# B7 governed reporting and source traceback delivery

Date: 2026-07-16

## Outcome

The final prerequisites slice implements citation-bearing report claims, immutable report invalidations, reproducible JSON report runs, and report-claim traceback. The service is a derived projection over governed analytical objects; it cannot create or promote canonical truth.

## Unbroken source-link invariant

Every report claim must preserve this resolvable chain:

`report claim → governed proposition or decision → governed evidence reference → source location, time span, row, or artifact`

A citation is rejected when its evidence references are absent from the referenced governed object. Accepted claims store the governed object identifier, a SHA-256 snapshot hash, the cited evidence references, and source locations. The same traceback structure is included in the export package. A correction adds a replacement governed object and report claim; invalidation marks affected earlier claims invalid without deleting their historical source chain.

## Status and authority rules

- `verified`: every cited source is current, citations resolve, no counter-evidence conflict is present, and source maturity is verified or analyst-confirmed.
- `candidate`: links resolve, but source maturity has not reached verification.
- `conflicting`: counter-evidence or an explicit source conflict remains present and visible.
- `limited`: a source is no longer current or otherwise prevents verification.
- `analyst_authored`: the analyst explicitly authors the statement with recognized manual authority.

All report claims and runs declare `canonical: false`. The renderer orders and packages governed material but cannot invent a sentence, suppress conflict, or strengthen authority.

## Lifecycle

The contract test executes the complete cycle in an isolated directory: create and save a verified claim; reopen it; correct the governed source by adding a replacement; append an invalidation targeting claims linked to the changed source; produce the affected-branch plan; create the replacement claim; export a reproducible package; inspect its traceback index; and reopen the registry with the report run preserved.

## API and persistence

- `GET /api/analysis/{analysis_id}/governed-reports`
- `POST /api/analysis/{analysis_id}/governed-reports/claims`
- `POST /api/analysis/{analysis_id}/governed-reports/invalidations`
- `POST /api/analysis/{analysis_id}/governed-reports/export`
- `GET /api/analysis/{analysis_id}/governed-reports/claims/{claim_id}/traceback`

The append-only registry is stored at `outputs/api_results/{analysis_id}/governed_reports.json`. Exports are stored beneath `outputs/api_results/{analysis_id}/reports/`.

## Verification boundary

Forty-one focused B1–B7 tests pass. Unit and contract verification covers source-link rejection, status inheritance, conflict visibility, explicit analyst authority, persistence, reopen, invalidation, affected-branch planning, replacement, export, and traceback. The canonical `vaa1_core` backend also returned an empty governed report registry for a saved analysis with no report records, without fabricating records or creating `governed_reports.json`. UI exposure remains later analyst-workbench work rather than a prerequisite blocker.
