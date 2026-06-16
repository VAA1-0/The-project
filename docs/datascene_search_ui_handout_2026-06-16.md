# Datascene Search UI Handout

Date: 2026-06-16

## What shipped

This sprint adds the first Datascene Search panel to the VAA1 dashboard. The panel gives analysts a governed search surface over already derived Datascene Content Search records, while keeping search read-only and source-linked.

The Search panel is available from:

- Lenses -> Search
- Window -> Search

## User-facing behavior

- Search across speech, OCR, entities, objects, metadata-derived records, and other governed Content Search records.
- Filter by search mode: All, Narrative, Pattern, and Forensic.
- Filter by source type, entity type, and maturity state.
- Select one analysis or search all existing analyses.
- Open a result directly in the Video panel at the source time anchor.
- Open the related Meaning Network for the result analysis.
- See whether a result is mature or still requires review.

## Existing-analysis fallback

The dashboard now has a read-only local fallback for saved analyses under `outputs/api_results`.

This means Project and Search can surface saved work even when the Python backend is not running or the `/api/analyses` call is unavailable. The fallback reads:

- `outputs/api_results/*/analysis_record.json` for the analysis catalog and status records.
- `analysis_record.output_files` for saved artifacts such as transcript, OCR, object outputs, source media metadata, and correction files.

The fallback does not write analysis data or mutate governance state.

## Governance boundary

Search remains a review and navigation layer. It does not:

- overwrite Master Schema records
- save annotation corrections
- promote candidates to mature records
- treat object tracks as narrative-agent identities without confirmation

The panel reads `analysisData.contentSearch.search_index_records`, which is built after the Entity Registry view so records remain source-linked and analysis-scoped.

## Implementation files

- `src/frontend/app/V2components/components/panels/SearchPanel.tsx`
- `src/frontend/app/V2components/components/LayoutHost.tsx`
- `src/frontend/app/V2components/components/MenuBar.tsx`
- `src/frontend/lib/api-service.ts`
- `src/frontend/app/api/local-analyses/route.ts`
- `src/frontend/app/api/local-analysis/[analysisId]/route.ts`
- `src/frontend/app/api/local-analysis/[analysisId]/download/[fileType]/route.ts`
- `src/frontend/tests/datascene-entity-search-contract.test.mjs`

## Validation

Ran:

- `node --test tests/datascene-entity-search-contract.test.mjs`
- `npx tsc --noEmit`
- `npx eslint app/api/local-analyses/route.ts app/api/local-analysis/[analysisId]/route.ts app/api/local-analysis/[analysisId]/download/[fileType]/route.ts app/V2components/components/panels/SearchPanel.tsx`

Local verification:

- `http://localhost:3000/dashboard` returned `200 OK`.
- `http://localhost:3000/api/local-analyses?limit=50` surfaced 6 saved analyses from `outputs/api_results`.

## Known follow-up

The first UI is intentionally read-only. The natural next step is a governed result-detail drawer that shows all source mentions for one canonical entity and provides analyst actions that route through the existing Master Schema and Data Maturation controls.
