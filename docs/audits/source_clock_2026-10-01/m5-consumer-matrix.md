# Global Clock M5 consumer matrix — 1 October 2026

## Outcome

**Failed analyst review. M5 is open.** The first automated run proved that all
16 surface wrappers could publish and receive the shared cursor. It did not
prove that the consumer inside each panel surfaced evidence associated with the
beat. The analyst correctly rejected that transport-only result on 1 October
2026.

User case:

1. Open the ordinary Bond/COP30/Helsinki dashboard and select No Time to Die.
2. Open each named surface against that analysis.
3. From its own revision-bound Source Clock anchor, seek successively from
   `1:11.000` through `1:11.015`.
4. Verify Video follows the selected Bond source within 0.1 seconds.
5. From Video, publish `1:12.000` and verify every surface receives the return
   navigation under the same bound clock.

| Surface | Clock transport | Analyst-observed consumer response |
|---|---:|---:|---:|
| Video | Pass | Pass |
| Transcript | Pass | Fail: hit highlighted but not raised into view |
| Audio | Pass | Fail: no highlight or automatic surfacing |
| Objects | Pass | Fail: panel empty/not hydrated |
| OCR | Pass | Correct absence at the tested beat, but explicit no-hit state still required |
| Expressions | Pass | Correct absence at the tested beat |
| POS | Pass | Open: define and surface time-linked language evidence without inventing aggregate hits |
| Quant | Pass | Open: define and surface time-linked measurements without treating corpus aggregates as beat events |
| Scene Cards | Pass | Fail: containing scene not surfaced |
| Narrative Agent | Pass | Open: surface source-scoped character occurrences at the beat |
| Meaning / Plot | Pass | Fail: graph cursor/current evidence not surfaced |
| Master Schema | Pass | Open: surface active temporal evidence at the beat |
| Data Maturation | Pass | Open: surface time-scoped candidate/accepted evidence at the beat |
| Search | Pass | Open: surface contextual time-linked results, not an invented text-search hit |
| StatsKit | Pass | Open: surface time-scoped observations and label aggregate-only results explicitly |
| Traceback | Pass | Open: surface provenance for the active beat evidence or state that none is selected |

The test uses analysis `8183c1fd-7cb9-49d0-b20c-378399e9c41f`, fingerprint
`sha256:9b025baee45f793dee3b25bfb440233c8b216fef1e06cfce3951b93d6cf39c2f`
and clock revision
`clock-v1:090136e316575f653476b21e6baf01178e5bcd9a1b19d7e56bfe228c2d2e9e66`.
The shared duration is `2:35.105`.

## Additional boundaries

- **No media:** saved POS and Quant remain available and project-bound when
  playable media requests are deliberately aborted; rendered Chromium passes.
- **Missing timing:** Transcript and Expressions state sampling/interval gaps
  and follow the nearest evidence without inventing coverage.
- **Precision:** explicit second/millisecond fields, minute rollover,
  frame/sample adapters and VFR presentation timestamps pass.
- **Long representation:** the 12,500-second automated case passes, but it is
  not substituted for the required observation on a real >1,000-second source.
- **Project isolation:** ordinary Dashboard scope remains the five-record
  Bond/COP30/Helsinki project.

## Verification

- Rendered 16-surface bidirectional matrix: **1 passed** in 1.5 minutes.
- Rendered genuine-expression concordance at `0:08.000`: **1 passed**.
- Rendered Transcript concordance-to-Video navigation (`1:08.200` →
  `1:14.960`): **1 passed**; actual video within `0.1s`.
- Post-adapter rendered 16-surface transport/source-boundary matrix: **1 passed**
  in 1.6 minutes.
- Focused clock/representation suite: **34 passed**.
- Rendered no-media POS/Quant case: **1 passed**.
- TypeScript: passed.

## Corrected consumer contract

Every panel must follow the revision-bound cursor and place its associated
time-scoped evidence in view. At a beat with no evidence, it must expose an
explicit no-hit/gap state and may identify the nearest evidence without
silently stretching it across the cursor. Aggregate-only data remains visible
but must be labelled non-temporal rather than promoted into a beat hit. M5 must
be rerun against this consumer-response contract. The real >1,000-second row
remains a separate physical-source blocker.

Analyst refinement: the shared presentation is a three-part concordance view:
`before`, `on beat`, and `after`. The on-beat lane contains only measurements or
intervals that actually address the cursor under declared precision. Before
and after remain contextual neighbors with their own source times and distances;
they are never relabelled as present on the beat. This concordance dimension
applies across multimodal detections. Expressions is the first operational
consumer of the shared resolver.

Expressions acceptance uses a genuine saved-evidence exchange at `0:08.000`:
`emphatic` at `0:07.000`, `reflective` on the beat at `0:08.000`, and `tense`
at `0:09.000`. The rendered check must prioritize `reflective`, expose the two
neighbors through the soft arrows, and show all three—at their own timestamps—
in the Concordance frame.

The soft-arrow selection is also source navigation, not a rail-only preview.
Selecting a neighbor publishes its own revision-bound source time; the Video
panel seeks to that frame and the selected neighbor becomes the new on-beat
evidence. The rendered round trip `0:08 → 0:07 → 0:08 → 0:09 → 0:08` passes
with the actual video element within `0.1s` at every step. Opening or closing
the three-lane Concordance overview alone does not move the source clock.

The same operating principle is now supplied by one shared panel adapter for
Transcript, Audio, Objects, OCR, Quant, Scene Cards, Meaning/Plot, Narrative
Agent, Search, Master Schema, Data Maturation, StatsKit, and Traceback. Each
surface resolves only its source-timed authoritative rows. POS—and StatsKit
when no source-linked quantitative segment exists—shows an explicit
aggregate-only notice instead of manufacturing a beat hit. Expressions keeps
its native implementation. M5 remains open pending analyst confirmation of
the newly surfaced consumers.

Screenshot review on 1 October 2026 identified and corrected two further
consumer defects. The primary lane now renders every detection whose declared
point or interval addresses the beat; it no longer hides the set behind an
“additional detections” count. The list is bounded by an internal scroll area,
while before/after remain single nearest neighbors.

Meaning/Plot now derives source-timed graph nodes at the cursor, lists them
beside the graph, highlights their graph marks in yellow, and centers the
scrollable graph viewport on the yellow playhead (and the first active node
vertically). At the review beat `1:08.200`, the saved Bond graph contains three
genuine overlapping nodes: Scene 3 (`48–72s`), `SPEAKER_03` (`68–72s`), and
the transcript speaker node `Unknown speaker` (`68–72s`). Untimed nodes are not
promoted into this set.

An initial rendered rerun was blocked while the stopped local services left the
control clock in `verifying…`. After the documented Datascene restart, both
corrected UI paths passed in rendered Chromium; the temporary outage is not
counted as feature acceptance evidence.

Later screenshot review at `1:08.200` exposed three cross-surface semantic
contradictions, corrected the same day:

- Scene Cards resolved Scene Card 003 (`0:48–1:12`) in the concordance rail but
  left the report body on Scene Card 001. The panel now subscribes directly to
  the revision-bound clock, selects the containing half-open interval, and
  scrolls that card into view. This avoids double membership at shared scene
  boundaries.
- Quant promoted repeated analytical references to one label/span as separate
  detections (19 `control` rows in the review screenshot). Equal normalized
  label/start/end references are now one detection with a preserved analytical
  reference count.
- POS said both that its data were aggregate-only and that no beat detection
  existed despite a timed transcript interval. Governed POS vocabulary is now
  deterministically projected onto transcript occurrences; each result states
  that its timing is transcript-interval-linked, not word-level timing.

Current verification: TypeScript passes; nine focused contracts pass; rendered
Chromium passes both the Scene Cards/Quant/POS consistency case and the complete
on-beat/Meaning-Plot graph case at `1:08.200`.
