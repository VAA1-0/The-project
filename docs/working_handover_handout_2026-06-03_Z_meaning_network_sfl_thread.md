# VAA1 Meaning Network SFL/Moral Reading UI - Thread Handout

Date: 2026-06-03

Scope: handoff for the thread that moved the Datascene Meaning Network "Meaning Sheet / Node" and "Meaning Sheet / Edge" SFL/moral reading controls from a single mutually exclusive annotation picker toward multiple complete interpretive readings per node or edge.

This handout is written for a fresh continuation thread. It records what changed, what was pushed, what remains open, and which files matter.

## Core Rule

Keep schemas whole.

The analyst may attach more than one interpretive reading to the same Meaning Network node or edge. An ideational reading, interpersonal judgement, textual reading, virtue reading, and vice reading should not exclude each other.

Each saved reading must persist as a complete governed schema record, not as a partial SFL fragment or a single overwrite-prone category flag.

## User Problem

The original Meaning Sheet UI had a single "annotation" category selector for SFL/moral readings. Choosing one category effectively displaced the others, even though a node may need several simultaneous readings.

Example: a node such as James Bond, Bond's car, or a scene/object marker may need:

- an ideational reading,
- an interpersonal judgement reading,
- a textual reading,
- a virtue reading,
- a vice reading.

These readings should be parallel interpretive records, not mutually exclusive modes.

## UI Changes Made

The Meaning Sheet controls were simplified into operational rows.

The final intended row set is:

- Ideational: subcategory dropdown.
- Interpersonal: relation, judgement group, judgement value dropdowns.
- Textual: subcategory dropdown.
- Virtues: virtue family, virtue axis, virtue value dropdowns.
- Vices: vice family, vice axis, vice value dropdowns.

Each row has its own:

- Add,
- Confirm,
- Reject.

The rows save their own complete draft, so saving a vice reading does not depend on the current state of the virtue row or a global main-category selector.

## Naming And Display Adjustments

Several names were adjusted during the thread:

- The large "Interpretive readings" / "Draft reading" box was removed after it proved too widget-like.
- Source verification and traceback were reduced to compact one-line metadata strips.
- "Main category" became always-visible rows rather than a single dropdown.
- "Virtues/vices" was split into separate Virtues and Vices rows.
- The Vices row no longer displays virtue-facing attributes. It now uses vice-facing labels.

Vice family labels now render as analyst-facing vice groupings:

- Intellectual closure,
- Cowardice / deception,
- Cruelty / alienation,
- Corruption / oppression,
- Arrogance / compulsion,
- Nihilism / despair.

Vice axis labels are derived from antithesis values, such as "cruelty / sadism" rather than "kindness".

The underlying schema still stores the canonical moral taxonomy path with:

- `sfl_layer: "virtues_and_vices"`,
- `moral_polarity: "vice"` for vices,
- `confirmation_relation: "morally_delegitimizes"` for vices.

## Schema And Persistence Changes

`src/frontend/app/V2components/components/panels/MeaningPlotPanel.tsx` now defines a complete governed reading record:

```text
vaa1.meaning_network_interpretive_reading.v1
```

The record includes:

- `reading_id`,
- `target_kind`,
- `target_id`,
- `reading_lens`,
- `status`,
- SFL layer/category fields,
- judgement fields,
- moral polarity,
- virtue/vice fields,
- confirmation relation,
- taxonomy path,
- applied label,
- plain-language meaning,
- source verification status,
- source anchors,
- evidence refs,
- traceback refs,
- authority level,
- maturity state,
- propagation flags.

Candidate, confirmed, rejected, and deferred states are distinguished through:

```text
MeaningNetworkReadingDecision = "confirmed" | "canceled" | "deferred" | "inspected"
```

The save path now keys records by the full reading taxonomy:

```text
meaning-network-reading:${readingRecord.reading_id}
```

This replaced the old overwrite-prone pattern:

```text
meaning-network-sfl:${kind}:${id}
```

Only confirmed readings proliferate. Candidate readings remain complete governed records but do not proliferate until confirmed.

## BBox/ROI Authority Side Work

The same pushed commit also includes a BBox/ROI authority improvement that happened earlier in the thread:

- `src/frontend/lib/bbox-authority.ts` now exports `buildManualBBoxRoiAnnotation`.
- `src/frontend/app/V2components/components/panels/OBJDetectionPanel.tsx` uses that shared builder when saving object-backed BBox corrections.

The purpose is to keep manual BBox/ROI correction geometry, interval, confirmation event, coordinate system, and traceback metadata in one shared authority builder instead of rebuilding the schema locally in the Objects panel.

This is related to the larger BBox/ROI coordinate-authority work, but it did not complete the full coordinate-authority pass.

## Electron Dev Port Fix

`electron.js` was adjusted so dev mode opens the current VAA1 frontend launcher URL:

```text
http://127.0.0.1:${VAA1_FRONTEND_PORT || PORT || 3001}/dashboard
```

This addressed a practical mismatch where the running frontend was on port `3001`, while Electron still targeted `localhost:3000`.

## Tests And Validation

The following checks passed before push:

```text
cd src/frontend && npx tsc --noEmit
cd src/frontend && npm run test:governance
cd src/frontend && npm test
```

The governance suite was updated to assert:

- complete interpretive reading schemas,
- multiple reading support through a ledger,
- candidate reading add controls,
- row-based main categories,
- interpersonal relation / judgement group / judgement value alignment,
- compact source and traceback metadata,
- complete reading ids,
- no overwrite-prone old SFL id,
- separate virtue and vice value controls,
- vice-facing family and axis labels,
- BBox/ROI saves using the shared authority builder.

## GitHub State

Changes were committed and pushed to GitHub.

Branch:

```text
petteri
```

Commit:

```text
63b4369 Harden Meaning Network readings
```

Remote:

```text
origin/petteri
https://github.com/VAA1-0/The-project.git
```

The GitHub CLI (`gh`) was not installed in the local environment, so no draft PR was opened from the CLI.

## Runtime Notes

During the thread, the frontend dev server on port `3001` had been stale/frozen. It was killed and restarted with:

```text
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 npm run dev -- --hostname 127.0.0.1 --port 3001
```

The server hot-reloaded the final edits. If a fresh thread inherits an active session, it may still be running.

## Current Meaning Network Edge Diagnosis

The user asked whether edges are present in the Meaning Network graph.

Diagnosis:

- Edges are present.
- They render as thin SVG lines between nodes.
- Each graph edge has a transparent hit target.
- Single-click jumps to source evidence.
- Double-click opens the Meaning Sheet / edge inspector.
- Right-click opens the edge context menu.
- The Edge Markers list also exposes source-linked edges, but its items currently jump to source rather than opening the edge sheet directly.

Remaining UX weakness:

- Edges are hard to recognize visually.
- They lack labels, arrowheads, selected-edge highlighting, and obvious affordance.

Likely next improvement:

- Add hover/selected edge state.
- Make edge labels visible enough to identify relation type.
- Consider arrowheads or small relation chips.
- Let Edge Markers open the edge sheet directly, or provide separate "source" and "sheet" actions.

## Important Files

- `src/frontend/app/V2components/components/panels/MeaningPlotPanel.tsx`
- `src/frontend/tests/manual-annotation-governance.test.mjs`
- `src/frontend/lib/bbox-authority.ts`
- `src/frontend/app/V2components/components/panels/OBJDetectionPanel.tsx`
- `electron.js`
- `docs/vaa1_bbox_roi_regime_two_week_effort_handout_2026-06-01.md`
- `docs/working_handover_handout_2026-06-01_Y_bbox_roi_thread.md`

## Continuation Guidance

Do not collapse the Meaning Network readings back into one category selector.

Keep:

- one complete schema per saved reading,
- multiple readings per node/edge,
- separate Virtues and Vices rows,
- vice-facing labels in the Vices row,
- candidate readings non-proliferating until confirmed.

If improving graph edges next, treat it as operational visibility rather than decoration. The analyst needs to recognize, select, inspect, confirm/reject, and trace edges as first-class Meaning Network claims.
