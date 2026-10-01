# Global Clock Delivery — Project Isolation Gate

Date: 2026-10-01

Active project: `bond-cop30-helsinki`

Foreign project fixture: `research-test-2026` (Marcella)

## Result

UI operational isolation: **PASS**

Datascene local-route project and analysis entity boundary: **PASS**

Direct upstream/FastAPI context-ticket parity: **OPEN HARDENING ITEM**

## Verified acceptance evidence

| Check | Result | Evidence |
|---|---|---|
| Ordinary dashboard exposes only active-project analyses | Pass | Five Bond/COP30/Helsinki analysis selectors; no Marcella project or source-clock fixture |
| Foreign analysis query cannot become active | Pass | Marcella analysis `c034341f-3fba-495e-a7d1-0af03a46cb6c` rejected with project-boundary alarm |
| Foreign artifacts do not hydrate after rejection | Pass | Browser request capture contained zero `/api/local-analysis/c034341f-3fba-495e-a7d1-0af03a46cb6c` requests |
| Restored panel analysis props are bounded | Pass by implementation/type check | Foreign `videoId` and `analysisId` props are removed before panel render |
| Already-active foreign context is evicted | Pass by implementation/type check | Membership reconciliation clears a foreign latest selection to canonical empty state |
| Frontend compiles | Pass | `npx tsc --noEmit` |
| Automated isolation checks | Pass | 2 Playwright tests passed in 6.4 seconds |
| Valid project and analysis entity context | Pass | Bond transcript request is served |
| Foreign analysis under active project | Pass | Server rejects Bond-project/Marcella-analysis pairing with HTTP 403 |
| Path and context analysis disagreement | Pass | Server rejects with HTTP 409 |
| Missing governed project context | Pass | Server rejects with HTTP 428 |
| Analysis hydration caches | Pass | Partitioned by `project::analysis` |
| Saved panel workspace | Pass | Project-specific storage key; legacy unscoped layout is not restored |

## Enforced frontend invariant

An analysis may populate the dashboard only after its ID is present in the governed membership list for the active project. Unknown and foreign IDs fail closed. An explicit catalogue route is the only frontend mode allowed to aggregate projects.

## Server-enforced local boundary

All Datascene local record, artifact, source-media read/write, correction read/write, and bundle-export routes now validate the requested project against the governed catalogue membership of the path analysis. An explicit context analysis ID, when supplied, must also equal the path entity. Context-free calls fail closed.

## Remaining boundary work

The direct upstream FastAPI surface must adopt the same context-ticket contract so bypassing the Next.js local routes cannot weaken the invariant. Background analysis, publication, search, and export jobs must also carry the same project/analysis binding. This is upstream parity work; the interactive Datascene local boundary tested here is enforced.

## Non-isolation observation

The broader M5 automated regression subsequently observed a one-millisecond navigation normalization: an entered `1:11.001` cursor returned as `1:11.000`. No foreign project request or identity mismatch accompanied it. M5 remains manually accepted; this precision observation is tracked separately from project isolation.
