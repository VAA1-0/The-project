# Bug Report: Project Data Mixup and Restored Annotations Hidden by Incomplete Hydration

Date: 2026-08-31

Severity: High / project-integrity and analyst-trust failure

Status: Recurred on 2026-09-07; targeted BBox recovery verified; canonical profile and import-lineage mitigation remain required

## Executive summary

After Datascene was restarted and an earlier Bond, COP30 and Helsinki project bundle was reopened, records from that project and the seven-video Marcella research project appeared in one undifferentiated project surface. Some restored sources initially had no playable preview, and large parts of their user annotation work appeared to be missing.

Two related persistence-boundary defects caused the incident:

1. Project membership was not propagated consistently during saved-work import, while a short catalogue request timeout allowed the frontend to silently replace the governed backend catalogue with a partial local fallback.
2. Restored annotation ledgers were stored under the imported-work path, but the foreground annotation route checked only the current-run `outputs/api_results/<analysis-id>` sidecar. The resulting `404` made preserved annotations appear absent.

The annotation incident was primarily an **apparent loss caused by incomplete hydration**, not deletion. The richer imported ledgers remained on disk. However, because a sparse UI state could have been saved before the richer ledger was loaded, the defect also created a credible overwrite risk.

## User-visible impact

- Marcella videos surfaced together with Bond, Brazil and Helsinki records instead of remaining a distinct project.
- Previously saved project videos did not initially surface under their intended project identity.
- Restored video previews appeared unavailable even though the source MP4 files existed.
- Annotation panels appeared empty or substantially incomplete.
- Users had no project-integrity or annotation-integrity diagnostic inside Datascene.
- Recovery depended on inspecting files and routes outside the program interface.
- An analyst could reasonably conclude that mature work had been lost and could accidentally save a sparse projection over a richer ledger.

## Preserved evidence recovered

Live verification after correcting hydration found:

| Restored source | Manual visual annotations | Label overrides | Text corrections |
|---|---:|---:|---:|
| No Time to Die trailer | 99 | 12 | 1 |
| Diamonds Are Forever trailer | 11 | 6 | 5 |
| Brazil complete | 18 | 41 | 0 |
| Helsinki working checkpoint | 23 | 1 | 6 |

The seven Marcella analyses also retained their correction sidecars. The available `english_brazil_short` imported material contained no annotation correction ledger, so no recovery claim is made for that source.

After project repair, the governed catalogue contained two distinct cohorts:

- `bond-cop30-helsinki`: 5 analyses
- `research-test-2026`: 7 Marcella analyses

## Root cause A: project membership mixup

The saved-work import boundary did not consistently carry an explicit `project_id` into each registered analysis. Records could therefore receive a generic/default project identity rather than the identity of the project being reopened.

At the same time, the frontend allowed only two seconds for the governed catalogue request. When that request did not finish within the threshold, the interface silently substituted locally visible analyses. That fallback contained the Marcella records and concealed the distinction between a backend catalogue failure and a legitimate project selection.

The resulting interface was syntactically populated but semantically wrong: it showed analyses without proving their project provenance.

## Root cause B: annotation ledgers were not fully hydrated

Datascene has several representations of user corrections:

- the lightweight `annotation_corrections.json` sidecar;
- an embedded projection in `analysis_record.json`;
- a Master Schema review-layer projection;
- imported bundle artifacts under `outputs/imported_work`.

For restored projects, `analysis_record.output_files.annotation_corrections` correctly referenced the imported sidecar. The special frontend annotation route nevertheless tried only:

`outputs/api_results/<analysis-id>/annotation_corrections.json`

When that current-run file did not exist, the route returned `404` instead of following the recorded artifact path or using the embedded correction payload. Other artifact routes had the same current-run-path precedence problem, which also explained the initially unavailable source preview and misleading expression state.

The correction ledger therefore existed but was not projected into the active panel state.

### Additional restored-artifact registration defect

The subsequent forensic audit found that the legacy bundle importer registered core CSV and media artifacts but omitted several valid suffixes from its artifact map. Master Schema, Scene Cards, meaning-network, proliferation, diarization, identity-triangulation and related JSON files remained physically present under imported work without being registered in `analysis_record.output_files`.

This produced a second apparent-loss mode: Datascene could generate a sparse current-run projection while a richer restored artifact remained unaddressed. For example, the restored Diamonds bundle contained Scene Cards and a populated Master Schema, while the initially generated active projection exposed zero restored review annotations. The varying mix of registered, regenerated and unregistered artifacts made the visible detection counts appear erratic.

### Concrete temporal-label discrepancy: Aston Martin

**Correction added 2026-09-07:** the earlier search missed a separate saved analysis edition of the same source. The July 29 bundle contains “Old Aston Martini James Bonds Car” at `3.0–4.1` seconds. This annotation has now been recovered and its rendering verified at `3.583` seconds. See the September 7 incident and prevention proposal below.

At the August 31 investigation, the analyst expected the visible car at `00:03.083` to carry the earlier annotation “Bond’s car, Old Aston Martin.” The then-active No Time to Die correction ledger contained only:

- `Car` with role `Aston Martini` at `00:05.750`; and
- `Car` with identity `New Aston Martini` at `00:42.500`.

Neither of those two annotations was temporally active at `00:03.083`. The earlier conclusion that no saved `Old Aston` wording could be recovered was incorrect: the search had not reconciled the separate `0b16df1c` edition. A distinct “Bond´s car” annotation also survives in the Diamonds Are Forever project, including an interval from `00:02.023` to `00:03.802`; it remains separate and was not used in this recovery.

This example demonstrates that matching ledger counts is insufficient. Restart validation must compare annotation semantic values, source media identity, target track and governed time interval—not merely whether a Native row exists somewhere in the project.

## Full missing-data scan

A subsequent read-only integrity scan covered all 12 active analyses, their physical artifacts, registered output paths, JSON parseability, transcript timing coverage, backend summaries, backend download routes and frontend hydration routes.

Detailed audit: [Datascene Full Project Integrity Scan](./datascene_full_project_integrity_scan_2026-08-31.md)

### Cohort-level result

- All seven Marcella analyses report the current 15/15 required branches.
- All 12 source-video paths exist.
- All 12 transcript artifacts exist and parse.
- Every transcript segment in the audited files has source timing.
- All five restored analyses report gaps, but their missing-branch lists contain both genuine absences and false negatives caused by incomplete status hydration.

### Transcript false negatives

The restored transcript artifacts are materially present:

| Restored analysis | Transcript segments | Timed segments | Frontend route |
|---|---:|---:|---:|
| No Time to Die | 47 | 47 | HTTP 200 |
| Diamonds Are Forever | 57 | 57 | HTTP 200 |
| Brazil complete | 62 | 62 | HTTP 200 |
| Helsinki checkpoint | 2 | 2 | HTTP 200 |
| English Brazil short | 2 | 2 | HTTP 200 |

The backend bounded summaries nevertheless reported `audio_segments: 0` for these restored analyses and identified transcript branches as missing. This is a status/projection defect, not transcript deletion.

### Genuinely absent modern branches

The restored bundles are not equally complete under the current Science-scan contract:

- **No Time to Die:** audio-event intervals are absent. Other reported transcript, OCR and expression gaps are false negatives; modern visual/statistical artifacts are available through the frontend route.
- **Diamonds Are Forever:** audio-event intervals, shot boundaries, spatial tone, adaptive visual scan and native statistical interpretation are absent.
- **Brazil complete:** audio-event intervals, shot boundaries, spatial tone, adaptive visual scan and native statistical interpretation are absent.
- **Helsinki checkpoint:** audio-event intervals, diarization, audio sample clouds, tracked-object output, shot boundaries, spatial tone, adaptive visual scan, native statistical interpretation and Scene Cards are absent. YOLO detections remain present.
- **English Brazil short:** linked transcript, audio prosody, audio-event intervals, diarization, audio sample clouds, tracked-object output, modern visual/statistical branches, annotation corrections, Scene Cards and richer governed interpretations are absent. This is the thinnest saved bundle.

### Consumer-dependent availability

Some advanced restored artifacts returned HTTP 400 through the backend download route while the frontend-local route returned the same artifact successfully. Artifact availability therefore depended on which consumer requested it. A saved project could appear complete in one panel and empty in another despite referencing the same analysis.

### Incorrect completeness language

The Project panel displayed `Saved analysis · full profile` for restored bundles that do not satisfy the current full-analysis contract. Datascene must reserve `full profile` for a verified contract and distinguish:

- `current contract verified`;
- `legacy complete`;
- `partially restored`;
- `available but not registered`;
- `available but not projected`;
- `missing from saved bundle`;
- `failed or corrupt`.

### Required in-program integrity scan

The Project panel must provide **Integrity Scan** and **Export integrity report** actions. For every analysis and modality, the scan must disclose:

- physical presence and parseability;
- registration state;
- projection/hydration state;
- row, segment or sample count;
- source-time coverage;
- authority, import origin and content hash;
- consuming panels;
- whether repair means registering an existing artifact, refreshing a projection or running new computation.

The repair choices must remain separate. **Register existing artifact** must never recompute it; **Refresh projection** must preserve the source artifact and user correction ledger; **Run missing analysis branch** must identify the computation, estimated cost and resulting authority.

## Immediate corrections delivered

These describe the earlier containment measures, not the final authority model. Entry count and document timestamps cannot establish maturity or completeness across divergent saved editions. The September 7 proposal below replaces richest-copy selection with a versioned canonical profile and explicit lineage reconciliation.

1. Saved-work import now propagates an explicit project ID into the registered analysis.
2. The project panel groups records by governed project identity and assigns stable project labels.
3. The catalogue timeout was raised to a realistic threshold so a momentarily slow governed catalogue is not silently replaced by a partial local view.
4. Restored artifact routing now falls back to `analysis_record.output_files` when the current-run canonical guess does not exist.
5. Annotation hydration now considers:
   - the current canonical sidecar;
   - the imported sidecar referenced by the analysis record;
   - the correction payload embedded in the analysis record.
6. Datascene selects the most mature available ledger by correction-entry count rather than allowing an empty or sparse representation to win by location alone.
7. The first post-restore annotation save merges onto the richest persisted ledger. A missing UI projection can no longer initialize an empty current-run sidecar and displace richer imported work.
8. Backend saved-analysis hydration applies the same richer-ledger rule.
9. The legacy artifact map now registers the omitted governed artifacts.
10. Existing restored records recover omitted artifact paths non-destructively from their imported-work directory; source bundle files are not moved or rewritten.
11. The Master Schema response overlays the richest correction ledger and safely aliases the imported source analysis ID to the active restored analysis ID, preventing legitimate same-source evidence from being filtered as cross-video data.

## Required in-program mitigation

Filesystem inspection must not be part of the normal recovery procedure. Datascene needs the following visible controls.

### 1. Project integrity surface

Every project header must show:

- project name and stable project ID;
- analysis count;
- source count and unavailable-source count;
- import origin and import time;
- whether the view is governed, cached or fallback;
- a visible warning when records have no project ID or conflicting project claims.

Provide **Inspect project integrity** and **Repair project membership** actions. Repair must preview all proposed moves and require confirmation; it must never infer membership solely from the currently open panel.

### 2. Saved-project reopen workflow

Provide a first-class **Open saved project** workflow that:

1. validates the project manifest;
2. inventories analyses, source media, annotations and derived artifacts;
3. reports missing, duplicate and conflicting artifacts before import;
4. asks the analyst to confirm the target project;
5. imports atomically or leaves the prior catalogue unchanged;
6. produces an on-screen, downloadable import report.

The interface must distinguish `project opened`, `project partially recovered` and `local fallback shown`.

### 3. Annotation integrity badge

Each analysis row and annotation-capable panel must show a compact integrity badge such as:

`Annotations: 99 visual · 12 labels · hydrated from imported ledger`

The badge must name the active authority and expose **Compare annotation sources**. That comparison should list counts, timestamps and content hashes for canonical, imported, embedded and Master Schema projections.

### 4. Safe annotation recovery action

Provide **Recover annotations** when a richer inactive ledger exists. The action must:

- show the current and proposed counts;
- preserve both revisions;
- merge by stable annotation ID where possible;
- flag conflicts instead of resolving them silently;
- write an immutable recovery event;
- refresh every consumer panel after commit;
- support undo through a recorded revision, not destructive replacement.

### 5. Save guard against sparse hydration

Before accepting a user save, Datascene must compare the submitted base revision with the richest persisted ledger. If the UI was hydrated from an empty or older projection, saving must stop with a clear conflict message and offer reload/merge. Empty arrays must never mean deletion; deletion requires an explicit tombstone operation.

### 6. Restart-readiness dashboard

Project export and shutdown surfaces should report whether the project can be reopened completely:

- source media retrievable;
- correction ledgers included;
- project IDs consistent;
- manifests valid;
- mutable ledgers flushed and read back;
- artifact paths portable or included in the bundle.

The user should be able to run **Verify restart readiness** and receive a green, amber or red result with actionable repairs.

## Release-blocking acceptance tests

1. Import two projects containing overlapping dates and similar filenames; each remains in its original project after reload and full service restart.
2. Delay the backend catalogue beyond two seconds; the UI reports loading/degraded state and never silently substitutes a partial project catalogue.
3. Reopen a bundle whose correction sidecar exists only under imported work; all annotation counts and rows surface without manual filesystem action.
4. Present an empty embedded correction payload beside a richer imported sidecar; the richer ledger wins.
5. Present a newer canonical ledger and an older but larger imported ledger; Datascene reports the conflict and does not silently discard either revision.
6. Attempt to save from a stale empty panel; the save is blocked or merged without losing any persisted annotation.
7. Restart backend and frontend; project membership, source preview, expression sampling state and annotations remain identical.
8. Export and reopen the project on a clean Datascene installation; the in-program integrity report matches the pre-export counts and hashes.
9. Explicitly delete an annotation; a tombstone, author, time, prior value and parent revision remain available in traceback.
10. Verify every panel consuming annotations refreshes from the same canonical decision after recovery.
11. For a known timed annotation fixture, verify exact label, role/identity wording, source analysis, target track, geometry and interval before and after export/restart.
12. If a semantically related annotation survives outside the current time or in another project, show it as a recovery candidate with its provenance; never silently apply it across time or media.
13. Open every restored transcript and verify the panel segment count equals the dedicated transcript artifact count even when the bounded status record contains no inline transcript.
14. Compare backend and frontend availability for every registered artifact; the same artifact must not be available to one governed consumer and unavailable to another.
15. A project labelled `full profile` must pass the current required-branch contract; legacy or partial bundles must display their actual compatibility state.

## Prevention rule

Project identity and user annotation authority must cross import, restart and projection boundaries explicitly. Datascene may cache or mirror them, but it must never infer project membership from whichever records happen to load, and it must never treat a missing projection as evidence that a richer user ledger is empty.

## Read-boundary remediation and verification — 31 August 2026

Datascene now treats an intact persisted artifact as available even when an
older imported analysis lacks newer projection/parity receipts. The status
summary reads canonical artifact row counts instead of relying only on the
sparse runtime record, and reports physical absence separately from an
available artifact that still needs projection verification.

The backend download registry now exposes shot boundaries, spatial tone,
adaptive visual measurements, Native Statistical Interpretation, and the live
mature-data proliferation audit. The Master Schema response also receives the
same richest annotation-correction overlay and active analysis identifier as
the browser-local recovery route.

Live browser-route verification returned HTTP 200 and these transcript segment
counts: No Time to Die 47, Diamonds Are Forever 57, Brazil complete 62,
Helsinki checkpoint 2, and English Brazil short 2. For No Time to Die, the same
read boundary also surfaced 176 tracked objects, 75 OCR detections, 161
expression samples, corrections, Master Schema, Scene Cards, shot boundaries,
spatial tone, adaptive visual measurements, and Native Statistical
Interpretation. Remaining items reported as physically missing are genuine
artifact gaps documented in the integrity scan; they are not silently replaced
or fabricated.

## Startup and restored-project incident — 1 September 2026

### Incident summary

Starting Datascene, reopening the two research cohorts, restoring the governed
transcript clock, checking artifact availability, repairing browser hydration,
and completing the browser regression suite took approximately **two hours**.
Although the final controlled run passed, new user-visible failures appeared at
several stages. This is not an acceptable normal startup condition. A successful
service launch must not require source-code inspection, filesystem archaeology,
manual route comparisons or repeated Playwright triage.

The final verified state was:

- backend running from the documented `vaa1_core` environment;
- frontend running on `127.0.0.1:3001`;
- five Bond/COP30/Helsinki analyses in `bond-cop30-helsinki`;
- seven Marcella analyses in the separate `research-test-2026` project;
- all five restored source videos retrievable;
- the selected Bond analysis exposing the tested governed artifacts;
- the authoritative raw Whisper transcript clock restored and propagated to
  transcript-dependent data;
- the complete Playwright suite passing 12/12 at the end of the startup audit;
- a subsequent OCR-specific regression passing after the OCR panel defect was
  discovered and corrected.

Passing at the end does not reduce the severity of the incident. The defects
below arose during an ordinary restart/reopen workflow and directly threatened
the visibility, timing, ownership or apparent existence of research data.

### Acknowledged issues by date

| Date | Acknowledged issue | User-visible consequence | Immediate disposition | Fundamental status |
|---|---|---|---|---|
| 2026-08-31 | Restored project membership was incompletely propagated and fallback catalogue behavior mixed cohorts. | Marcella and Bond/COP30/Helsinki material appeared in the same project surface. | Explicit project grouping and restored ownership were added. | Release-blocking until restart and cross-machine tests prove stable ownership. |
| 2026-08-31 | Imported annotation and governed-artifact paths were not consistently hydrated. | Preserved corrections, previews, transcripts, expressions and other panels appeared missing or erratic. | Richest-ledger and recorded-artifact fallback rules were added. | Release-blocking until every consumer uses the same artifact registry and authority. |
| 2026-08-31 | Completeness summaries could describe physically present artifacts as missing, while `full profile` could describe legacy partial bundles. | Analysts could not distinguish absent data from unregistered or unprojected data. | Read-boundary and inventory corrections were added. | Open: the interface still needs the full integrity and restart-readiness workflow specified above. |
| 2026-09-01 | The documented backend cold start took roughly 90–120 seconds and emitted no useful readiness progress while scientific imports and caches initialized. The overall recovery and validation session took about two hours. | The interface could look frozen or unavailable, encouraging duplicate starts and improvised recovery actions. | Backend and frontend were started separately according to the runbook and kept under observation. | Open: startup must expose deterministic stages, readiness, elapsed time, dependency checks and actionable failure states. |
| 2026-09-01 | The launcher path buffered backend output during startup. Matplotlib/Ultralytics cache creation and heavy imports further obscured progress. | A valid startup was difficult to distinguish from a hung process. | The documented direct `conda run --no-capture-output` fallback was used. | Open: make the canonical launcher stream logs and preflight writable cache directories. |
| 2026-09-01 | The bounded catalogue endpoint could take around 26 seconds because large restored records were involved in catalogue work. Search used a shorter wait and initially reported zero analyses. | Datascene Search appeared empty even though 12 analyses were present. | Browser bootstrap now uses a bounded local catalogue immediately; Search regression passes. | Open: the backend must maintain a first-class lightweight catalogue and must never derive catalogue identity by hydrating analysis payloads. |
| 2026-09-01 | Legacy `analysis_record.json` files are approximately 8–76 MB, and `project_id` may occur many megabytes into the record. Prefix-only reading therefore lost ownership for some analyses. | Some Bond and all Marcella records fell into `local research project` despite correct ownership in the governed backend. | Added `catalogue_index.json`; persistence now updates the lightweight ownership index. | Open: migrate all records to independently versioned catalogue metadata and verify index/record agreement transactionally. |
| 2026-09-01 | The restored No Time to Die transcript initially selected a scaffold/legacy representation instead of the preserved raw Whisper timing artifact. | Spoken lines surfaced on an incorrect clock and dependent panels could disagree about time. | Raw Whisper is now preferred when source fingerprints agree; 35 authoritative segments beginning at 6.280 seconds were restored. | Release-blocking: transcript selection must be deterministic, provenance-bearing and tested for every import/restart. |
| 2026-09-01 | Transcript-dependent outputs retained stale timing after the authoritative transcript was restored. | Linked transcript, prosody, diarization, POS, Quant and time-bank consumers could point to different moments. | Dependents are rebuilt against the operational transcript clock and now carry timing authority. | Release-blocking: all time-based data must share and validate one master clock before panels become reviewable. |
| 2026-09-01 | Backend and browser-local artifact routes could differ in latency and previously differed in availability. | A panel could be empty although its artifact existed and another consumer could retrieve it. | The restored Bond artifact matrix was checked through governed browser routes; required artifacts were non-empty. | Open: add automated route-parity checks for every artifact and every analysis at startup. |
| 2026-09-01 | The OCR panel initialized with an empty analysis ID and ignored the workspace analysis passed in component state, relying on a later transient `videoIdChanged` event. | The video badge showed 71 OCR detections while the OCR panel showed `0 surfaced / 0 raw`. | OCR now accepts and reacts to the workspace `videoId`; a Bond OCR Playwright regression verifies 71 raw rows and visible entries. | Fundamental panel-lifecycle defect: audit every panel for the same missed-event pattern. |
| 2026-09-01 | Some restored legacy analyses still lack newer optional branches such as spatial tone, adaptive visual scan or Native Statistical Interpretation. Requests for absent optional artifacts produced 404 responses during panel loading. | Panels may look broken instead of explicitly explaining legacy incompatibility or offering a governed repair. | Genuine gaps remain distinguished from restored artifacts. | Open: panels must render typed `not produced`, `legacy unavailable`, `repair available` and `load failed` states. |
| 2026-09-01 | `pyannote.audio` is not installed in the running environment. | Existing diarization artifacts surface, but newly computed diarization would be limited. | Limitation was reported after startup. | Open: dependency preflight must block or explicitly downgrade diarization before analysis starts. |
| 2026-09-01 | Existing browser tests contained stale fixture counts and a removed analysis identifier. | Initial Playwright runs failed for reasons unrelated to current data integrity, prolonging diagnosis and obscuring real regressions. | Fixtures now use the active 12-analysis catalogue and restored Bond ID; the suite passes. | Open: fixtures need stable seeded manifests and must not depend on mutable workstation identifiers. |
| 2026-09-01 | Project separation was implemented as grouped display rather than an active-project loading boundary. Both projects remained open when the analyst requested only Bond/COP30/Helsinki. | Unrequested Marcella records remained in the workspace catalogue and could create avoidable browser memory, cache and cross-project dependency risk. | Added an explicit `activeProject` scope; the scoped catalogue loads only the five requested analyses while preserving Marcella unopened. | Open: expose active-project selection, close/switch controls and memory/cache telemetry directly in the Project interface. |

### Consolidated root-cause pattern

The failures share one architectural weakness: Datascene still allows large
analysis records, imported artifacts, browser-local fallbacks, backend status
projections and individual panels to act as competing discovery authorities.
The program can eventually reconcile them, but reconciliation occurs too late
and too invisibly. A user may first see an empty project, an empty panel, a
mis-timed transcript or a false missing-data warning before the richer authority
is found.

The required rule is stronger than “data exists somewhere.” Before a saved
analysis becomes interactive, Datascene must prove:

1. project ownership;
2. source-media availability;
3. canonical artifact path and content hash per branch;
4. correction-ledger authority and revision;
5. operational master clock and timing provenance;
6. projection and consumer parity;
7. explicit status for genuinely absent legacy branches.

Only after that preflight may panels claim that the project is ready for review.

### Prompt mitigation required

1. **One startup command and visible readiness contract.** Start and supervise
   backend and frontend, stream startup stages, verify ports and dependencies,
   and publish one `ready`, `degraded` or `blocked` state.
2. **First-class catalogue store.** Keep small, versioned project/analysis
   records separate from analytical payloads. Update them atomically on import,
   save, project move and deletion.
3. **Project reopen preflight.** Verify cohort membership, source videos,
   correction ledgers, artifact inventory, hashes and clock authority before
   displaying the project as usable.
4. **Universal panel hydration contract.** Every panel must accept the current
   analysis through component state, subscribe to later changes, and fetch data
   through the same artifact registry. No panel may depend solely on having
   observed a past event.
5. **Consumer parity matrix.** Automatically exercise backend download,
   browser-local recovery and panel parsing for every registered artifact.
6. **Master-clock gate.** Reject scaffold timing when authoritative source
   timing exists. Rebuild or invalidate every dependent projection when the
   operational clock changes.
7. **Typed legacy and failure states.** Replace empty panels with precise states
   that distinguish zero observations, missing artifact, unregistered artifact,
   unsupported legacy branch, loading timeout and parse failure.
8. **Stable browser fixtures.** Seed tests from a versioned catalogue manifest;
   validate project separation, previews, panel hydration and row counts without
   workstation-specific identifiers.
9. **Restart-readiness evidence in the UI.** Surface the last successful
   preflight, test time, artifact counts, unresolved warnings and downloadable
   integrity report at project level.
10. **Performance budget.** Define and enforce startup, catalogue, selected
    analysis and panel-hydration budgets. A catalogue must surface in seconds,
    while deeper hydration proceeds visibly and cannot erase already proven
    metadata.

### Additional release-blocking acceptance tests from the 1 September incident

16. Start from a cold scientific cache and verify that startup stages and
    readiness remain visible; issuing the start action twice must not create
    competing services.
17. List projects without parsing any full `analysis_record.json`; five restored
    Bond/COP30/Helsinki and seven Marcella analyses must surface in their correct
    cohorts within the catalogue performance budget.
18. Remove or corrupt the lightweight catalogue index; Datascene must report a
    catalogue-integrity failure and offer governed rebuild, not group records
    silently under a generic project.
19. Open Search during backend hydration; all catalogue records must remain
    visible and the panel must distinguish catalogue availability from deep
    search-index hydration.
20. Reopen the Bond transcript with raw Whisper, scaffold and linked variants
    present; the source-timed authority must win deterministically and all
    dependent clocks must agree.
21. Select a video before opening every analysis panel. Each panel must receive
    the current analysis immediately and surface its available data without
    requiring a second selection event.
22. For the restored Bond OCR fixture, the video badge and OCR panel must agree
    on 71 raw detections, with representative entries visible and navigable.
23. Run route-parity checks for all registered artifacts. Backend, local recovery
    and panel consumers must either return the same artifact or the same typed
    unavailability reason.
24. Run the full Playwright suite from the documented startup command on a clean
    restart. No fixture may depend on a mutable analysis ID unless that ID is
    declared in the seeded project manifest.
25. If an optional dependency such as `pyannote.audio` is missing, analysis must
    be visibly downgraded or blocked before work begins; it must not silently
    produce a weaker result under a full-profile label.
26. Open Datascene with `bond-cop30-helsinki` as the active project. Exactly five
    analyses may enter the workspace catalogue; no Marcella analysis may be
    hydrated, cached or shown until the analyst explicitly switches projects.

### Severity and closure condition

This incident remains **High severity** because apparent data loss, project
mixing, timing disagreement and empty analytical panels undermine the evidential
trust required for research use. The report must not be closed merely because
the current workstation now passes its tests. Closure requires the in-program
preflight and recovery controls, stable performance budgets, consumer parity,
and the release-blocking acceptance tests above to pass on a clean restart and a
portable saved-project reopen.

## Missing BBox corrections across saved editions — 7 September 2026

### Finding and verified recovery

After opening only `bond-cop30-helsinki`, the analyst reported missing updated BBoxes in No Time to Die. The active analysis `8183c1fd-7cb9-49d0-b20c-378399e9c41f` hydrated 99 manual annotations and 12 label overrides, including August/September edits. Those counts concealed a separate annotation history:

- `docs/NO_TIME_TO_DIE_Trailer_UK_-_James_Bond_007_720p_h264_7_analysis_bundle.zip` contains a May edition with 19 manual annotations.
- `outputs/api_results/0b16df1c-bc47-4b24-b90f-4d34e53c68e4_bundle.zip` contains the July 29 edition with 64 manual annotations, including later BBox work absent from the active ledger.
- The active ledger retained the earlier `f287a423` lineage and newer edits to that lineage. The July edition used `0b16df1c` annotation IDs. Reading the active sidecar, embedded payload and registered import path did not discover this additional edition.

Source video, tracked-object and OCR artifacts in the July bundle were byte-for-byte identical to the active artifacts. Source-video SHA-256 was `9b025baee45f793dee3b25bfb440233c8b216fef1e06cfce3951b93d6cf39c2f`. This established the source and detector compatibility required for the scoped recovery; filename similarity alone was not used as authority.

Recovery used the existing canonical local correction POST route after taking snapshots:

- Restored **61 visual annotations and one object label override**; live totals became **160 manual annotations and 13 label overrides**.
- Verified every previously active manual annotation and label override remained unchanged. Original restored IDs, analyst timestamps, intervals and geometry were retained, with recovery provenance attached.
- Verified the Master Schema review-layer corrections matched the canonical API readback.
- Verified in a browser that `Native 160` hydrated and “Old Aston Martini James Bonds Car” rendered at `3.583` seconds, within its saved `3.0–4.1` interval.
- Excluded three audio/transcript-linked annotations and five expression overrides pending validation of their different upstream timing/artifacts. No source media, raw detections or transcript timing was changed, and no analysis was rerun.

Evidence and before/after snapshots: `backups/bond-bbox-recovery-20260907/`. Detailed recovery note: [No Time to Die BBox recovery](./bbox_recovery_no_time_to_die_2026-09-07.md). Downloads could not be searched because macOS denied access even outside the sandbox; the search is not proof that every external saved edition has been discovered.

This verifies a targeted recovery and one rendered example. It does not establish complete cross-panel propagation, validate every recovered semantic claim, or close the architectural defect.

### Root cause and remaining risk

Datascene can preserve multiple annotation histories for the same source under different analysis IDs without a durable registry linking those histories. A successfully hydrated ledger can therefore be internally consistent but incomplete. A later document timestamp or a larger row count cannot prove that it contains all earlier confirmed work. In this case, the 99-row ledger lacked valuable entries from a 64-row ledger.

There are two separate problems: discovering all saved editions belonging to the intended project/source, and reconciling their decisions into one current governed profile. Repeated directory searches and merging whichever copy looks richest address neither systematically. Duplicate IDs, distinct IDs for overlapping occurrences, intentional deletions, conflicting edits and incompatible clocks must remain distinguishable.

## Proposed prevention: one versioned Master Schema profile per project source

**Design proposal, not implemented by this recovery.** Extend the existing Master Schema, canonical decision ledger and projected-state services. Do not introduce another independent authority beside them.

### Stable profile and source registration

Give each source within a project a stable `profile_id`, independent of transient analysis-run and import IDs. Register every analysis edition, imported archive and correction artifact against that profile with hashes, source fingerprint, clock/version, original IDs and parent revision. Preserve separate analysis editions and cross-project authority even when their media bytes match. A fingerprint identifies equivalent media; it does not authorize merging decisions across projects or incompatible detector versions.

Import must inspect the saved edition's manifest and correction inventory before declaring it loaded. An unregistered edition of a known source becomes a reconciliation item, not an invisible file. Legacy annotation IDs remain auditable aliases; distinct IDs are not automatically treated as either duplicates or independent truth.

### One transactional decision boundary

Use the existing canonical ledger as the durable source of analyst decisions. Each edit carries `profile_id`, stable record ID, operation ID, base revision, authority, source interval, clock reference and provenance. Append the event and advance the profile revision atomically. Acknowledge the save after durable commit; expensive derived work follows asynchronously.

Use one cross-process transaction/locking mechanism for backend and dashboard writers. A frontend process-local lock alone cannot coordinate both services. Reuse the existing persistence architecture where possible; a transactional local store is an implementation option, not a requirement to migrate everything immediately.

Reapply an operation ID idempotently. Merge independent edits from stale clients; return a specific conflict when concurrent edits affect the same governed field. Record drop, supersede, split, merge and undo explicitly, with tombstones or replacement links. Empty arrays never delete evidence, and later imports cannot resurrect a tombstoned annotation. Counts and wall-clock timestamps are diagnostic data, not conflict-resolution authority.

### One canonical read contract, many projections

Expose one logical retrieval contract, for example `GET /api/profiles/{profile_id}/resolved?revision=current`. Its bounded response identifies the committed revision, source/clock, evidence references, content hash and projection states. Large records remain paginated or loaded by artifact reference.

The current profile is a deterministic Master Schema projection of the decision ledger plus registered evidence. It retains the established authority order and distinguishes confirmed, candidate, superseded, rejected and unavailable records. Raw artifacts stay immutable and retrievable. Materialized profile snapshots are rebuildable and versioned; they are not independent authoring surfaces.

All panels, status summaries, search and exports consume this contract or projections carrying its revision. Embedded analysis payloads, imported ledgers, local browser state and generated Scene Cards cannot independently choose mature truth. A dashboard fallback must implement the same contract against the same store, not select another artifact by location or size.

### Revision-aware refresh and practical analyst feedback

After a commit, publish `profile_id`, committed revision and affected record IDs through a durable outbox/change feed. Consumers invalidate relevant caches and acknowledge their applied revision. On reconnect or panel reopening, compare revisions and catch up even if the original notification was missed. Discard late responses older than the revision already displayed.

Show a concise state such as `Saved · revision 42; Video current; Scene Cards updating`. If a projection fails, retain the saved correction, show its stale state and offer a scoped projection retry. Read requests must not perform expensive regeneration. Exports pin one immutable profile revision and verify all included projections correspond to it or explicitly declare their gaps.

### Import reconciliation and first delivery sequence

1. Add an audit-only edition registry and inventory existing saved work. Show unresolved same-source editions beside the current profile before calling it fully recovered.
2. Add stable profile IDs, revisioned commits and explicit conflict/tombstone semantics behind the current APIs, with snapshots and rollback evidence.
3. Move BBox/Video and Master Schema to the shared read contract first. Prove save, reopen and restart parity before migrating other consumers.
4. Add durable revision notifications and migrate Scene Cards, Narrative Agents, Meaning Network, search and publication one consumer at a time.
5. Replace richest-copy discovery during ordinary reads with explicit import/recovery reconciliation. Compatible non-conflicting changes may be incorporated under the established recovery policy; ambiguous record equivalence, source scope or incompatible clocks remain review items. Preserve the original edition and record every accepted reconciliation decision.

The first useful milestone is: **edit a BBox once, receive a durable revision, reopen or restart, and retrieve the same label, interval and geometry through Video and Master Schema from that revision**.

### Additional release-blocking acceptance tests

27. Seed the two No Time to Die lineages on identical media: the 99-row active ledger and the 64-row July edition. Detect the missing edition despite its smaller count; recover eligible records without replacing newer active corrections.
28. Verify the recovered Aston Martin label, interval and geometry at `3.583` seconds after save, browser reload, backend restart and portable export/import. Retain the original decision and recovery provenance.
29. Reimport the same bundle twice: no duplicate decisions, revision replay or tombstone resurrection. Flag overlapping records with different IDs where equivalence is uncertain.
30. Reject automatic reconciliation across different media/clock versions or project ownership. Changed detector IDs require a validated mapping; audio/expression incompatibilities remain explicit.
31. Save independent edits concurrently from Python and dashboard clients; both survive. Conflicting edits to the same field produce a revision conflict, and a crash cannot leave a committed event without its revision or vice versa.
32. Lose or reorder a refresh notification and reopen a panel. It must recover the current revision and reject stale responses without erasing saved state.
33. Fail a downstream projection: the correction remains durably saved, the stale consumer is named, and scoped retry restores revision parity without rerunning detection.
34. Verify Video, Master Schema, Scene Cards, Narrative Agents, Meaning Network, search and publication against the same pinned revision using semantic values, time and geometry, not row counts alone.


### Verified restart probe — 7 September 2026

The analyst added a `James Bond` BBox correction at `1:11.000–1:12.000` after recovery. Both backend and frontend were restarted with the documented macOS launcher. Readback from the backend correction API, frontend correction API and Master Schema review layer returned the exact pre-restart record, including geometry, both manual keyframes, authority and timestamps. All 161 manual annotations were unchanged.

A fresh browser loaded the five-analysis Bond/COP30/Helsinki catalogue, hydrated `Native 161`, and displayed the `James Bond` overlay at 71 seconds. The screenshot was visually inspected. An initial browser assertion scoped the label to the fullscreen control's container and timed out; inspecting the actual Video surface confirmed that the overlay was present. No application change was required.

Evidence: `backups/bond-restart-test-20260907/` contains pre-restart snapshots, the expected annotation, verification result and screenshot. This passes the scoped service-restart persistence probe. It does not verify an operating-system reboot, portable export/import, or the proposed universal revision contract.
