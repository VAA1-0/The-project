# Critical Bug Report: Systemic Meta Bleeding Across Project Boundaries

Date: 2026-10-01

Observed at: approximately 17:37 Europe/Helsinki

Severity: Critical / project-integrity, confidentiality-boundary, and analyst-trust failure

Status: Contained in the frontend selection and restoration boundaries; broader authority audit remains open

Affected workspace: `bond-cop30-helsinki`

Foreign project: `research-test-2026` (Marcella)

Confirmed foreign analysis: `c034341f-3fba-495e-a7d1-0af03a46cb6c` (`2MarcellaPhd_VBusiness BLS S20.mp4`)

## Executive summary

While the visible Datascene project remained **Bond, COP30 and Helsinki**, the active source and Scene Cards changed to a Marcella analysis. The interface simultaneously asserted one project identity and hydrated another project's source media and derived evidence.

This is classified as **systemic meta bleeding**: project metadata correctly bounded the catalogue surface, but a less visible shared state layer—global active-analysis identity—was not governed by that project boundary. A stale or restored foreign analysis ID could therefore become authoritative for Video and downstream panels without changing the project heading.

The incident was not caused by the Marcella material legitimately belonging to the Bond project. The confirmed catalogue records place the analysis in `research-test-2026`. Helping with or retaining another project does not grant it authority to enter, supersede, or populate the active research workspace.

No evidence currently shows deletion, mutation, or external exfiltration of either project's persisted data. The confirmed failure is unauthorized cross-project selection and UI hydration inside the local application. Because panels could display and potentially act on the foreign context, all evidence shown during the mixed state must be treated as untrusted until source, analysis, and project IDs agree.

## User-visible incident

The screenshot captured all of the following at once:

- the Project panel heading remained `Bond, COP30 and Helsinki project`;
- the selected Bond row remained visually present;
- Video displayed two women at a laptop from a Marcella source;
- Video duration changed to approximately `8:02.882`, inconsistent with the active Bond trailer;
- the Video surface reported `Unavailable analysis` and `Source missing`;
- Scene Cards displayed 21 cards and Marcella-derived language such as company, leader, manager, laptop, chair, and cell phone;
- the Global Clock and panel state continued operating as if this were one coherent workspace.

This combination made the contamination especially dangerous: each individual widget looked plausible, while the cross-panel identity was impossible.

## Confirmed evidence

1. The foreign analysis ID is catalogued as:
   - project: `research-test-2026`;
   - filename: `2MarcellaPhd_VBusiness BLS S20.mp4`.
2. The dashboard catalogue request was scoped to `project_id=bond-cop30-helsinki`.
3. Runtime requests nevertheless targeted `/api/local-analysis/c034341f-3fba-495e-a7d1-0af03a46cb6c/...`.
4. The active Bond analysis used during Global Clock delivery was `8183c1fd-7cb9-49d0-b20c-378399e9c41f`.
5. The foreign source appeared without the visible project heading changing to Marcella.
6. A browser acceptance test now deliberately requests the Marcella analysis through a Bond-scoped dashboard and verifies that:
   - Datascene raises a project-boundary violation;
   - the Marcella project does not surface;
   - no foreign `/api/local-analysis/<Marcella ID>` artifact request is issued.

## Failure mechanism

The catalogue boundary and the active-analysis boundary were implemented separately.

The catalogue correctly filtered records by `project_id`. However, panels also shared a global `videoIdChanged` event, and Golden Layout could restore panel props containing `videoId` or `analysisId`. Neither entry path proved that the candidate analysis belonged to the active project before making it the common context.

The effective chain was:

`stale/restored foreign analysis ID` → `unguarded global selection event or panel prop` → `active analysis overwritten` → `Video and panels hydrate by foreign ID` → `Bond heading remains unchanged`

This explains why filtering the left-hand project list was insufficient. The visible project label was descriptive metadata, while the global analysis ID remained operational authority.

### Why this is systemic meta bleeding

The defect is broader than one wrong video. Datascene contains several scopes that can carry identity:

- active project;
- active analysis/source;
- saved workspace and Golden Layout props;
- Global Clock source/revision context;
- panel-local cached analysis;
- route/query parameters;
- catalogue or fallback results.

When those scopes are allowed to resolve independently, stale state from a broader or previous context can penetrate a narrower active project. Once the foreign analysis ID enters the shared event layer, every subscribing panel can reproduce the error consistently. That consistency makes the wrong state appear authoritative.

The architectural defect is therefore an **authority inversion**: a low-context transport event was able to override a higher-level governed project boundary.

## Relation to the 2026-08-31 project mixup

The August incident involved missing project membership propagation, catalogue fallback, and incomplete restored-artifact hydration. The current incident is related but distinct:

- project membership was now present and catalogue filtering worked;
- the leak occurred after catalogue selection, through shared runtime/restored UI state;
- the visible project and operational analysis diverged.

This recurrence shows that project separation cannot be guaranteed only at import or catalogue time. It must be enforced at every identity-bearing boundary and every artifact read.

## Impact and risk

- Analysts could attribute Marcella observations to Bond/COP30/Helsinki.
- Global Clock concordance could align detections from the wrong source.
- Scene, transcript, object, expression, statistical, and meaning panels could form internally coherent but project-invalid constellations.
- User corrections might target a foreign analysis if write routes trust panel state alone.
- Reports, exports, screenshots, and research claims could silently combine incompatible evidence.
- Separate research participants or projects could be exposed across a confidentiality boundary.
- The interface provided no immediate warning before containment, undermining confidence in all surfaced evidence.

## Immediate containment implemented

1. The shared `videoIdChanged` boundary now rejects every non-empty analysis ID not proven to belong to the active project.
2. Project membership is loaded from the governed, project-filtered catalogue into an explicit frontend allowlist.
3. The rule is fail closed: before membership is known, an analysis ID cannot become active merely because it was restored or emitted.
4. Golden Layout panel props are sanitized before render; foreign `videoId` and `analysisId` values are removed.
5. If a foreign analysis was already active when membership resolves, Datascene evicts it to the canonical empty selection state.
6. A red `PROJECT BOUNDARY VIOLATION` alarm names the rejected analysis and active project.
7. The ordinary dashboard defaults to the bounded Bond/COP30/Helsinki project; only an explicit catalogue mode may aggregate projects.
8. TypeScript compilation passes.
9. The targeted browser isolation test passes and confirms zero foreign artifact hydration requests.

## Remaining systemic risks

Frontend containment is necessary but not sufficient. The following remain release-blocking audit areas:

- every backend artifact read and mutation must independently verify `(project_id, analysis_id)` membership;
- the active Global Clock ticket must include project, analysis, source, and revision identity;
- panel caches must be partitioned by project and analysis, not analysis alone where IDs may be imported or aliased;
- local storage and saved workspace formats need a project-bound schema version and invalidation rule;
- catalogue fallback must never widen scope silently;
- write operations must reject stale or foreign project context even if the frontend is compromised or defective;
- exports and reports must record one governed project identity and enumerate every included analysis;
- source aliases and imported editions must not be treated as cross-project permission;
- background prefetch and precomputation must obey the same boundary as visible panels.

## Required permanent correction

1. Define a canonical `ProjectContext` containing project ID, analysis ID, source identity, revision, and authority timestamp.
2. Replace naked analysis-ID events with project-bound context tickets.
3. Require all consumers to validate a ticket before reading, caching, rendering, navigating, correcting, or exporting evidence.
4. Enforce membership server-side on every analysis route. Client filtering is presentation logic, not a security boundary.
5. Partition or invalidate caches whenever project context changes.
6. Bind persisted layout state to a project ID and discard incompatible panel state on reopen.
7. Make project transitions explicit and atomic: panels must clear before the next project can hydrate.
8. Record boundary violations in an immutable audit stream with source, rejected target, route/event, time, and session.
9. Block all mutation controls while project, analysis, source, and clock identities disagree.
10. Add a persistent project-integrity indicator showing the currently authoritative project and analysis IDs.

## Release-blocking acceptance tests

1. Restore a layout saved while Marcella was active into a Bond URL; no Marcella media, metadata, or artifact request occurs.
2. Emit a Marcella analysis ID through every shared event path while Bond is active; each is rejected and audited.
3. Pass a Marcella ID through every panel's restored props; it is stripped before component hydration.
4. Request every read and write API with a Bond project ticket and Marcella analysis ID; each fails closed server-side.
5. Switch projects deliberately; all panels and the Global Clock clear atomically before the new source hydrates.
6. Delay project-membership loading; no unverified analysis hydrates during the race window.
7. Reopen after full frontend/backend restart; project, analysis, source, clock, and panel IDs all agree.
8. Exercise catalogue mode; aggregated browsing is permitted, but opening an analysis creates an explicit bounded project context.
9. Attempt correction, export, report generation, and traceback during an identity mismatch; all mutations/claims are blocked.
10. Verify logs contain no foreign artifact request during every negative test.
11. Run the same tests with imported aliases and duplicate filenames across projects.
12. Confirm that helping with, viewing, or retaining another project never grants it authority over the active project.

## Operational conclusion

The immediate UI penetration is contained and reproducibly blocked, but the incident should not be closed as a cosmetic frontend defect. It exposed a missing system-wide invariant:

> No analysis, source, artifact, cache entry, clock ticket, panel state, or user mutation may become active unless its project membership matches the governed active project.

M5 Global Clock delivery should resume only with this invariant continuously checked. Any disagreement must clear the affected surface, stop mutations, and raise a visible alarm rather than attempting to reconcile projects silently.

## 2026-10-07–08 recurrence: upload membership, transcript identity, and panel disparity

The COP30 workshop project exposed three related boundary defects after six new
videos were uploaded and analysed. These were not treated as cosmetic display
problems because each could change the evidence attributed to a source.

### Surfaced bugs

1. **Upload/project bleeding.** New uploads were initially persisted under
   `bond-cop30-helsinki` even though the visible project was
   `research-test-2-20226-cop30-vids`. The metadata save then returned a 403
   `PROJECT_MEMBERSHIP_MISMATCH`, leaving the analyst with an empty slate while
   the files had entered the wrong catalogue.
2. **Cross-analysis transcript association.** The authoritative-transcript
   recovery routine recursively searched the shared transcript directory. It
   ranked timing authority and filename order without first proving ownership.
   Five records therefore pointed `transcript`, `raw_whisper_transcript`, and
   `operational_transcript` at Finnish YLE1. The same defect allowed unrelated
   persisted sources, including the Bond transcript, to surface during mixed
   runtime hydration.
3. **Wrong language profile.** Svenska YLE's own automatic transcript was
   classified/transcribed as Finnish. Language selection relied too heavily on
   the whole-file Whisper hint and undifferentiated transcript text; it did not
   inspect representative locations across the source timeline. This also left
   no governed route for materially present secondary or tertiary languages.
4. **Source/panel disparity.** `SpeechToTextPanel` allowed an earlier asynchronous
   request to complete after a later video selection. A slow BBC or Bond response
   could overwrite the transcript state for a newly selected German or Swedish
   video even when the backend record was correct.
5. **Projection disparity after correction.** Svenska's regenerated audio-event
   artifact contained 15 intervals while the embedded panel projection retained
   the previous 13. The artifact existed, but completeness correctly remained
   `available_with_projection_gaps` until both representations agreed.

### Mitigation delivered

- Upload creation and metadata persistence now carry the visible project ID as
  one atomic membership context. The six affected records were reassigned only
  after backups were written; Bond retained none of them.
- Authoritative transcript candidates must now prove the analysis UUID in their
  path or payload. A timing-authoritative file owned by another analysis is
  rejected and logged rather than promoted.
- The five contaminated records were rebound to their own raw Whisper artifacts.
  Svenska was retranscribed from its own audio with Swedish constrained, then
  transcript-linked prosody, event intervals, diarization, sample clouds,
  POS/Quant, SFL/meaning, metadata, and manifests were regenerated.
- Transcript-panel loads now carry a cancellation guard. Results belonging to a
  superseded video selection cannot update the active panel.
- Transcript-dependent rebuilding now updates the persisted artifact and the
  hydrated `audio_analysis.audio_event_intervals` projection together.
- All six project analyses were passed through scoped completeness recovery.
  Live summaries subsequently reported `full`, zero missing branches, and zero
  unsurfaced branches. A search of their analysis directories found no Bond
  analysis UUID or title.

### Language/morphology correction added after the incident

Primary morphology selection now uses a deterministic, timeline-distributed
median sample: the transcript array is divided into up to nine even buckets and
the median segment plus its immediate neighbours are inspected in every bucket.
An opening greeting or first-news sentence can no longer decide the language of
the whole video by itself. A strong distributed result may override a conflicting
whole-file Whisper hint, and the disagreement remains recorded in provenance.

The same profile records language volumes across the sampled timeline. Up to
three significant volumes are routed inside the analysis as primary, secondary,
and tertiary associated morphologies. Existing analyst-selected morphology slots
remain explicit and are never silently reordered; detected languages use those
slots when configured and otherwise receive an analysis-associated route for
downstream handling.

### Residual limitation

Distributed detection and morphology routing are now implemented, but code-
switch boundaries remain bucket-level evidence rather than word-level language
identification. Short utterances below the significance threshold may remain in
the primary morphology. Word- or utterance-level multilingual tagging is a
separate accuracy enhancement and must not be represented as already delivered.
