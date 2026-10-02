# StatsKit dynamic-section maintenance delivery

Date: 2026-10-02

StatsKit's principal workbench surfaces now use a shared dynamic-section host.
The canonical initial order is alphabetical. Analyst drag order persists under a
panel-scoped key. A non-alphabetical product default is permitted only when both
an explicit priority and its rationale are declared.

Each section can fill its host panel or detach as a live React surface into a
separate browser window. Closing that window through its own controls, browser
chrome, or an abrupt/programmatic close returns the section to its host and
removes the placeholder. Detachment does not clone analytical state.

The shared host now contains every top-level StatsKit disclosure: Analysis
completeness, Analysis setup, Comparison studio, Language analysis by scene,
Relevance scanner, Research question, Significance workbench, Statistical
overview, Stats metadata view, Stats workbench table, and Visualization.
Conditional sections join the same ordering when they are available. Sections
start closed, and their headers report useful state such as verification,
configuration, row, selection, category, source-layer, score, or comparison
readiness information rather than decorative overview text.

Verification:

- TypeScript passed with `npx tsc --noEmit`.
- Seven focused source contracts passed.
- One Chromium rendered workflow passed, covering alphabetical startup,
  drag-and-drop persistence, fill/return, detach, and automatic host return.

The historical broad governance test retains unrelated pre-existing source-shape
failures and is not represented as clean by this delivery.
