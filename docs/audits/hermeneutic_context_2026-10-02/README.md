# Hermeneutic-context propagation — first operational slice

Date: 2026-10-02

## Delivered benefit

Direct FastAPI ingress for Global Clock, StatsKit runs, and Data Book video/corpus
publication now validates one governed project/analysis context and propagates the
resulting ticket into the downstream result or publication manifest. The ticket
binds project, analysis, canonical source fingerprint/edition, clock revision,
correction generation, lens/research question, authority, provenance, and actor.

Missing or disagreeing context fails closed before computation or publication.
Rejected identities and entry paths append to
`outputs/api_results/boundary_audit/hermeneutic_context_violations.jsonl`.

## Evidence

- 16 focused backend tests plus 4 subtests passed for the ticket, source clock,
  and publication contracts.
- 20 interactive-annotation and source-isolation tests plus 21 subtests passed.
- Frontend TypeScript passed with `npx tsc --noEmit`.
- The canonical macOS launcher reported ready on ports 8000 and 3001.
- Live FastAPI probes returned 428 for missing project context, 403 for a Bond
  project paired with the Marcella analysis, and 200 with a content-bound ticket
  for the correct `research-test-2026` context.

## Remaining boundary

This is the first cross-consumer slice, not blanket context completion. Search,
Meaning/Plot, Narrative Agent computation, governed-report/Traceback routes, all
background-job admission and resume paths, archive download authorization, and
the remaining direct FastAPI analysis routes still require the same propagated
ticket. No stage beyond its individually evidenced surface is declared complete.
