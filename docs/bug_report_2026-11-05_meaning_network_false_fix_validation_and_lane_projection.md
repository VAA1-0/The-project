# Bug Report: Meaning Network False-Fix Validation, Conflicting Speaker Projection, and Misaligned Evidence Lanes

Date: 2026-11-05

Severity: Critical analyst-trust and visual-data-integrity failure

Status: Reproduced and repaired in the live No Time to Die artefact; regression and acceptance requirements recorded below

Affected analysis: `81920e95-a0b2-4173-bc23-86db7909a0a9`

Affected source: *No Time to Die* trailer, source interval around `00:06.280`

## Executive summary

The Meaning Knowledge Graph repeatedly appeared unchanged after multiple repair attempts. The first spoken line continued to display `UNKNOWN: Why would I betray you?`, while the Prosody / delivery and Objects / props rows appeared empty. Several earlier repair reports incorrectly stated that the issue was fixed.

The confusion was not caused by one defect. It resulted from several independent failures that could partially conceal one another:

1. a deleted duplicate upload left a residual imported-work directory that was mistaken for the live analysis authority;
2. the live API initially pointed its Master Schema output registration at the residual duplicate;
3. the running browser retained an older 458-node projection while a clean browser loaded a different, richer projection;
4. a raw `UNKNOWN` transcript node survived beside correctly resolved Madeleine nodes;
5. an obsolete canonical label projection could override the governed speaker label in the UI;
6. a temporal join treated a 25 ms overlap with the following James Bond turn as competing speaker evidence; and
7. the SVG used different lane arrays to position headers and bars, shifting populated prosody and object bars into the wrong visual rows.

The repeated false reports were also a validation failure. Backend counts, lane headers, and the presence of “Madeleine” somewhere in the panel were used as proxies for the actual analyst-visible requirement. Those proxies were insufficient.

## User-visible symptoms

At source time `00:06.280`:

- On Beat and the Video overlay could identify Dr. Madeleine Swann correctly.
- The Meaning Network node and Meaning Sheet still displayed `UNKNOWN: Why would I betray you?`.
- The tooltip could simultaneously report `Narrative agent: UNKNOWN` and describe Madeleine as the speaker.
- Prosody / delivery and Objects / props lane headers were present but their rows appeared empty.
- Corrected and unresolved spoken-word nodes could coexist at the same source interval.
- A clean automated browser and the analyst's existing browser could show different graph generations.

The final successful screenshot at 13:55:43 demonstrates the intended state: the spoken line is attributed to Dr. Madeleine Swann, prosody bars occupy the Prosody / delivery lane, and object evidence occupies the Objects / props lane.

## Confirmed root causes

### 1. Duplicate-upload lineage obscured the live authority

The source had been uploaded twice. One catalogue entry was deleted, but its residual extracted store remained at:

`outputs/imported_work/233bce22-d82b-4aeb-8af5-c3182c61612f`

The registered live analysis is:

`81920e95-a0b2-4173-bc23-86db7909a0a9`

Earlier work regenerated or inspected artefacts under the residual store and treated them as proof of the live application's state. The stores carried different correction generations, so successful filesystem regeneration did not prove successful live hydration.

### 2. Master Schema output registration pointed at the wrong store

The live record's output-file registry retained a path into the residual duplicate. Consequently, the live Master Schema download could return an older sparse schema even after the canonical live schema had been rebuilt. The live output registration now points to the canonical live analysis directory.

### 3. Browser generations diverged

The analyst's mounted browser continued to render a 458-node graph while a newly opened automated browser rendered a substantially different projection. A fresh-client result was incorrectly treated as proof of the analyst's current session. Restarting the frontend eliminated the stale bundle, but the incident shows that graph revision and client revision need an explicit visible contract.

### 4. Corrected and unresolved transcript projections coexisted

The Master Schema contained governed speaker assignments and the graph contained corrected Madeleine records, but the raw node `transcript:0:6.280` remained visible as `UNKNOWN`. Adding a correct node was not equivalent to superseding the incorrect node.

### 5. Label precedence violated authority

The transcript node's attributes and description could be governed by `explicit_user_confirmation`, while a projected or previously confirmed `UNKNOWN` label still controlled the visible title. The display resolver now prevents an unresolved projected label from overriding an explicitly resolved Master Schema speaker assignment.

### 6. Temporal overlap was treated as a Boolean

Madeleine's governed assignment covered `6.270–7.509`. The following James Bond assignment began at `7.575`, while the raw transcript segment extended to `7.600`. The original join treated Bond's 25 ms boundary overlap as competing evidence and retained the unresolved label.

The corrected rule:

- privileges exact target identity;
- requires meaningful temporal overlap;
- ranks candidates by overlap duration; and
- preserves ambiguity only when the leading assignments are genuinely close.

### 7. SVG lane headers and bars used different indexes

Lane headers were calculated from `packedLaneNodes`, which excludes empty lanes. Bar positions were calculated by iterating the unfiltered `laneNodes`. When an earlier lane was empty, every later bar was shifted upward into the wrong visual band.

The correction makes both headers and bars use `packedLaneNodes`. Post-fix rendered geometry verified:

- Prosody band: Y `356–422`; rendered Madeleine prosody bars at Y `387` and `415`.
- Objects band: Y `440–506`; rendered object bars at Y `471` and `499`.

## Why the issue was incorrectly reported as fixed

The earlier checks did not test the user's actual complaint. They tested weaker proxy conditions:

- Master Schema arrays were non-empty.
- The API returned object, speaker, and prosody records.
- The graph contained lane headers.
- “Madeleine” appeared somewhere in the panel.
- The exact `UNKNOWN` phrase was absent at source time `00:00.000`.
- A clean browser eventually rendered a richer graph.

None of those checks proved that, at `00:06.280` in the analyst's live browser:

1. the selected spoken-word node displayed Madeleine;
2. no competing `UNKNOWN` spoken-word node remained;
3. a governed prosody bar was geometrically inside the Prosody / delivery band; and
4. object bars were geometrically inside the Objects / props band.

The term “fixed” was therefore used without satisfying the true acceptance condition. This was a process and experimental-design failure, not merely a coding defect.

## Correct acceptance contract

A repair to a visual knowledge graph is complete only when all layers agree in one live analysis revision:

| Layer | Required assertion at `00:06.280` |
|---|---|
| Correction ledger | Governed speaker evidence identifies Dr. Madeleine Swann |
| Master Schema | Speaker assignment and prosody intervals are source-time bound |
| Persisted graph | Raw unresolved evidence is superseded for display, retained only for traceback |
| API | Downloads resolve through live analysis `81920e95…`, not the deleted duplicate store |
| Client state | Browser graph revision matches the live API/artifact revision |
| Spoken-word lane | No visible `UNKNOWN:` node overlaps the line; Madeleine is displayed |
| Prosody lane | At least one Madeleine prosody bar overlaps `6.280` and lies within the lane's Y bounds |
| Objects lane | Mature object evidence is rendered inside the lane's Y bounds at its governed source intervals |
| Meaning Sheet | Selected-node title, narrative agent, maturity, and authority agree |
| Restart test | The same assertions pass after frontend and backend restart |

Lane-header existence and record counts are diagnostic information, not acceptance evidence.

## Preventive requirements

1. Add a rendered end-to-end test that seeks to `00:06.280`, opens the exact transcript node, and asserts the visible label and Meaning Sheet authority.
2. Give every rendered presence bar testable lane, node, label, start, and end attributes.
3. Assert bar geometry is contained by its declared lane band, not merely that the bar carries a semantic lane identifier.
4. Fail when resolved and unresolved nodes with the same semantic identity and overlapping interval coexist in a consumer view.
5. Make analyst-confirmed authority outrank raw or unresolved canonical label projections.
6. Use overlap duration, target identity, and an ambiguity margin for temporal joins; never use any-overlap Boolean logic for adjacent speaker turns.
7. Expose graph artifact revision and client hydration revision in the UI and force invalidation when they diverge.
8. Reject output-file registrations that resolve outside the live analysis authority unless explicitly declared as traceback input.
9. Treat duplicate-source stores as lineage records, never interchangeable live analyses.
10. Do not report a visual defect as fixed until the analyst-visible state is checked at the reported source time after restart.

## Regression coverage added

- Explicit Master Schema speaker assignments replace unresolved transcript labels.
- Rendered presence bars expose lane, node ID, label, start, and end for end-to-end inspection.
- Lane bands and presence bars use the same packed-lane index.
- Content-addressed graph revisions change with graph content.
- Explicit refresh invalidates both the view cache and API artefact caches.
- Master Schema resolved evidence includes speaker assignments and prosody.
- Analyst-governed visual speaking confirmation receives overlapping prosody.

## Trust and communication note

Repeatedly reporting the issue as fixed while the analyst could still reproduce it damaged confidence in both the implementation and the validation process. Future status reports must distinguish clearly between:

- data written;
- API projection verified;
- clean-client rendering verified;
- existing-session rendering verified; and
- complete analyst-visible acceptance achieved.

Only the final state should be described as fixed.
