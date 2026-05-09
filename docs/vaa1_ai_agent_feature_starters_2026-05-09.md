# VAA1 AI Agent Feature Starters

Date: 2026-05-09

This note translates the selected AI Agent feature report into VAA1 starter
contracts that can be implemented without adding risky dependencies or hidden
network behavior.

## Operating Policy

- Prefer MIT, Apache-2.0, BSD, and CC0 components in the VAA1 core.
- Isolate or avoid GPL, AGPL, and MPL components unless the user explicitly
  chooses a separate service boundary.
- Preserve VAA1 evidence governance: manual correction wins, raw detections are
  preserved, and generated interpretations remain annotations until matured.
- No hidden network calls. External metadata, LLM, or web capture work must be
  explicit and provenance-bearing.

## Starter Contracts Added

Code: `src/backend/analysis/ai_agent_feature_starters.py`

Tests: `tests/test_ai_agent_feature_starters_contract.py`

The starter module currently covers:

- Automated metadata harvesting
- Webpage comparison
- LLM gateway and RAG boundary
- Report-writing agent
- Audio command interface
- Native learning and pattern accumulation

## What Is Live Now

The module can already:

- Produce a governed feature-starter manifest.
- Mark permissive components as core-compatible and strong-copyleft components
  as isolate-or-avoid.
- Build OAI-PMH, Wikidata, or IMDb metadata harvest request seeds without fetching.
- Build text/link/tag webpage snapshot records from provided HTML.
- Compare two webpage snapshots with text, link, and tag deltas.
- Prepare an LLM annotation request envelope without sending it.
- Render a Markdown report with visible evidence references.
- Route recognized command text to safe video/panel/correction intents.
- Write append-only learning feedback events.

## Why This Shape

The report names useful libraries, but several of them imply network access,
browser automation, model loading, or license boundaries. The starter module
keeps each process available to VAA1 while deferring heavier integration until
the user can choose deployment mode and license boundaries.

## Next Implementation Steps

1. Wire the feature-starter manifest into an admin/tools panel as a readable
   "available processes" view.
2. Add a backend endpoint for writing the manifest into `outputs/`.
3. Expand the report renderer from Markdown into HTML, then DOCX/PDF when the
   dependency choice is approved.
4. Add an explicit metadata-harvest job runner with allow-listed sources.
5. Add Playwright capture as an optional frontend/dev dependency only after the
   browser automation boundary is approved.
6. Add LLM gateway execution only behind an operator-enabled API configuration.
7. Connect learning feedback events to existing manual correction and mature
   evidence flows.
