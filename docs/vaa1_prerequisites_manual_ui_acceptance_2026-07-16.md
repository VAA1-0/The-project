# VAA1 prerequisites manual UI acceptance

Date: 2026-07-16

Analysis: `NO_TIME_TO_DIE_Trailer_UK_-_James_Bond_007_720p_h264 (7).mp4`

## Progress

- Test 1 — analysis opens and remains responsive: continue observing
- Test 2 — transcript source alignment: passed
- Test 3 — Scene Card source alignment: passed
- Test 5 — StatsKit row inspection and visualization: passed, including checks 5.6–5.8
- Test 6 — Meaning / Plot and existing Boje lens: passed
- Test 6 navigation note: Traceback opens in its own panel. Closing it preserves the Meaning / Plot graph state, but does not return keyboard or panel focus automatically to the originating Meaning / Plot panel. This is a non-blocking 1.0 navigation limitation.
- Test 7 — Narrative Agent consistency: failed at evidence-count and graph-source integrity checks; testing continues to document deliverable behavior and defects.
- Narrative Agent 1.0 workbench revamp: the complete panel is now ordered around character governance rather than information display. Character selection and operational actions come first; source evidence and interpretation form the primary work surfaces; next decisions follow; analytical metadata and matching memory remain secondary collapsed disclosures. The primary analytical surface uses a constrained reading width and dense aligned rows rather than separate metric cards. Source actions are explicit on actionable rows. This establishes the broad operational architecture; detailed interaction and visual refinement remain later work. Test 7 remains open until manually completed.
- Transcript Edit span defect: fixed; persistence retest remains
- Scene Card Video button: removed as redundant; card selection retains automatic video sync
- Color regime boundary: the Visual cues panel can calculate a transient browser reading from the current frame, and the backend has an OpenCV BGR/HSV spatial-tone implementation. This saved analysis has no persisted `spatial_tone_scan`, so StatsKit and Master Schema must report the measurement as `not computed`, not as a measured zero. Persisted, source-linked color measurement is deferred beyond this prerequisites acceptance pass.
- StatsKit 1.0 candidate: measured-data Test 4 values passed (Scene Cards 6; camera shots 188; organizations 3; places 2; color not computed). Final acceptance remains the refreshed check of source actions, Source annotations, POS/Quant rows, and explicit interpretive statistics.

Keep Chrome Developer Console open and clear. Stop if `Maximum update depth exceeded`, repeated failed requests, continuous rerendering, a frozen panel, or loss of the selected analysis appears.

## Test 4 — StatsKit source and measurement integrity

1. Open `StatsKit` from the top panel tabs. If it is not open, use the upper `Tools` menu and choose `StatsKit`.
2. Confirm the analysis name at the top is the selected No Time To Die trailer.
3. Set `Stats family` to `Level I / Descriptive`.
4. Set `Scope` to `Video`.
5. Set `Visualization` to `Bar chart`.
6. Set `Audience` to `Analyst`.
7. Click `Run StatsKit` once.
8. Wait for the status to return to ready. Do not click repeatedly.
9. Expand `Stats workbench table`.
10. Locate rows concerning scene intervals, shots or shot boundaries, transcript/speech, objects, OCR, and expressions.
11. Change `Stats family` to `Taxonomy / Attribute readiness`.
12. Confirm the workbench exposes the complete 47-category empirical regime as alphabetized atomic attribute rows. Inspect at least one operational or partial row and one target-only, missing, nominal, or experimental row.
13. Use the `Theme` dropdown to inspect `Audio`, `Visual`, `Narrative`, and `Governance`; confirm each selection narrows the table without removing attributes from `All themes`.
14. In `Source Media`, expand `Primary Metadata`, enter or confirm at least one `Organization` and one Place, City, Country, or Room value, then save.
15. Click `Refresh maturity`, return to StatsKit, and verify `Organizations` and `Places` use the confirmed Source Media values when no stronger governed count is present.
16. Locate the color or color-regime row. For this saved analysis, confirm it says `not computed` or equivalent calm unavailable wording. A live Color regime reading in Visual cues does not satisfy this check because it is not yet a persisted measurement artifact.
17. Confirm `Source annotations`, `POS tagged tokens`, `Quant tokens`, and related POS/Quant rows are visible in the descriptive family. Select each kind and confirm its evidence contract opens directly beneath the row without leaving StatsKit. Timed evidence should seek the existing video; untimed evidence should remain clearly identified.
18. Confirm Aristotle, Freytag, Campbell, Frye, and Booker each have a separate reading-count row. Confirm the five agency/character frameworks also have separate rows. A persisted count may be numeric; an absent framework-explicit artifact must say `not computed` rather than infer a count from the UI vocabulary.

Pass when:

- the run completes without freezing the program;
- six governed Scene Cards are not presented as six measured shots;
- true shot-boundary data is shown separately if available, or quietly marked unavailable;
- no shot count is fabricated from Scene Cards;
- populated rows identify their source or method;
- unavailable rows remain calm and inspectable;
- no result claims significance merely because a descriptive statistic exists.
- the taxonomy view keeps not-yet-operational attributes visible without presenting them as measured results;
- each taxonomy row names its category, readiness state, and known path, or calmly states that no runtime path is registered;
- returning to `Level I / Descriptive` shows concise statistic titles, with Scene Cards and camera shots kept as separate units.
- Source Media confirmations enter Mature Data Proliferation as `user_confirmed_source_metadata`, retain their source reference, and are not downgraded to detector guesses.
- a transient Visual cues color reading is not promoted into StatsKit or Master Schema as governed evidence.

Record: displayed scene count, displayed shot count/status, transcript row values, and any row whose source is unclear.

## Test 5 — StatsKit row inspection and visualization

1. In `Stats workbench table`, click one populated transcript or object statistic.
2. Open its selected-stat inspector.
3. Confirm it shows method, evidence/source layer, required layer, and visualization eligibility.
4. Select a second compatible statistic with its checkbox.
5. Observe the visualization.
6. Collapse the inspector, visualization, and workbench again.

Pass when:

- the inspector explains where the selected value came from;
- selecting a second row changes the visualization;
- incompatible units are not silently presented as directly comparable;
- collapsing returns the panel to compact POS/Quant-style rows;
- the panel remains responsive.

## Test 6 — Meaning / Plot and existing Boje lens

Acceptance result: passed. Steps 1–15 and all source-integrity checks were confirmed. Meaning / Plot retains its prior view after the separate Traceback panel is closed and the analyst returns manually.

Version boundary: this acceptance covers the operational 1.0 foundation—the source-linked graph, governed lens selection, contextual tools, traceback, and retained view state. It does not claim a finished interpretive experience. Automatic return-to-origin focus, deeper Boje projections, richer graph interaction, and further analytical refinement remain later-version work.

1. Open `Meaning / Plot`.
2. Select the `Boje` lens tab if visible.
3. Confirm that selecting the lens does not automatically relabel every scene or node.
4. Open the graph view.
5. Click a visible source-linked node and observe the Video timeline.
6. Right-click the node and inspect the Datascene context menu.
7. Choose traceback/source navigation if present.

Pass when:

- the graph remains usable;
- choosing Boje changes the lens without rewriting source evidence;
- no Bet, Beneath, Between, Beyond, or Becoming assignment is invented from keywords alone;
- clicking a source-linked node seeks to the appropriate video time;
- right-click opens Datascene tools rather than only the browser menu;
- traceback/source navigation remains available.

Boundary: this checks the existing UI lens. The new governed B6 projection does not yet have a dedicated UI reader.

## Test 7 — Narrative Agent consistency

Acceptance status: failed at Steps 3–5. Continue the remaining steps for defect discovery, but do not classify Narrative Agent evidence or Mature Data Proliferation as operational on the strength of the current panel.

Observed for James Bond:

- Source annotations: 3.
- Manual confirmations: 4 surfaces / 5 families.
- Character Evidence Graph: source at `0:30.530`, 3 cues, 3 scenes, and 6 manual records.
- Scene evidence count: 3.

Post-repair Step 3 observation:

- The repaired view now exposes an `Operational evidence` reading with 33 source handles, 45 manual anchors, `0/0/0` visual/audio/audiovisual memory samples, 16 graph nodes, 15 graph edges, and 0 continuity candidates.
- The selected James Bond graph summary now reports source `0:02.000`, 3 cues, 5 scenes, and 30 manual records.
- This is a material improvement over the earlier source `0:30.530`, 3 scenes, and 6 manual graph records. Earlier source evidence and substantially more governed/manual evidence now reach the character view.
- The improvement does not yet reconcile the counting units: `45 manual anchors` and graph `manual 30` remain different unexplained populations. The panel must identify record membership, deduplication, authority, and projection rules for each total.
- Scene coverage improved from 3 to 5, but the remaining absent scene must be evaluated against the canonical Scene Card and confirmed-presence records rather than assumed to be a true character absence.
- Matching memory remains empty (`0/0/0`) and continuity candidates remain 0. These values must remain explicit unavailable/empty states and must not imply that confirmed identity evidence is absent.

The displayed figures do not describe a coherent governed evidence set. `annotations`, `surfaces`, `families`, `manual`, `cues`, and `scenes` use different counting units without exposing their overlap, record membership, provenance, authority, or relationship to proliferation decisions. The panel does not currently make it possible to determine what these numbers mean or verify that they represent correct mature data.

Steps 4–5 graph findings:

- Character Evidence Graph opens.
- Nodes labeled `S1` and `Cue` are placed at `0:00:00.000` without a source link.
- User-confirmed BBoxes are known to exist in the first scene, but those confirmations do not surface as Narrative Agent graph evidence.
- The graph is missing the most mature data available for the selected character; lower-value or unresolved graph records are visible while higher-authority confirmed evidence is absent.
- The first visible matched and source-linked graph detection appears only at approximately `0:30.500` (`0:30.530` in the graph evidence readout).
- Governed scene boundaries are not visible in the graph.
- The graph does not provide a coherent source-time timeline against which nodes, presence intervals, scene spans, and evidence gaps can be read.
- Right-clicking a graph node opens the operating-system/browser context menu rather than the Datascene evidence menu.
- Narrative Agent graph interaction therefore does not yet follow the working Meaning / Plot graph model, where right-click exposes Datascene source, traceback, and governance actions.

Right-click interaction delivery pending manual retest:

- Narrative Agent graph nodes and edges now suppress the browser context menu and open the Datascene graph menu.
- The menu follows the Meaning Network interaction grammar: `Open annotation sheet`, `Jump to source`, and `Open traceback`; nodes additionally expose their linked annotation card.
- Both nodes and edges now open a Narrative Agent annotation sheet. The sheet identifies the selected character, active interpretive reading, graph item type, relation/endpoints where applicable, and source time, and retains source and traceback actions.
- The active reading is carried explicitly across `Performed agency / Shakespearean`, `Narrative function / Proppian`, `Symbolic shadow / Jungian / Mythic`, `Actant relation / Greimasian`, and `Motive scene / Burkean / Dramatistic`. Changing the reading must alter interpretation only; it must not change stable node/edge identity or underlying source evidence.
- Automated governance coverage and TypeScript validation pass. Manual acceptance must still verify node and edge right-click behavior, source seeking, traceback, sheet content, lens switching, and browser-menu suppression in the running application.

Step 6 scene-review finding:

- Scene Cards contain governed presence evidence that is not projected into the Narrative Agent graph. In particular, James Bond is recorded as present in Scene 1, but that presence is absent from the selected character graph.
- This is a confirm-once/project-everywhere violation: the Scene Card presence record must be consumed as the same canonical governed evidence by Narrative Agent rather than requiring another confirmation or a panel-local detection.

Steps 7–13 findings:

- Switching from James Bond to a second governed character changes the active profile, evidence, scenes, and interpretation rather than merging the two characters: passed.
- Returning to James Bond restores the Bond profile. On return the evidence presentation is richer and more complete than the initial landing. This is directionally correct, but the initial incomplete state should be checked for delayed canonical hydration rather than treated as stable restoration if the underlying counts changed.
- Opening an interpretation lens and returning to evidence does not rewrite Bond's identity evidence: passed; behavior was reported as robust.
- `Recommended Next Steps` surfaces three recommendations, but the surface is metadata-only and operationally mute. The diagnosed corrective actions cannot be launched from the recommendation rows: failed.
- Close/reopen consistency check: passed.

Step 12 clarification and pending check:

- `Inspect analytical support and matching memory only when needed` means opening `StatsKit + Significance + Relevance` and `Matching Memory` as optional secondary disclosures.
- Opening either disclosure must not change the selected character, identity evidence, evidence counts, maturity/authority, scene presence, or graph state.
- Their content should explain supporting calculations or reusable matching records without displacing the primary source-evidence and governance work.

Defect classification:

1. **Data/proliferation:** confirmed early-scene BBox evidence is missing from the Narrative Agent graph projection, so current Mature Data Proliferation behavior is not accepted as operational.
2. **Maturity/authority selection:** the graph does not prioritize and surface the most mature available governed evidence for the selected character.
3. **Timing/source integrity:** untimed or unresolved `S1` and `Cue` nodes are rendered as `0:00:00.000` rather than visibly source-pending, and they provide no source navigation.
4. **Temporal model:** scene boundaries and a readable source-time axis are absent, so graph placement cannot be interpreted against the audiovisual structure.
5. **Count legibility:** panel totals mix incompatible units and cannot be reconciled with inspectable records.
6. **Interaction:** the missing Datascene node/edge right-click menu and annotation sheet have been implemented and await manual retest; this defect remains open until source seeking, traceback, lens identity stability, and browser-menu suppression are observed in the running application.
7. **Coverage anomaly detection:** the panel does not challenge implausible character coverage. A character treated as the main protagonist currently appears in only three governed scenes without an alert explaining whether this is plausible, incomplete analysis, missing proliferation, or a genre-relative anomaly.
8. **Scene projection:** governed Scene Card character-presence evidence, including James Bond in Scene 1, is not consumed by the Narrative Agent graph.
9. **Recommendation actionability:** Recommended Next Steps diagnoses three corrective needs but provides no executable route to apply the proposed cure, inspect its target records, or launch a bounded governed check-up.

Required correction boundary:

- One valid user confirmation in any panel is sufficient for the complete governed Datascene projection. The confirmation must be written once to the canonical record and consumed by every applicable panel, graph, timeline, scene, search surface, report, export, and traceback view without requiring panel-local reconfirmation.
- A consuming panel may show the confirmation as unavailable only when it is demonstrably outside that panel's scope or has been explicitly invalidated. It may not silently omit it, downgrade it to a candidate, or replace it with a lower-authority detector result.
- Only a later explicit user correction, rejection, merge, split, or governed invalidation may supersede the confirmed record; propagation or recomputation alone may not.
- Never render a missing time as a real zero-time source anchor.
- Surface confirmed BBox/ROI identity evidence in the selected Narrative Agent graph when canonical projection and source anchors exist.
- Surface canonical Scene Card character-presence evidence in the same graph, including its governed scene span and source anchors.
- Resolve graph evidence by authority and maturity so the strongest governed record is primary while candidates and raw substrate remain visibly subordinate and inspectable.
- Render governed scene boundaries as source-time spans and provide a legible timeline with stable scale, timestamps, presence intervals, node positions, and visible evidence gaps.
- Make each count inspectable against the records it includes and name its counting unit.
- Reuse the Meaning / Plot context-menu interaction grammar for Narrative Agent graph nodes and edges, including annotation-sheet access, source navigation, traceback, and relevant governance actions. Implemented; manual acceptance pending.
- Add a governed Narrative Agent coverage probe/radar. It should compare the selected agent's observed scene, source-time, speaking-turn, visual-presence, relation, and evidence-node coverage with genre-, format-, duration-, and narrative-role-aware benchmark distributions.
- The probe should ask calm, actionable questions such as: `If this is the main protagonist, why does confirmed evidence surface in only 3 of 6 scenes?`
- Every alert must expose the observed numerator and denominator, benchmark cohort and sample size, expected range or distribution, deviation measure, evidence maturity/quality, known coverage gaps, and the source layers checked.
- Benchmark comparison must remain diagnostic. It may flag `review coverage`, `check missing detections`, `re-run bounded identity matching`, `inspect scene exclusions`, or `verify role assignment`, but it must not manufacture presence nodes, infer protagonist status from frequency alone, or promote candidates automatically.
- Automated check-ups initiated from an alert must be bounded, source-linked, recorded in observability and maturation economics, and return reviewable candidates with a before/after coverage account.
- When no valid benchmark cohort exists, the panel must say so and fall back to within-video proportional checks rather than presenting a population norm.
- Turn every recommendation into an available governed action. A recommendation must identify its target evidence set and provide the relevant operation—for example inspect missing records, open the affected scene/source, run a bounded matching check, verify a role, review candidates, or correct/invalidate the underlying record. Descriptive diagnosis without an executable remedy is not an operational next step.

1. Open `Narrative Agent`.
2. Select `James Bond` from the character dropdown.
3. Note the source, manual, graph, and scene evidence counts.
4. Select another character.
5. Return to James Bond.
6. Open the evidence review mode.
7. Open the scene review mode.
8. Use one source or scene link.

Pass when:

- one character profile is active at a time;
- returning to James Bond restores the same profile and counts;
- switching review modes does not alter evidence counts;
- candidate readings are not displayed as confirmed identity facts;
- source navigation opens the correct video or scene;
- missing samples use quiet operational language.

## Test 8 — Maturation authority boundary

Paused at Step 3 on 2026-07-17; resume from the selected `Person track 10` confirmation case.

Observed stopping state:

- `Person track 10` opens source at approximately `0:35.000` and corresponds visually to a BBox already carrying the user-confirmed identity `James Bond` in the Video panel.
- The Maturation case does not surface `James Bond` anywhere in the related claim, candidate, cluster, authority, maturity, source, propagation, or traceback data. It instead remains labeled `person track 10` / `tracked_object:10` and reports `BBox/ROI: not anchored here`.
- This violates the confirm-once/project-everywhere boundary: the existing manual identity confirmation is not being joined into the Maturation projection for the same source-linked detection.
- Clicking the row-level `Confirm` control produces no visible decision, state transition, confirmation record, error, or diagnostic feedback.
- Because Narrative Agent person tracks have previously bled across identities, this track must not be treated as safely confirmable until canonical BBox identity linkage, track continuity, and cross-character isolation are verified.
- Test 8 remains open. Do not promote `Person track 10` or classify track confirmation as operational on the basis of the current UI.

Systemic correction delivered 2026-07-18; manual retest pending:

- Track-to-manual-identity projection no longer depends only on a panel-local `metadata.target_id`. The shared maturation bus now resolves explicit track references first and otherwise permits a join only when source-time ranges overlap and normalized BBoxes have meaningful spatial overlap.
- The recovered canonical identity label, manual anchor reference, match basis, BBox, and provenance are carried through the candidate/hypothesis contract.
- If spatially associated annotations disagree on identity, the track remains unresolved; the mechanism does not choose one identity or allow promotion.
- A track already covered by a canonical manual identity no longer creates a redundant confirmation hypothesis or scanner confirmation need.
- Generic unresolved person tracks require both a source BBox and canonical identity linkage before `Confirm` becomes available. They remain inspectable, deferable, and droppable.
- Decision persistence now reports explicit success, governance blocking, and backend failure states in the selected case instead of failing silently.
- Automated regression coverage passes for mismatched-ID recovery, ambiguity refusal, confirmation gating, and visible persistence feedback. Resume Test 8 at Step 3 and verify the repaired projection against the actual `Person track 10` data.

Revised authority boundary after live-payload inspection on 2026-07-18:

- The live record proves that the manually confirmed `James Bond` occurrence at the displayed frame is the individual BBox annotation `indication:object:10:34.700-35.000...`, governed over `34.700-37.600`. `Person track 10` is a separate provisional tracking artifact and is not the mature identity record.
- Track continuity is not trusted for maturation until the tracker has an explicit configuration and passes identity-continuity, scene-boundary, and cross-character bleed tests. Track IDs remain raw traceback substrate only.
- All track-derived confirmation needs, candidate opportunities, governed hypotheses, and prior track-decision rows are removed from the Maturation confirmation surface. The refreshed live audit now reports 0 governed track hypotheses, 0 confirmation needs, and 0 candidate opportunities; 176 tracked candidates remain counted only as raw analytical substrate.
- BBox review now uses individual detections rather than track aggregates. Source time plus normalized coordinates identify the occurrence. The label is a governed, changeable semantic value that may mature that detection only; it cannot relabel previous or later detections unless separate maturation criteria are met.
- Maturation rows now suppress the browser context menu and expose Datascene actions: inspect detection, jump to source, open the annotation sheet, and open traceback.
- Audit refresh now recomputes the live maturation audit under the current governance policy instead of retaining hypotheses produced by an obsolete policy.

Phase 2 manual retest observation:

- Step 1 passed: raw `Person track 10` is absent from Confirmations.
- Step 2 only partially passed: the BBox view opened, but it did not project the existing governed individual BBox at `34.700-37.600`, so Steps 3 onward could not be evaluated.
- Root cause: the BBox queue harvested only detector candidates; canonical manual BBoxes were routed exclusively through the Manual population.
- Correction: the BBox view now includes canonical governed manual BBoxes alongside unconfirmed individual detections. Governed rows expose source time, coordinates, label, authority, maturity, source, propagation, and traceback, and retain source/annotation-sheet navigation. Manual acceptance remains pending.
- Correction: governed BBox focus is now bidirectional. Selecting a BBox in Video sends its canonical annotation reference, source interval, normalized coordinates, and label to Maturation; Maturation opens the BBox queue, selects the matching individual record, and scrolls it into view. Selecting that Maturation row seeks Video and highlights the exact source overlay. The event is source-tagged to prevent feedback loops and never uses a provisional track ID as its synchronization key.
- Manual retest pending: activate the governed `James Bond` BBox in Video and verify that the `34.700-37.600` BBox row becomes active in Maturation without an additional search; then select the row and verify the same BBox is highlighted in Video.
- Maturation source times now use the same `m:ss.mmm` clock as Video rather than raw seconds. While the Maturation confirmation worktable is open, BBox navigation may seek and synchronize Video but cannot implicitly open Objects or another leaf panel; leaving Maturation requires an explicit panel action.
- The Maturation BBox context menu now separates semantic maturation from geometry editing. `Open annotation sheet` opens a local Maturation taxonomy sheet anchored to the selected BBox, with action/event, emotional continuity, motive, narrative function, SFL judgement, theme, virtue/strength, and vice/antithesis dimensions. `Edit source BBox` separately opens the Video geometry/label editor. Saved taxonomy values remain scoped to the governed source occurrence unless later proliferation criteria are explicitly met.
- The recurring raw-seconds display defect is promoted to a program-wide source-clock invariant. Video and Maturation now consume one shared `m:ss.mmm` formatter, their synchronization events identify the canonical `source_media.clock`, and Maturation checks selected intervals through the operational backend authority resolver without applying invalidation. Numeric time alone is not accepted as authority; every governed interval must carry a recognized timing status under the canonical hierarchy.
- Manual retest regression (18:07): selecting a live Video BBox no longer focused the corresponding Maturation attribute; the panel remained on Confirmations with the Dynamic posture selected. Root cause was an equality-only join that assumed the rendered overlay, canonical annotation, and Maturation row shared an identical ID or static serialized BBox. The saloon-door resolver now ranks canonical references first, then canonical source-time overlap, normalized spatial overlap for moving/keyframed geometry, and governed-label support for compatibility projections. Track IDs remain excluded. The resolved BBox queue row is visibly selected and scrolled into view. Test 8 remains open pending manual Video → Maturation → Video confirmation.
- Manual retest (2026-07-29): Video → Maturation focus passed for the governed `James Bond` occurrence at `0:34.700–0:37.600`; the correct canonical BBox row was selected rather than a provisional track. The screenshot exposed a usability defect: the sought row appeared as the last visible line. The focus presentation now promotes an externally sought BBox to the first visible row and aligns it to the start of the worktable without changing the underlying chronological queue. Manual refresh confirmation of the first-row presentation remains pending.
- Manual retest closure (2026-07-29): the first-row presentation was confirmed in the running application. Test 8 passes for the governed Video → Maturation → Video BBox focus path: the canonical `James Bond` occurrence is selected instead of a provisional track, appears first on sight, retains its source time and occurrence-scoped authority, and returns focus to the corresponding Video BBox. The broader no-meta-poster audit of descriptive Maturation lanes remains separately documented and is not promoted by this focused pass.
- Maturation annotation-sheet completion (18:10): the prior eight free-text fields were a partial scaffold. The sheet now provides governed dropdowns for the full Narrative Agent working contract: characteristic/appearance/evidence/authority/maturity states; action, relation, trajectory, vocal affect, emotional continuity, continuity and match basis; Shakespearean performed agency, Proppian function, Jungian/Mythic symbolism, Greimasian actants, and Burkean/Dramatistic motive; SFL judgement, motives, themes, virtues, and vice antitheses. It also consumes the same shared BBox category, subcategory, and label registry as Video. Saving updates the governed source annotation and its occurrence-scoped semantic taxonomy without track propagation.

Additional Maturation operationality failure:

- `Manual confirmed anchors / source of truth`, `Constellational co-occurrence / dynamic queue`, `Non-user confirmed data / needs leverage`, `Mature data surfaces / delivery`, `Audiovisual source sampling / not operationalized`, `Live proliferation bus / automatic review projection`, `Genre-specific knowns / cascading rule`, and the `Quality Agent / Audit-only review tray` currently function as descriptive governance labels rather than operational data surfaces.
- `Manual anchors need mature surface proof` similarly states a diagnosis without exposing the affected anchors, expected destinations, missing projections, source evidence, or a bounded corrective action.
- These rows therefore fail the sprint's no-meta-poster rule. A Maturation category may remain visible only when opening or selecting it yields an actual filtered record population, explicit counting unit, source anchors, authority/maturity, traceback, and relevant governed actions.
- Categories without operational records or executable work must remain absent from the primary panel or appear only as quiet unavailable states inside a secondary governance/status disclosure.

1. Open `Maturation`.
2. Confirm the default queue is `Confirmations`.
3. Select one candidate with an identifiable source time.
4. Click `Inspect` or `Select`.
5. Review its source, authority, maturity, evidence, and candidate/cluster context.
6. Use its source-time jump.
7. Confirm the video moves to the expected moment.
8. Do not confirm yet.
9. Open another panel and return to Maturation.

Pass when inspection alone does not promote the candidate, its source link survives, queue state remains stable, and the UI stays responsive.

For a clearly valid candidate only:

10. Click `Confirm`.
11. Inspect its destination in Objects, Master Schema, or Narrative Agent.

Pass when confirmation is explicit, the governed destination updates, the raw candidate remains available for traceback, and unrelated records do not change.

## Test 9 — Correction, persistence, and reopen

Acceptance result (2026-07-29): passed. A bounded object-label correction saved successfully, appeared consistently in Objects and Master Schema, retained its source relationship, survived analysis close/reopen, did not duplicate on hydration, and did not alter unrelated object records.

1. Open `Objects`.
2. Choose one harmless, clearly incorrect object label.
3. Click `Edit` or `Correct`.
4. Enter a corrected normal-format label and save.
5. Record the corrected label and source time.
6. Open `Master Schema` and locate the correction.
7. Close the analysis or open another analysis.
8. Reopen the No Time To Die analysis.
9. Return to Objects and Master Schema.

Pass when the correction survives reopening, retains its time, appears consistently, preserves the raw detection for traceback, does not alter unrelated objects, and is not duplicated on reopen.

## Test 10 — Transcript Edit span persistence retest

Revised acceptance boundary (2026-07-29): do not create a knowingly false timing correction merely to exercise persistence. The non-mutating dynamics check covers source seeking, exact editor hydration, cancel/close, panel reopen, and analysis reopen. A new `Speaker confirmation` field now permits a legitimate occurrence-scoped transcript governance action without changing correct timing or text. Its dropdown consumes the shared governed character list and also offers `Announcer`, `Voice-over narration`, `Background noise`, and `Crowd`. Manual save/reopen confirmation remains pending.

Acceptance result (2026-07-29): the speaker-confirmation control surfaced, saved, and survived switching to another analysis and returning. Corrected transcript hydration feeds the current frontend Meaning Network transcript nodes and Narrative Agent line/profile matching. Confirm-once/project-everywhere remains incomplete: the confirmation is not yet a canonical speaker-assignment object in Master Schema, and it does not yet bind a diarization cluster or governed audio sample cloud into a reusable voice profile. Any later audio-profile proliferation must remain candidate-producing, source-timed, quality-gated, and separately governed; `Background noise` and `Crowd` are source classes rather than individual speaker identities.

Implementation closure (2026-07-29): the identified projection gap is delivered. Named speakers now synchronize as canonical `speaker.assignment` decisions; crowd/background synchronize as `audio.source_class`; Master Schema exposes assignments and voice-profile candidates; Meaning Network receives assignment and `spoken_by` edges; Narrative Agent consumes the same corrected speaker evidence; and eligible spans identify overlapping diarization turns/clusters for candidate-only audio-profile proliferation. Unknown/algorithmic speaker labels are excluded. The active acceptance analysis was migrated to nine current named-speaker projections; one historical `UNKNOWN` decision created before the final guard loaded was append-only invalidated and no longer projects. See `docs/vaa1_governed_speaker_assignment_audio_profile_delivery_2026-07-29.md`.

Prosody closure (2026-07-29): confirmed speaker assignments now bind overlapping measured prosody through a canonical source-time projection. The same enriched evidence reaches Master Schema, Meaning Network (`prosody_of`), Narrative Agent scene/profile graphs, audio sample clouds, the evidence matcher, StatsKit/native interpretation, Scene Cards, Time Bank, and Audio/Transcript consumers. Conflicts remain unassigned; crowd/background remain source-class prosody; unknown speakers are excluded; and no motor may auto-promote identity. See `docs/vaa1_confirmed_narrative_agent_prosody_delivery_2026-07-29.md`.

Test 10 acceptance closure (2026-07-29): passed under the revised non-destructive boundary. Correct transcript timing was not knowingly falsified. Source seeking, editor hydration, close/reopen behavior, analysis switching, and speaker-confirmation persistence passed. The saved confirmations also survived canonical projection and the governed prosody runtime probe without duplicating transcript rows or changing correct source timing.

1. Open `Transcript`.
2. Select a genuinely timed row and click `Edit span`.
3. Change the start by a visible amount, for example `6.00` to `6.50`.
4. Click `Save in panel`.
5. Confirm the row immediately displays the corrected time.
6. Close and reopen Transcript.
7. Click the row and confirm the video seeks to the corrected time.
8. Reopen the analysis and inspect the row again.

Pass when the corrected start/end survive every step while the original source relationship remains traceable.

## Test 11 — Source Media compactness and persistence

Manual retest finding (2026-07-29): compact disclosure behavior passed, but a saved `Organizations` value disappeared after switching to another analysis and returning. The save endpoint retained the list in `source_media_annotations`, while the governed annotation resolver and rebuilt Source Media response omitted the field. Both projection points now include `organizations`; the downstream Mature Data Proliferation, Master Schema, and StatsKit consumers remain connected to that governed value. Analysis-switch hydration also rejects stale responses from the analysis being left. The active acceptance record was recovered with `Manual prerequisites acceptance test` present in its Organizations list. Manual switch-away/switch-back confirmation remains pending.

Acceptance closure (2026-07-29): passed. The saved Organizations value survived switching to another analysis and returning, Primary Metadata retained its compact disclosure behavior, and the repaired governed projection rehydrated the saved list correctly.

1. Open `Source Media`.
2. Confirm `Primary Metadata` begins collapsed.
3. Expand it.
4. Add `Manual prerequisites acceptance test` to Organizations.
5. Save.
6. Collapse Primary Metadata.
7. Close and reopen Source Media.
8. Expand Primary Metadata and confirm the organization remains.
9. Open another analysis.
10. Return to the original analysis.
11. Reopen Source Media and expand Primary Metadata.
12. Confirm the organization remains.

Pass when Primary Metadata begins collapsed, the organization persists through panel and analysis reopening, other fields remain unchanged, feedback is quiet, and collapse restores a compact panel. Remove the temporary organization afterward if desired.

## Test 12 — Global panel stability

Manual sweep finding (2026-07-29): POS and Quant frequently occurring terms were not presented as an unambiguous sequence of source occurrences. POS and Quant, including their matrix views, now keep occurrence evidence in canonical source-time order and show a running number for each normalized term within its analyzed array (`term · 1`, `term · 2`, ...). The numbering is presentational and occurrence-scoped; it does not alter the underlying term identity, frequency count, or evidence link. Manual confirmation remains pending.

Expressions cleanup (2026-07-29): the active source contained 161 sampled expression frames, of which 112 were explicit no-face/no-BBox sampling records and 49 were source-linked face detections. The weighting layer previously ranked an all-zero label table and deterministically surfaced its first label, `amused`, with `assertive` as runner-up and a `0.0%` margin. No-face/error/no-evidence samples now resolve to `unavailable` and are filtered before the shared expression array reaches Expressions, Video, Master Schema, Meaning Network, StatsKit, Time Bank, Tools, or other consumers. Expressions retains a quiet sampling-coverage count; raw artifacts remain unchanged for traceback. Manual confirmation remains pending.

Character Timeline proliferation repair (2026-07-29): manually confirmed character BBoxes such as `Ernst Stavro Blofeld` and `Lyutsifer Safin` reached Video as mature display labels but remained generic `object` records in the shared Master Schema view. Character Timeline intentionally admitted only Narrative Agent, character, and identity nodes, so those confirmed visual occurrences were omitted. Every manually affirmed visual identity now emits a separate exact-label, source-timed `identity` record through `manual_visual.identity_affirmation`, while its original object record retains geometry and traceback. Meaning/Plot consumes the identity projection as a character-row mark. Manual confirmation remains pending.

Master Schema loop assurance (2026-07-29): the identity projection is explicitly exposed under Identification → `Confirmed visual identity occurrences`, including exact label, source time, manual authority route, and linked object reference. The companion object record retains BBox geometry, and both records use the original manual annotation ID as their stable join rather than a generated array index. Selecting the identity occurrence returns to its Video source. This keeps Master Schema inside the confirmation → proliferation → Meaning/Plot → source traceback loop. Manual confirmation remains pending.

Character Timeline runtime correction (2026-07-29, 18:24 retest): the first repair assumed confirmed identities originated in `OBJ`; the active Blofeld record is instead a manual `Identification / Character` annotation at `77.000–80.800`. The long confirmed label and short profile label were also grouped literally, producing separate rows, while untimed profile seeds were displayed as misleading marks at zero. All native annotations with `identity_affirmation` now emit Master Schema identity occurrences regardless of annotation category. Character Timeline resolves mature labels through governed profile aliases and counts only nodes with real source-time evidence. Untimed profiles seed a row but contribute zero marks. The current Safin evidence is user-confirmed Source Media metadata and untimed Scene Card evidence; no source-timed Safin manual annotation exists in the active correction record, so the truthful timeline state is a Safin row with zero occurrence marks until a source occurrence is confirmed.

Open Transcript, Objects, OCR, Expressions, Master Schema, Scene Cards, POS, Quant, StatsKit, Narrative Agent, Maturation, Source Media, and Tools in turn. In each panel wait three seconds, scroll once, open one dropdown, close it, and return to Video.

Pass when every panel retains the same analysis, disclosures begin collapsed unless primary, no duplicated dropdowns appear, Tools retains all categories, no loud widget wall returns, the console stays clean, and video seeking remains responsive.

## Push gate

Push only when Tests 4–12 pass or every exception is documented and consciously deferred. UI regression acceptance does not by itself prove the new governed reporting API because its report builder and complete report-to-source traceback are not yet exposed as a UI leaf.
