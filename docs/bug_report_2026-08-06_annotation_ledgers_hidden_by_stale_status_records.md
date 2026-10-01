# Bug Report: Annotation Ledgers Hidden By Stale Status Records

Date: 2026-08-06

## Summary

Human annotation data for Marcella videos was present on disk but did not reliably surface in associated Datascene panels. The incident violated the data maturity principle and traceback principle: mature row-level annotation ledgers were displaced by stale or sparse status/record payloads.

The affected data is lightweight. It consists mainly of row-level transcript confirmations, one-word or short-label Narrative Agent/role selections, BBox/visual annotation rows, and presence intervals. The payload size is in KB, not a heavy analysis artifact.

## User-Visible Impact

- Transcript rows surfaced as `UNKNOWN` even when previous human annotation work existed.
- BBox/visual role annotations were missing from associated panel views.
- Master Schema did not consistently expose the recovered correction ledger.
- Project bundle/status paths could read stale embedded `analysis_record.json` values instead of the canonical sidecar.

## Evidence Found

Recovered live annotation counts after import:

| Analysis | Text corrections | Manual transcript entries | Manual visual annotations | Master Schema presence intervals |
|---|---:|---:|---:|---:|
| `00c22625-82e8-4ddc-bb36-317422664214` | 30 | 7 | 18 | 18 |
| `2368228a-f46d-4339-bf7b-5f1966a33ee5` | 26 | 2 | 0 | 0 |
| `ac1af180-df4a-41cd-aed9-c79b91329197` | 22 | 4 | 20 | 20 |
| `c034341f-3fba-495e-a7d1-0af03a46cb6c` | 74 | 30 | 8 | 8 |
| `ca6d0ebf-cbb5-4f7e-8502-f8b0693daf33` | 61 | 5 | 6 | 6 |
| `e9cffc4c-275b-4dcb-b475-600b3c9ac2d7` | 57 | 21 | 3 | 3 |
| `fe2c60ec-94b2-4fcd-82d4-34ea7a4f4dd8` | 18 | 10 | 0 | 0 |

Recovery sources included:

- `backups/delivery-lockdown-2026-08-05-1948`
- `backups/datascene-json-2026-08-05-recovery`
- `backups/delivery-watchdog`
- the supplied save bundle at `/Users/admin/Desktop/Marcella Vids/Marcella_project_keskiviikkobundle.zip`
- live `outputs/api_results/*/annotation_corrections.json`

## Root Cause

The durable correction sidecar, `annotation_corrections.json`, was not treated as the canonical authority everywhere.

Several code paths still trusted embedded or in-memory status data:

- `analysis_record.json` could contain empty `annotation_corrections`.
- Master Schema refresh could preserve or rebuild a stale `review_layer`.
- Local frontend status/bundle routes could read stale embedded record fields instead of the small canonical sidecar.
- Saved-analysis hydration preserved existing in-memory values even when disk had a more mature correction ledger.

## Fix Delivered

1. Recovered and merged the richest available correction sidecars into live `outputs/api_results/*/annotation_corrections.json`.
2. Mirrored those ledgers into each live `vaa1_annotation_master_schema.json` at `review_layer.annotation_corrections`.
3. Added backend maturity protection:
   - Master Schema refresh now hydrates richer persisted annotation corrections before writing.
   - Sparse in-memory correction payloads cannot overwrite richer persisted sidecars.
4. Added frontend/local persistence protection:
   - Local annotation correction saves update `vaa1_annotation_master_schema.json` immediately.
   - Local analysis reads overlay `annotation_corrections.json` and `vaa1_annotation_master_schema.json` instead of trusting stale embedded record copies.
   - Local bundle manifests read canonical annotation sidecars.
5. Created a lightweight recovery snapshot:
   - `backups/annotation-ledger-recovery-saved-20260806-1400`

## Verification

Passed:

- `python3 -m pytest tests/test_saved_analysis_hydration_loader.py -q`
- `node --test src/frontend/tests/annotation-correction-concurrency.test.mjs src/frontend/tests/transcript-span-edit-contract.test.mjs`
- `python3 -m py_compile api_server.py src/backend/analysis/saved_analysis_hydration_loader.py`

Manual file verification confirmed sidecar and Master Schema review-layer counts match for all seven recovered analyses.

## Prevention Rule

For human annotation data, `annotation_corrections.json` is the lightweight canonical ledger. Master Schema must mirror it, and panel/bundle/status readers must overlay it. Heavy `analysis_record.json` snapshots may cache it, but must not be allowed to hide or erase it.
