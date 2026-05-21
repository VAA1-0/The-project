# VAA1 Working Handover Handout - 2026-05-21 W

## Immediate Context

This handout is for starting a fresh thread after the traceback, BBox/ROI evidence hub, and first Narrative Agent vocabulary migration work became too context-heavy to continue comfortably.

Current branch:

```text
petteri
```

Current workspace state at handoff:

- The previous traceback and BBox/ROI evidence hub commits were already pushed.
- The current Narrative Agent UI vocabulary migration is implemented locally but not yet committed or pushed.
- `npm test` passes.
- `npx tsc --noEmit` passes.
- One untracked file exists and should be reviewed before any commit:

```text
docs/VAA1_Bojean_Antenarrative_5B_Genre_Traceability_Schema.json
```

Do not commit that untracked JSON unless the user explicitly confirms it belongs to this sprint.

## Current User Concern

The user confirmed that the first vocabulary migration looks better, especially the former `Identification` leaf now surfacing as `Narrative Agent`.

However, the right-side Narrative Agent / Master Schema leaf still has several "mute" navigation regions:

- `User Confirmed Anchor`
- `Confirmations consult anchors`
- `Panel Corrections`
- `Bbox Roi Corrections`
- `Metadata Corrections`
- `Narrative Agent Profiles`
- `Concise Pattern Confirmations`
- `Master Schema Subject Authority`
- governed subject cards
- `Narrative Agent refinement candidates`
- manual Narrative Agent rows

These currently read as status displays, not as live navigation controls. The user wants these surfaces to become navigable, evidence-bearing controls rather than static text.

## What Was Just Implemented Locally

### Narrative Agent Vocabulary Migration

The first UI alias pass has been implemented:

- `Identification` leaf title now surfaces as `Narrative Agent`.
- `Identification Leaf` menu item now surfaces as `Narrative Agent Leaf`.
- Native annotation / ROI intent surfaces use `Narrative Agent`.
- Master Schema candidate review uses `Narrative Agent candidate/refinement/promotion`.
- Object panel analyst label copy uses `Narrative Agent`.
- Source Media metadata uses `Narrative Agent Profiles` language.
- Meaning / Plot dramatic language shifted away from identity-first wording.
- API download/error labels now expose `Narrative Agent` wording for legacy identity artifacts.

Important compatibility rule:

- Internal legacy values are intentionally preserved for now:
  - `Identification`
  - `identification`
  - `identity_affirmation`
  - `identity_triangulation`
  - `identity-candidates`
  - `IdentityCandidate`

This is deliberate. These are persisted schema/API contracts and should not be renamed in one hard cut.

### Saved Layout Migration

The screenshot showed an old GoldenLayout tab still titled `Identification`. This was caused by persisted workspace layout state.

Implemented locally:

- Saved GoldenLayout configs are normalized on restore.
- `ManualIdentification` component tabs are retitled to `Narrative Agent`.
- Existing panel activation refreshes the title.
- Manual leaf description now says:

```text
Manual Narrative Agent annotations live here as a dedicated leaf, while also remaining visible in the Master Schema.
```

## Files Modified Locally

Frontend source:

```text
src/frontend/app/V2components/components/LayoutHost.tsx
src/frontend/app/V2components/components/MenuBar.tsx
src/frontend/app/V2components/components/panels/MasterSchemaPanel.tsx
src/frontend/app/V2components/components/panels/MeaningPlotPanel.tsx
src/frontend/app/V2components/components/panels/OBJDetectionPanel.tsx
src/frontend/app/V2components/components/panels/SourceMediaMetadataPanel.tsx
src/frontend/app/V2components/components/panels/ToolsPanel.tsx
src/frontend/app/V2components/components/panels/VideoPanel.tsx
src/frontend/lib/api-service.ts
```

Frontend tests:

```text
src/frontend/tests/manual-annotation-governance.test.mjs
```

New handout:

```text
docs/working_handover_handout_2026-05-21_W.md
```

## Validation Already Performed

From `src/frontend`:

```bash
npm test
npx tsc --noEmit
```

Result:

- `npm test`: 44/44 passing
- `npx tsc --noEmit`: passing

Known harmless warning:

```text
[MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of analysis-request.js is not specified...
```

This warning existed before and is not part of the current sprint.

## Critical Next Sprint Goal

Make the Narrative Agent / Master Schema navigation alive.

The immediate UX issue is not vocabulary anymore. It is that the displayed authority and maturity surfaces are mostly inert. The next thread should treat the Master Schema / Narrative Agent leaf as a navigable evidence hub.

Priority:

1. Turn `Master Schema Subject Authority` cards into clickable source-navigation entries.
2. Turn `User Confirmed Anchor` status blocks into clickable filters / navigations.
3. Make `Confirmations consult anchors` open the relevant traceback/source-chain view.
4. Make `Concise Pattern Confirmations` chips open their supporting evidence families.
5. Make manual Narrative Agent rows jump to the video interval and show the associated BBox/ROI when available.
6. Preserve calm, low-noise visual styling. Avoid making this into another noisy dashboard.

## Intended Navigation Behaviors

### Master Schema Subject Authority

Each governed subject card should support:

- click: open the subject's Narrative Agent evidence thread
- secondary action or right-click: open Traceback
- if time evidence exists: jump video to source time
- if BBox/ROI exists: show source BBox/ROI
- if only metadata exists: open Source Media metadata record

Suggested payload:

```ts
eventBus.emit("openTraceback", {
  evidenceType: "narrative_agent",
  evidenceId: subject.id,
  label: subject.label,
  sourceRefs: subject.sourceRefs,
});
```

### User Confirmed Anchor

Each status block should become a filter/navigation control:

- `Panel Corrections`: show manual panel corrections
- `Bbox Roi Corrections`: show BBox/ROI corrections needing confirmation
- `Metadata Corrections`: open Source Media metadata correction surface
- `Narrative Agent Profiles`: open Narrative Agent profile review queue

### Concise Pattern Confirmations

Each chip should open a filtered evidence view or traceback chain:

- `Character Audio Trail Recognition`
- `Character Visual Pattern Recognition`
- `Language Name Place Text Confirmation`
- `Narrative Structure Meaning Plot Confirmation`
- `Mise En Scene Level Understanding`

These should not be inert labels. They should become one-click paths into their supporting evidence.

## Current Architectural Principle

The BBox/ROI and Narrative Agent surfaces should continue moving from:

```text
static category displays
```

to:

```text
navigable evidence anchors
```

The key phrase for the next thread:

```text
Every visible maturity claim must be navigable to source evidence.
```

## Do Not Break

Do not rename persisted backend/schema fields in this sprint:

- `identity_affirmation`
- `identity_triangulation`
- `identity_refinement`
- `identity-candidates`
- `Identification`

Use UI-level display aliases first. Backend/API renaming should be a later compatibility migration with adapters.

Do not let raw detections resurface as semantic truth. Raw/grouped detector data may remain visible only as substrate/provenance/traceback.

Do not allow BBox/ROI manual corrections to be overwritten by:

- raw detection
- grouped track
- proliferated candidate
- stale panel-local state

## Recommended First Actions In Fresh Thread

1. Run:

```bash
git status -sb
git diff --stat
```

2. Review local Narrative Agent migration diff.

3. Confirm tests:

```bash
cd src/frontend
npm test
npx tsc --noEmit
```

4. Commit the current vocabulary/layout migration if acceptable.

Suggested commit message:

```text
Migrate visible identity UI to Narrative Agent language
```

5. Start the next implementation slice:

```text
Make Master Schema / Narrative Agent authority surfaces navigable.
```

## Manual Retest Notes

After the current local migration is running in the browser:

1. Hard refresh VAA1.
2. Open the former Identification leaf.
3. Confirm tab says `Narrative Agent`.
4. Confirm panel body says `Manual Narrative Agent annotations...`.
5. Confirm menu says `Narrative Agent Leaf`.
6. Confirm ROI/native annotation surfaces use `Narrative Agent`.
7. Confirm Master Schema candidate area says `Narrative Agent refinement candidates`.
8. Confirm remaining issue: authority/status cards are still mostly mute and need the next sprint.

## Sprint Status

Done:

- Traceback drawer minimum implementation.
- BBox/ROI evidence hub minimum implementation.
- Multi-select relation quick annotations.
- Positive/social relation quick annotations.
- Basic movement/action quick annotations.
- Apply-scope defaulting to `This interval only`.
- First visible Narrative Agent vocabulary migration.
- Saved GoldenLayout title migration for former Identification leaf.

Still to deliver before `.exe` sprint:

- Make Narrative Agent / Master Schema authority surfaces navigable.
- Make mature Narrative Agent data reliably surface on BBox/ROI overlays.
- Finish BBox/ROI authoritative persistence flow: saved manual state wins everywhere.
- Implement clearer source-chain / evidence-tree population beyond the current sparse first version.
- Continue model-use governance: YOLOv8 / FFmpeg alternatives and user-chosen model use.
- User agreement / consent flow.
- LLM API setup and governance.
- Pre-`.exe` packaging readiness pass.

