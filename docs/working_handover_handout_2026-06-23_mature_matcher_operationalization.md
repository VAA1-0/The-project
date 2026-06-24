# Working Handover: Mature Data Proliferation Matcher Operationalization

Date: 2026-06-23 17:19 EEST
Updated: 2026-06-24 16:01 EEST

## June 24 Continuation Summary

The recommended operational loop from this handout was implemented in the Meaning Network:

**node/edge anchor -> right-click Matcher -> source-linked candidate gallery -> stage several decisions -> save one governed review round**

The implementation is materially more usable than the June 23 state, but the June 24 manual test exposed a serious matcher-calibration defect:

- selecting the confirmed `Dr. Madeleine Swann` node initially returned cars, buildings, James Bond, and generic person tracks at approximately 93%;
- those scores were not genuine identity similarity;
- the backend was mistakenly treating manual provenance and cross-scene availability as identity evidence.

That scoring defect has now been repaired and regression-tested. The next thread should continue from the remaining policy and gallery refinements documented below.

## Context

This handout captures the end-of-day state for the Datascene/VAA1 general sprint around the Mature Data Proliferation bus, open-topology SOM/matcher support, Search, and the Meaning Network graph.

The central product requirement remains unchanged:

> User-confirmed detections must become reusable source anchors that can automatically proliferate mature-data candidates across the whole video while preserving Datascene/VAA1's linked-data principle: source time, BBox/ROI, provenance, and analyst authority must survive every propagation step.

Today's practical finding was important: the current SOM/matcher work is still too graph-adjacent. It technically projects topology into the Meaning Network, but it does not yet provide the analyst with a clear operational queue for verifying, confirming, rejecting, or navigating candidate matches.

## Current System State

The system has several relevant pieces in place:

- Mature Data Proliferation bus artifacts exist and remain governed.
- Scanner/matcher support exists as diagnostic candidate support, not mature truth.
- Open-topology SOM projection exists in backend Meaning Network assembly.
- Meaning Network can show many source-linked nodes and edges.
- Search can surface saved analyses and now has a safer fallback path when legacy analyses do not hydrate a full content-search index quickly.
- The BBox editor has matcher-related affordances, but candidate surfacing is not yet practically useful.

The key gap:

- SOM/matcher candidates are not yet surfacing as a usable analyst workflow.
- Graph projection alone is not enough. The analyst needs a direct queue.

## What Was Changed Today

### Search Resilience

File: `src/frontend/app/V2components/components/panels/SearchPanel.tsx`

Changes:

- Added a time-bounded Search hydration path.
- Preserved governed Content Search as the primary source:
  `analysisData.contentSearch?.search_index_records`
- Added a panel-local source-media fallback record when rich content-search hydration stalls or returns no rows.
- Ensured loading state clears rather than leaving Search stuck at "Loading search index..."

Purpose:

- Keep the presentation/search surface navigable even when older saved analyses do not provide full indexed records.
- Do not promote fallback rows into mature truth.

### Meaning Network Matcher Visibility Attempt

File: `src/frontend/app/V2components/components/panels/MeaningPlotPanel.tsx`

Changes:

- Added matcher/SOM helper predicates:
  - `isMatcherSomMeaningNode`
  - `isMatcherSomMeaningEdge`
- Increased matcher lane priority in graph layout.
- Included matcher/SOM edges in reviewable edge lists.
- Added a visible Matcher/SOM candidate strip with Review, Confirm, and source-jump affordances.
- Relaxed the dedicated Meaning Network panel overflow so nested scroll containers should not trap the lower panel content.

Important result:

- This was a partial UI improvement, but the user verified in the running environment that SOM candidates still did not surface in a practically useful way.
- Treat this as evidence that the current UI shape is not the right operational abstraction.

## Verification Completed

After Search cleanup:

- `npx tsc --noEmit --pretty false`
  - Passed
- `npm test`
  - 80 tests passed

Earlier same-day verification before the final matcher/Meaning Network attempt:

- Backend test suite passed under `vaa1_core`
  - 160 tests passed, 2 skipped
- Frontend unit suite passed
  - 80 tests passed
- Playwright full suite passed on a clean frontend run
  - 11 tests passed

Known caveat:

- Later Playwright against the live reused dev server exposed Search loading fragility. The Search fallback patch was applied afterward and unit/type gates now pass. Playwright should be rerun tomorrow after a clean restart.

## Product Decision

The next implementation should not try to make the graph itself carry the first operational experience.

The practical feature should be:

1. Known confirmed detection becomes an anchor.
2. Matcher/scanner runs from that anchor.
3. Candidates appear in a concrete review queue.
4. Each candidate has:
   - source video time
   - BBox/ROI or sample anchor where available
   - confidence
   - match basis
   - known anchor reference
   - candidate target reference
   - jump to source
   - confirm
   - reject/drop
   - defer
5. Confirmed/rejected decisions persist into the governed decision ledger.
6. Only then should the Meaning Network graph receive nodes/edges as projection and navigation substrate.

Short version:

> Matcher Review Queue first. Meaning Network projection second.

## Tomorrow's First Implementation Target

Build an operational `Matcher Review Queue` surface.

Recommended placement:

- Primary: Data Maturation panel or a dedicated Matcher panel.
- Secondary entry points:
  - BBox editor `Matcher` button
  - Search panel `Matcher` button
  - Meaning Network node/edge context menu

The queue should not be hidden inside graph scroll/zoom. It should be a clear list/table.

Minimum queue row contract:

```json
{
  "candidate_id": "string",
  "anchor_id": "string",
  "anchor_label": "James Bond",
  "candidate_label": "Confirm Narrative Agent 93%",
  "confidence": 0.93,
  "match_basis": ["visual_similarity", "scene_context", "track_continuity"],
  "source_time": { "start": 96.0, "end": 96.7 },
  "bbox": { "x": 0.52, "y": 0.18, "w": 0.21, "h": 0.54 },
  "provenance": {
    "matcher_run_id": "string",
    "open_topology_som_node_id": "string",
    "source_evidence_refs": []
  },
  "decision_state": "needs_review"
}
```

Minimum row actions:

- `Jump`
- `Show BBox/ROI`
- `Open Traceback`
- `Confirm match`
- `Reject candidate`
- `Defer`

## Design Principle To Preserve

Do not let matcher output become a new truth island.

The flow must remain:

- user confirmation / mature source anchor wins
- matcher proposes
- analyst or governed decision ledger promotes
- raw detector labels never override confirmed mature data
- source time and BBox/ROI are not optional for visual detections
- unknown/untimed candidates can exist, but they must be labelled as incomplete and blocked from mature promotion

## Practical Acceptance Criteria

For the Bond trailer example:

- If James Bond has several confirmed mature detections earlier in the clip, a later `Confirm Character` / `Confirm Narrative Agent` BBox should surface as a probable match candidate.
- The candidate should be navigable directly to the later video time.
- The analyst should see why it is a match:
  - visual sample similarity
  - repeated track/appearance support
  - source scene context
  - optional transcript/audio/role support
- The analyst can confirm the candidate as James Bond.
- After confirmation, the video overlay should no longer ask to confirm the same mature identity at that source position.
- The Meaning Network should show the confirmed/candidate relation only after this queue has source-linked data to project.

## Open Questions

- Should the first queue live in Data Maturation or as a separate `Matcher` panel?
- Should BBox `Matcher` open a focused queue filtered by the selected BBox/ROI?
- Should Search `Matcher` open the same queue in global analysis mode?
- How aggressive should cross-scene matching be by default?
  - Recommended default: allow cross-scene matching for mature anchors, but require source-time and visual evidence before promotion.

## Recommended First Steps Tomorrow

1. Inspect backend matcher refresh output shape for one known anchor.
2. Add or normalize a frontend `MatcherReviewCandidate` type.
3. Build candidate queue rows from:
   - `evidence_proliferation_matches`
   - `open_topology_som`
   - `multimodal_pattern_scanner_candidates`
   - existing mature/manual anchors
4. Make BBox `Matcher` button open the queue filtered to the selected detection.
5. Wire row `Jump` to `openVideoAtTime`.
6. Wire row `Confirm` / `Reject` to the existing proliferation decision ledger.
7. Only after this works, project queue candidates into Meaning Network as traceable nodes/edges.

## Final Note

The core insight from today:

The system does not need more hidden topology first. It needs a direct operational loop:

**confirmed anchor -> scan -> candidate queue -> source verification -> decision -> proliferation.**

That loop is the key to making Mature Data Proliferation real.

## June 24 Delivered Work

### Meaning Network Matcher Entry

File:

- `src/frontend/app/V2components/components/panels/MeaningPlotPanel.tsx`

Delivered:

- Right-clicking a Meaning Network node or edge exposes `Matcher: find constellations`.
- The request preserves:
  - selected anchor ID and label;
  - source evidence references;
  - source time where available;
  - BBox/ROI geometry where available;
  - source track ID where available;
  - requested matcher target;
  - open-topology SOM governance.
- Candidate traceback remains available from the review surface.

### Source-Linked Matcher Review Queue

Delivered candidate actions:

- source preview;
- BBox/ROI overlay;
- jump to source;
- open source in a second video panel;
- open traceback;
- check match;
- reject;
- defer;
- clear staged decision.

The queue supports a multi-candidate review round:

1. Check several matching detections.
2. Reject or defer other candidates.
3. Press `Save review round`.
4. Persist all decisions into the existing proliferation decision ledger.

Confirmed candidates are stored with:

- `manual_confirmation` authority;
- `user_confirmed_truth` maturity result;
- original candidate time and geometry;
- matcher anchor and match basis;
- governed projection targets for Master Schema, Meaning Network, Narrative Agent, video/BBox views, Scene Cards, Search, and Traceback.

### Visual Thumbnail Gallery

The review queue now defaults to `Visual gallery` and also offers `All evidence`.

The visual gallery:

- uses a larger two-column contact-sheet layout on wide panels;
- only shows time-linked candidates with BBox/ROI geometry;
- excludes contextual-only evidence from the primary identity gallery;
- seeks each preview to the candidate source time;
- supports hover playback;
- lets the analyst click the image itself to check or uncheck the match;
- shows a clear checked state;
- retains explicit Jump and Traceback controls.

This responds directly to the June 24 manual finding that one vertically stacked moving preview at a time was too slow and ambiguous for identity review.

## June 24 Matcher Calibration Repair

Files:

- `src/backend/analysis/evidence_proliferation_matcher.py`
- `tests/test_evidence_proliferation_matcher_contract.py`

### Root Cause

The previous probability calculation gave all manual visual annotations:

- `0.90` contextual modality support;
- `0.95` cross-scene continuity support.

Those values were granted because the source was manual and traceable, not because it matched the selected identity. Consequently, an Aston Martin annotation and a James Bond annotation both scored `93.24%` against Dr. Madeleine Swann.

This confused two separate questions:

1. Is the candidate evidence trustworthy and source-linked?
2. Does the candidate represent the same identity?

### New Character Compatibility Classes

Character-continuity matching now distinguishes:

- `direct_identity`
  - candidate explicitly carries the selected identity;
- `unknown_person`
  - visual person candidate that may be the selected identity;
- `known_identity_option`
  - named identity offered only when the source BBox itself is anonymous;
- `contextual_support`
  - transcript, metadata, audio, or scene evidence that supports interpretation but is not visual identity proof;
- `incompatible`
  - non-person object or a known different identity;
- `not_applicable`
  - matcher target is not character continuity.

Rules now enforced:

- Cars and other non-person objects are rejected from named-character matching.
- A named `Dr. Madeleine Swann` anchor rejects a known `James Bond` candidate.
- A generic person candidate may remain reviewable, but its confidence is capped at `62%`.
- Contextual-only character support is capped at `44%`.
- Manual provenance no longer produces a high identity probability by itself.
- An anonymous `Confirm Narrative Agent` BBox may still receive known identities as analyst-reviewable options.

### Live Bond Verification

The restarted backend was queried against the current Bond analysis using the `Dr. Madeleine Swann` Meaning Network identity.

Result:

- candidate count reduced from 25 noisy candidates to 9 mixed evidence items;
- direct Dr. Madeleine Swann annotations surfaced at source-linked times;
- James Bond manual identity annotations and car annotations no longer surfaced as visual identity matches;
- one generic `person track 5` remained as a lower-confidence review option;
- contextual metadata and one James Bond audiovisual source sample remained in the backend SOM as low-confidence support, but are excluded from the default visual gallery.

This is a substantial correction, but not the final desired policy.

## Verification Completed June 24

- Focused backend matcher contract:
  - `9` tests passed with `unittest` under `vaa1_core`.
- Frontend TypeScript:
  - passed.
- Frontend contract/unit suite:
  - `80` tests passed.
- Full Playwright suite:
  - `11` tests passed in Chromium.
- `git diff --check`:
  - passed.
- Backend:
  - restarted from `vaa1_core`;
  - healthy at `http://127.0.0.1:8000/api/health`.
- Frontend:
  - remains available at `http://127.0.0.1:3001/dashboard`.

Note:

- `pytest` is not installed in the current `vaa1_core` environment, so the focused backend file was run through Python `unittest`.

## Remaining Issue For The Fresh Thread

The next work is no longer “make a matcher UI.” The queue, source previews, staged decisions, and batch save now exist.

The remaining work is matcher evidence policy and mature-data feedback:

### 1. Separate Anchor Evidence From New Candidate Decisions

Existing manual annotations that already say `Dr. Madeleine Swann` currently surface as direct matches and may inherit manual-authority proliferation eligibility.

They should instead be visibly separated into:

- `Known anchor samples`
  - already confirmed identity examples used to guide matching;
- `New candidates to confirm`
  - unknown person detections that may receive the identity;
- `Contextual support`
  - audio, transcript, metadata, scene, and co-occurrence evidence.

The primary confirmation gallery should focus on `New candidates to confirm`.

### 2. Prevent Contextual Samples From Looking Like Identity Candidates

The backend SOM can still include low-confidence contextual items such as a James Bond audiovisual sample while matching Madeleine. This may be useful as constellational context, but it must not appear as a person-identification choice.

Recommended change:

- add an explicit candidate role:
  - `anchor_sample`;
  - `identity_candidate`;
  - `context_support`;
  - `conflict`;
- make the frontend filter on that role rather than infer it from source panel and geometry;
- never allow `context_support` to be confirmed as the selected identity.

### 3. Calibrate Unknown Person Candidate Generation

The present matcher can only review unknown person candidates that are already represented in the matchable evidence pool.

The practical proliferation feature still needs:

- extraction of representative thumbnails from unconfirmed person tracks across the full video;
- clustering duplicate frames from the same track/time continuum;
- multiple appearance samples for clothing, lighting, angle, and scene changes;
- face/appearance vectors or existing visual identity vectors where available;
- audio/voice samples as support, not a substitute for visible identity proof;
- full-video coverage checks so the beginning of the video does not dominate candidate generation.

### 4. Close The Feedback Loop After Save

After a review round is saved, verify in the running UI that:

- checked candidates become user-confirmed truth;
- the corresponding BBox label changes to the mature identity;
- repeated `Confirm Character` requests are suppressed at that source;
- Master Schema receives the mature subject projection;
- Narrative Agent receives the new appearance/sample;
- Meaning Network gains traceable confirmed edges;
- Search exposes the newly matured detection;
- rejected candidates do not immediately return unchanged in the next matcher run.

## Recommended Fresh-Thread Starting Task

Implement an explicit backend candidate-role contract and use it to divide the matcher surface into three compact sections:

1. `Known samples`
2. `Confirm these detections`
3. `Context supporting this match`

Then run the Dr. Madeleine Swann and James Bond cases end to end, save several checked unknown-person candidates, and verify that the mature identity replaces later confirmation BBoxes across the associated panels.

The practical acceptance sentence for the next thread is:

> The analyst selects one known identity, sees only plausible unknown-person thumbnails as confirmation choices, checks several, saves once, and those source-linked detections become durable mature identity throughout Datascene/VAA1.

## June 24 Matcher UI Sprint Closure

The candidate-role and review-surface slice described above is now implemented.

Delivered:

- backend candidates carry one explicit role:
  - `anchor_sample`;
  - `identity_candidate`;
  - `context_support`;
  - `conflict`;
- known samples are guidance only and cannot be staged as new identity promotions;
- contextual evidence is inspection-only and cannot be confirmed as visible identity;
- only `identity_candidate` records can enter the governed batch decision ledger;
- the Matcher review queue is divided into:
  - `Known samples`;
  - `Confirm these detections`;
  - `Context supporting this match`;
- the visual gallery keeps source-linked BBox/ROI detections primary while `All evidence` exposes contextual support;
- candidate roles survive into the open-topology SOM projection.

Verification:

- backend full suite under `vaa1_core`: `162` passed, `2` skipped;
- focused matcher contract: `10` passed;
- frontend unit/contract suite: `80` passed;
- TypeScript: passed;
- Playwright Chromium suite: `11` passed;
- `git diff --check`: passed.

Known non-blocking repository issue:

- targeted ESLint remains red on long-standing `MeaningPlotPanel.tsx` and `api-service.ts` baseline violations, primarily historical explicit `any` usage and synchronous state updates in effects. The matcher slice adds no new TypeScript errors, and the project type, contract, browser, and backend gates pass.

The matcher UI sprint is therefore complete at the implementation and regression-test level. The next product proof remains a live saved-analysis round in which several unknown-person detections are confirmed and their mature identity is observed after refresh across BBox/ROI, Master Schema, Narrative Agent, Meaning Network, and Search.
