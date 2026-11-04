# Datascene Cluster Exploration usability contract

Date: 24 October 2026

## Purpose

Datascene already contains clustering and pattern-recognition mechanisms. The
release question is whether they form a legible, economical analyst workflow.
**Mature Data Proliferation** remains the Datascene term; **governed data
aggregation** is a useful external description of the consolidation step, but
aggregation never grants mature authority by itself.

Cluster Exploration is a review mode inside existing Datascene tooling. It is
not a new panel authority, data store, matcher or competing governance regime.
It projects the existing source samples, audio/visual sample clouds,
diarization, evidence-proliferation matcher, Master Schema and
`proliferation_decisions` ledger into a more legible workbench.

Existing names remain authoritative:

- **Audio Workbench** owns audio recognition and audio sample-cloud review;
- **Data Maturation** owns cross-modal candidate and proliferation governance;
- **Mature Data Proliferation** owns confirm-once projection semantics;
- **Master Schema** owns mature canonical data;
- **Meaning Knowledge Graph** and **Narrative Agent graph** consume governed
  nodes and relation tickets; and
- **Search** surfaces existing mature data and confirmable clusters.

The phrase **cluster exploration** names the workbench mode only. It must reuse
these records and save paths rather than creating a cluster-local truth island.

This contract implements the Datascene **Cluster Exploration and Governed
Aggregation Principle**. Cluster exploration makes similarity, recurrence,
boundaries, exclusions and distribution inspectable. Governed aggregation links
the resulting evidence through canonical schema objects. Neither operation
creates maturity by itself, and neither may flatten the contributing evidence.

The governing sequence is:

`sample -> detect/measure -> quality gate -> represent -> compare -> group -> rank -> review -> govern -> aggregate -> proliferate`

The family view must explain what holds the family together, what makes it
uncertain, what is excluded, where it occurs, and what a decision will change.
This rule applies equally to visual, audio and textual evidence even though each
domain retains its own preview, metric, quality and maturity semantics.

## Current assessment

| Analyst question | Current state | Release acceptance |
| --- | --- | --- |
| Does the view immediately communicate cluster purity? | Partial. Acoustic clustering records confidence and silhouette, but there is no shared, prominent purity account across cluster types. | Show cohesion, separation, conflicting labels, quality distribution and a plain-language reliability state at the cluster header. |
| Are representative and problematic samples equally easy to inspect? | No. Samples exist, but representative, boundary, low-quality and contradictory samples are not consistently paired. | One source-navigable review strip must show best representatives and the most informative problems side by side. |
| Can a threshold adjustment be understood before commit? | No shared preview contract. | A threshold slider must preview membership gains/losses, cluster merges/splits, purity change and affected mature/candidate records without saving. Commit is a separate governed action. |
| Are merge, split and reassignment sufficiently direct? | Not across modalities. | In-panel merge, split and drag/reassign operations with undo, source anchors and append-only receipts. No panel tossing. |
| Can the analyst see temporal distribution? | Source times exist, but cluster distribution is not a standard view. | Render all members on the shared source timeline, with density, gaps, scenes and selected member synchronized to Video/Audio. |
| Is exclusion clear? | Partial. Missingness exists in several artifacts, but excluded detections are not consistently attached to the cluster account. | List every excluded sample and machine-readable reason: size, quality, missing landmarks, missing/incompatible embedding, threshold or analyst rejection. |
| Does the interface reduce hundreds of confirmations? | Not yet demonstrated. | Rank a bounded review queue, support multi-select and batch decisions, suppress already-governed duplicates and display confirmations avoided. |
| Are the best samples selected? | Partial and motor-specific. | Select representatives by quality, centroid proximity, source coverage and diversity—not arrival order or mere availability. Explain the selection. |
| Does propagation begin from a reliable cluster? | Candidate governance exists, but a common reliability gate does not. | Propagation is disabled until minimum evidence volume, purity, source quality, provenance and conflict gates pass or the analyst explicitly confirms despite a visible warning. |
| Is correction impact understandable? | Targeted invalidation exists, but cluster impact is not previewed consistently. | Before commit, show which members, probabilities, graph edges, Master Schema records and consumer panels will change, remain candidates or be invalidated. |

## Required in-panel layout

The Cluster Exploration workbench belongs inside the panel where the analyst is
working and preserves that panel's queue, filters and source position.

1. **Cluster header:** label, member count, purity/reliability, threshold,
   temporal coverage, conflict count and propagation state.
2. **Representatives and problems:** best representatives on the left; boundary,
   low-quality, contradictory and excluded samples on the right. Visual samples
   use source-linked thumbnails or crops inside the widget; audio uses waveform
   or spectrogram previews; text uses bounded excerpts; document evidence uses
   source regions. Every preview opens its exact source coordinate within the
   same workflow.
3. **Temporal distribution:** shared source-time density lane with scenes,
   speakers and confirmed/candidate states.
4. **Threshold preview:** current and proposed threshold with membership,
   purity, merge/split and downstream-impact deltas. Preview never writes.
5. **Adjustment bench:** multi-select, merge, split, reassign, replace
   representative, confirm, reject, defer and undo.
6. **Propagation receipt:** source anchors, method/model/version, settings,
   exclusions, decision authority, Master Schema write, graph edges, affected
   consumers and targeted invalidations.

The compact on-beat confirmation widget and associated consumer panels reuse
the same preview reference and decision state. A thumbnail is evidence
navigation, not decorative illustration. It must preserve the analysis id,
source revision, time/frame, coordinates, crop provenance and privacy state.
Panels must not create independent copies or ask for the same confirmation.

Model changes are append-only evidence events. Switching from YOLOv8 to DETR,
or between any later detectors or embedding motors, preserves all earlier
detections as active provider-scoped runs. The workbench projects their governed
union and exposes provider/run filters and traceback. Model changes never demote
or reopen mature Master Schema confirmations; new results can support or
contradict them only as separately traceable evidence until the analyst acts.

## Cluster families

The workbench is not limited to Narrative Agent voice or face identity. The
shared shell must accommodate, without flattening their modality-specific
evidence:

- face, person and Narrative Agent identity;
- object and object-track continuity;
- expression, micro-expression, pose, gesture and bodily movement;
- speaker, voice, prosody, sound event, music and acoustic environment;
- scene, shot, transition, setting and mise-en-scène;
- set recognition: recurring physical sets, locations, rooms, constructed
  environments, spatial layouts and set dressing;
- visual concepts: recurring motifs, symbols, iconography, colour/light regimes,
  textures, shapes, compositional patterns, spatial arrangements, visual
  metaphors and culturally interpreted imagery;
- OCR regions, transcript phrases, POS/Quant patterns and named entities;
- interaction, co-presence, dialogue and constellational participation;
- topics, themes, narrative roles, interpretive lenses and Meaning Knowledge
  relations; and
- anomalies, missingness, contradictions and quality failures.

Cluster-family selection belongs at the top of the workbench. Each family must
declare its preview kind, distance/aggregation method, quality gate, temporal or
spatial coordinate contract, and confirmation consequence. Cross-modal
constellations may reference several clusters, but they must not erase the
separate evidence and uncertainty of their contributing families.

## Empirical detection-cluster taxonomy for the current stage

The current implementation stage covers detected or measured evidence. It uses
three top-level domains and retains cross-domain links rather than forcing every
record into only one evidential role.

### Visual detections

- objects and object tracks;
- persons, faces and identity candidates;
- expressions and micro-expressions;
- pose, gesture and bodily movement;
- scenes, shots and transitions;
- sets, locations and environments;
- spatial tone: colour, light, brightness and contrast;
- adaptive visual change and motion measurements;
- OCR regions;
- visual samples and sample clouds; and
- visual-concept recurrence candidates without asserted interpretation.

### Audio detections

- speech activity and VAD intervals;
- speaker turns and diarization clusters;
- voice/speaker-profile candidates;
- prosody, delivery and turn structure;
- music, noise, silence and sound events;
- foley and recurring acoustic events;
- acoustic environments;
- audio samples and sample clouds; and
- waveform, energy, pitch and spectral measurements.

### Textual detections

- transcript segments and words;
- linked-transcript anchors;
- OCR text;
- tokens, lemmas and POS;
- Quant frequency and repetition patterns;
- named entities and references;
- speaker labels and assignments;
- language and morphology signals; and
- phrase, keyword and lexical patterns.

OCR is intentionally represented twice: the visual domain owns the source
region and geometry; the textual domain owns recognized text and linguistic
patterns. The records remain linked by one evidence identity. Likewise, a
speaker turn, its acoustic embedding and its transcript words remain distinct
but linked evidence—not one flattened cluster member.

Interpretive clusters are deferred from this taxonomy: symbolic meaning,
themes, narrative functions and roles, ideology, genre interpretation, lens
readings and significance claims. These will later consume empirical clusters
through separately reviewable Meaning Knowledge relation tickets.

## Visual-concept authority ladder

Visual concepts require their own visible authority ladder because pixel-level
similarity is not semantic equivalence:

1. **Measured visual features** — colour, luminance, texture, shape, geometry,
   composition, detected objects and source coordinates.
2. **Recurring visual pattern** — a source-linked similarity cluster produced
   by a declared method and threshold.
3. **Concept candidate** — a suggested motif or concept with supporting and
   contradictory samples; still reviewable.
4. **Analyst-confirmed visual concept** — a user-confirmed, mature Master Schema
   concept with the exact confirmed scope.
5. **Interpretive relation** — a separately reviewable claim that the concept
   signifies, symbolizes, contrasts with or develops another narrative entity.

The workbench must show thumbnails for representatives, boundary cases,
contradictions and exclusions; allow the analyst to name or rename a concept;
and distinguish visual recurrence from interpretive meaning. Confirming that a
red circular form recurs does not automatically confirm that it symbolizes
danger. The recurrence can mature independently while the symbolic relation
remains a candidate.

Useful visual-concept cluster views include contact sheets, source-time
distribution, scene/shot distribution, colour and composition summaries,
co-occurring Narrative Agents/objects, representative-versus-outlier comparison
and Meaning Knowledge relation tickets. Each view returns to the exact frame or
interval without leaving the workbench context.

## Set-recognition evidence contract

Set recognition is related to scene and visual-concept clustering but remains a
separate visual-spatial family. A **scene** is a temporal/narrative unit; a
**set** is a recurring physical or constructed environment that can span many
scenes, times and videos.

Candidate set continuity may combine:

- wide-frame and background embeddings;
- stable spatial layout and landmark geometry;
- recurring architectural features, furniture, props and set dressing;
- colour, illumination and texture distributions;
- camera viewpoint and shot-scale normalization;
- source metadata and analyst-confirmed location names; and
- negative evidence such as incompatible geometry or mutually exclusive
  location metadata.

The workbench must provide representative wide frames, layout-bearing frames,
boundary cases, false friends and excluded samples. It must show the set across
source time, scenes and project videos, while preserving each artifact's private
hermeneutic space.

Set confirmation matures only the confirmed set identity and scope. It may
generate candidates for associated scene setting, Narrative Agent presence,
objects and visual concepts, but it must not automatically confirm those
relations. One common prop, colour palette or close-up is insufficient evidence
for set identity. Merge, split and reassignment remain governed analyst actions.

## Cluster formation sequence

The shared explanation follows: sampling; detection; size/quality filtering;
landmarks or explicit not-applicable state; embeddings; cosine-distance
clustering; adjustable thresholds; ranking; representative selection; and human
cluster adjustment.

## Reliability and propagation rule

A cluster may produce constellational candidates automatically. It may not
proliferate an interpretive identity as mature merely because samples are close.
The header must distinguish `exploratory`, `reviewable`, `reliable candidate`,
`user confirmed`, `conflicted` and `invalidated`. A user confirmation is mature
authority for the confirmed cluster decision; associated unconfirmed samples
receive recalculated probabilities and review state, not silent confirmation.

## Delivered foundation and honest boundary

`vaa1.constellational_cluster_exploration.v1` provides the modality-neutral
backend foundation for size/quality exclusion, normalized embeddings,
cosine-distance grouping, explainable member ranking, representative selection
and append-only decisions. Audio Workbench is the first bounded operational
projection: it presents Master-Schema-governed Narrative Agent families and
source-linked candidates while keeping technical diarization labels internal.

Confirming a Narrative Agent emits an exact source-timed mature anchor and a
traceable governed decision. In analyst-facing language this action is
**Confirm Narrative Agent**; identity is only an internal Master Schema
relation. Manual rendered
acceptance must still verify save/reopen and parity in Data Maturation, Master
Schema, Meaning Knowledge Graph and Narrative Agent graph consumers before this
pattern is generalized to every cluster family.

### Visual Narrative Agent lineup slice

The existing Narrative Agent panel now also owns a compact, source-linked visual
lineup. It compares the same candidate occurrence across the available Narrative
Agent families, de-duplicates requests by stable evidence identity, and shows
several family rows at once. The analyst can inspect a crop at its exact source
time, select several candidates, or drag a misplaced candidate into another
Narrative Agent row before one governed batch confirmation.

A candidate whose leading family does not exceed the next family by the declared
ambiguity margin remains in **Unresolved / competing**. It cannot be confirmed
there. This is deliberate: existing person/BBox and constellational evidence must
not be presented as biometric face recognition when it does not discriminate the
families. Dragging is a staged correction and writes nothing until confirmation.

Confirmation creates one mature Master Schema decision per stable evidence
occurrence, preserves the raw detector geometry and previous expected family,
and adds the visual sample to shared Narrative Agent memory. Only then do compact
time-bound thumbnails hydrate the Narrative Agent graph, Meaning Knowledge
Graph, Audio and Transcript consumers. Candidate thumbnails never proliferate
as mature projections.

The measured motor is now **OpenCV YuNet + SFace**. YuNet supplies a face box and
five landmarks; SFace supplies a 128-dimensional local embedding. Family
centroids are calculated only from mature Narrative Agent visual anchors.
Candidates are ranked by cosine similarity and must clear both the declared
similarity threshold and the competing-family margin. Cosine similarity is
displayed as a measurement and is never relabelled as a calibrated probability.

Model selection is available in Analysis Setup and the working Tools panel with
licence, literature, runtime readiness and an explicit installation command.
Weights are checksum-verified and never downloaded implicitly during analysis.
Embedding vectors remain in a local sidecar and are withheld from export by
default; the UI receives landmarks, hashes, dimensions, scores and exclusions.

The 24 October No Time To Die acceptance run used 7 measurable James Bond seeds
and 3 measurable Nomi seeds. Of 60 person detections, 23 contained measurable
faces and 12 cleared both gates; 37 remained explicitly excluded because no face
could be measured. This establishes operational discrimination for the bounded
corpus. Mixed-corpus calibration, demographic performance assessment and wider
release qualification remain required before claiming general recognition
accuracy.

## Delivered empirical taxonomy surface

Data Maturation now renders the shared Visual / Audio / Textual taxonomy against
the active artifact. Every family reports its actual evidence count, substrate,
preview form and owning existing panel. A family with no registered evidence is
shown as `not available` and cannot be opened as though it were operational.
Interpretive families remain visibly deferred.

### Shared empirical-family workbench rollout

All 29 empirical detection families now open the same in-panel structural
workbench from Data Maturation. The workbench operates on the active analysis'
actual registered records and provides family counts, inclusion and exclusion,
cohesion/purity state, source-time coverage, a nearest-competitor limitation,
representative and boundary samples, temporal distribution, a non-writing
threshold preview, multi-selection, semantic reassignment, and governed batch
confirm/defer/exclude decisions. Each sample retains source return and a
canonical correction receipt. Confirmed decisions route to Master Schema and
the owning modality consumers; Narrative Agent consumers are included only for
Narrative Agent-relevant families.

This is a structural rollout, not a claim that every category has a calibrated
matcher. Empty families remain openable and explicitly report that no registered
evidence exists; they never manufacture samples. Categories without embeddings,
quality measures, or a competing-family model say `not measured` or `category
matcher not registered`. A generic bounded `/clusters/explore` backend route is
available for families that do supply compatible measured embeddings. Threshold
preview never writes. Merge, split, committed threshold changes, category model
calibration and rollback lineage remain category-mitigation work.

### Governed object-family lineup slice

The existing Objects panel now owns compact semantic object-family rows built
from the active analysis' tracked, non-person detections. Each row displays real
analysis-bound source crops, representative and boundary tracks, mature counts,
detector-confidence cohesion, temporal coverage, a non-writing threshold
preview and explicit missing embedding discrimination. Person tracks remain in
Narrative Agent governance and are not repackaged as object identity.

The analyst may select several crops, drag a crop to another family, type a new
semantic family, confirm a family, reassign selected tracks, split a proper
subset into a new family, or merge one whole family into an existing family.
Drag and threshold operations are staged and do not write. A governed commit
writes one mature `OBJ` annotation per source track and one cluster-level
lineage receipt. The receipt preserves the operation, source and target
families, member track ids, source times and BBoxes. Raw detector classes remain
traceback provenance and never replace the confirmed semantic family.

Confirmed object families hydrate Master Schema, Objects, Video, Scene Cards,
Meaning Knowledge, Search, Traceback and publication consumers. Source crops are
served by a private analysis-bound endpoint using exact source time and optional
BBox coordinates; the crop endpoint has no write effect. Remaining category
mitigation is a measured object embedding/appearance matcher so purity and
nearest-family discrimination no longer rely on detector-confidence proxies.

Audio Workbench provides the first detailed semantic-family implementation over
measured diarization embeddings: governed Narrative Agent families,
source-timed ranked candidates, explicit missing voice evidence, review-labour
account and Narrative Agent confirmation. Technical speaker buckets and their
threshold controls are not exposed as analytical categories.

### Audio semantic-family correction

Diarization labels such as `SPEAKER_00` are not Narrative Agent families and
must never surface as analyst-facing analytical categories or confirmation
targets. They may remain internal inputs for speech segmentation and matching.
The primary recognition surface starts from confirmed Master Schema Narrative
Agents and ranks source-timed audio candidates
using mature audio seeds, measured embedding similarity and constellational
presence evidence. Every confirmed Narrative Agent remains visible even when
voice evidence is missing.

Music and silence presence are automatically mature measured detections when
source linkage and validity checks pass. Foley and semantic sound-event groups
(for example gunshots, engines, doors and footsteps) remain confirmable because
their classification and grouping can materially benefit from analyst review.

### Narrative Agent semantic-family review slice

The Audio Workbench now evaluates cluster quality at the governed Narrative
Agent family boundary rather than at the technical diarization-label boundary.
Each family exposes:

- acoustic cohesion across the currently included samples;
- sample and temporal coverage;
- reviewed versus currently included membership;
- the strongest representative and the sample nearest the active threshold;
- the nearest competing Narrative Agent family for the representative; and
- every excluded sample with either `below semantic threshold` or
  `no voice or source-time support` as an explicit reason.

The 65% semantic threshold is a baseline review threshold. Adjustment is a
non-writing preview: the interface reports candidate gains or losses and moves
samples between included and excluded views, but it does not change Master
Schema authority, save a clustering parameter or proliferate a relation.
Representative, uncertain and excluded samples retain source navigation inside
Audio. Threshold commit, direct merge/split/reassignment and governed batch
decisions remain separate later slices rather than being implied by this preview.

## Remaining delivery: cross-video and cross-corpus comparison matrices

Recorded 2 November 2026. This is a remaining delivery slice and is not claimed
by the operational first draft of the per-video exploratory workbenches.

The first matrix compares exploratory-clustering results between explicitly
selected videos inside one governed project. The second compares explicitly
selected, versioned corpus editions. They reuse the per-video family accounts
and canonical decisions; they do not establish another clustering authority or
truth store.

Each row must identify the governed family or an explicitly reviewable proposed
alignment. Each video/corpus column must retain:

- mature, candidate, excluded, missing and unsupported member counts with
  separate denominators;
- source and temporal/spatial coverage;
- supported cohesion, separation, nearest-competitor and boundary evidence;
- representative, boundary, contradictory and excluded artefact returns;
- recurrence, distribution and exclusivity measures where methodologically
  defined;
- detector, embedding or matcher identity, parameters, threshold, quality gate
  and version;
- taxonomy term state, alias/alignment state and ontology effect; and
- the input analysis/corpus edition, correction generation, decision receipts
  and source-clock identities.

Video-to-video comparison may align like-governed families for inspection, but
must show asymmetric evidence and missingness rather than forcing a match.
Corpus-to-corpus comparison must declare its unit of analysis, nesting,
weighting and aggregation rule and must not flatten videos, source clocks,
provider runs or contradictory family decisions into an unqualified total.

A shared detector label, analyst title, similarity score, genre/situational
context or visual resemblance is not by itself a cross-video taxonomy identity,
cross-corpus ontology identity or Meaning Knowledge relation. New alignments and
terms remain candidate proposals until separately governed by the analyst.

Every matrix cell must drill down to the contributing video, family, artefact
and source coordinate. Comparison definitions and exact input editions must
survive save/reopen and portable export/reimport. Corrections invalidate only
affected cells and preserve prior comparison editions as traceback history.
