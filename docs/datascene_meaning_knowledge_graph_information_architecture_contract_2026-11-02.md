# Datascene Meaning Knowledge Graph information-architecture contract

The system-level placement of this graph, the canonical decision regime, and the
Parsimonious Decision Runtime is maintained in the
[Datascene Software Architecture Map](datascene_software_architecture_map.md).

Date: 2 November 2026  
Status: proposed publication-readiness contract; current first draft remains operational

## Decision

The current lane list is useful as an operational first draft, but it is not a
publishable ontology. It places structural containers, represented phenomena,
evidence, and computational review queues at the same semantic level. The
Meaning Knowledge Graph must instead expose four different registers:

1. **Structural scope** — where and over what duration something is organized.
2. **Represented world and expression** — what is present, happens, is said,
   heard, shown, arranged, or related.
3. **Interpretive projections** — what a named theoretical perspective permits
   the analyst to propose about the evidence.
4. **Evidence and review state** — why a node or edge exists, how mature it is,
   and what still requires review.

These registers may be viewed together, but they may not be silently collapsed
into one taxonomy. The graph remains subordinate to governed source evidence
and the Master Schema.

## Critical assessment of the first-draft lanes

| Current lane | Assessment | Governed destination |
|---|---|---|
| Scene | Too broad and structurally ambiguous | Structural scope: Act / Sequence / Scene / Shot; mise-en-scène remains a shot/scene contextual account |
| Spoken word | Valid but incomplete | Language and discourse: speech/transcript, speaker assignment, dialogue act, named/reference relation |
| On-camera agents | Valid evidence-facing lane | Participants and presence: visible Narrative Agents, with source-linked visual confirmation artifacts |
| Evidence / language | Conflates warrant with represented language | Split into Language and discourse, Written/OCR language, and a non-semantic Evidence rail |
| Prosody / delivery | Valid expressive layer | Voice, prosody and delivery, linked to but not merged with spoken word |
| Objects / props | Valid material-world lane | Objects, props and material culture, with governed object-family confirmation artifacts |
| Matcher review candidates | Not a meaning category | Candidate/review overlay; never presented as accepted graph truth |
| Location / setting | Valid but currently underspecified | Space, location and setting; distinguish detected place, narrated place, institutional setting and inferred setting |
| Off-camera / presumed presence | Valid but epistemically mixed | Participants and presence; separate heard, mentioned, implied, remembered and analyst-inferred presence |
| Music / sonic field | Conflates music with wider soundscape | Split into Music and score; Foley and sound events; Ambience and sonic field |
| Other meaning tracks | Unpublishable catch-all | Unresolved/unclassified review queue with an explicit reason and required disposition |

## Publishable navigation model

The default graph navigator uses collapsible lane groups in this order. The
order follows analyst reasoning from structural scope, through observable
constellations, to interpretation and review.

### A. Structural scope

- Act
- Sequence
- Scene
- Shot
- transition, boundary and continuity
- mise-en-scène account

`structure.act` and `structure.scene` are organizational units. They must never
be confused with Burke's terms `burke.act` and `burke.scene`.

### B. Participants, action and relations

- on-camera Narrative Agents
- off-camera, heard, mentioned, remembered, implied or presumed agents
- action, event and interaction
- agent-agent, agent-object and agent-setting relations
- body movement, gesture, expression and affect display

### C. Language and voice

- spoken word and transcript
- speaker/turn assignment
- written language, subtitles and OCR
- evidence-language analysis, including eligible SFL/dependency projections
- prosody, voice and delivery

“Evidence-language analysis” is an analytical projection over language
evidence; it is not the evidence rail itself.

### D. Material, spatial and visual world

- objects, props and material culture
- location, setting and spatial relation
- framing, camera movement, composition, colour, lighting and visual field
- mise-en-scène constituents and their governed contextual account

### E. Sound world

- music and score
- foley and discrete sound events
- ambience, silence and sonic field
- source, diegetic status and heard/off-screen relation where supported

### F. Interpretive perspectives

- theory-native structural readings
- situation, theme, value, tension, motive and report-claim candidates
- genre and situational-taxonomy projections

Every projection declares its theoretical register and native marker language.
Structural units organize evidence; theoretical projections interpret it. No
perspective becomes an invisible universal schema.

The structural perspective set should be governed as Aristotle, Freytag, Frye,
Booker, Boje and Burke. Campbell remains available as a named projection, with
its primary analytical home in Narrative Agent trajectory work. Burke's Pentad
belongs here, namespaced as `burke.act`, `burke.scene`, `burke.agent`,
`burke.agency` and `burke.purpose`.

### G. Evidence and review rails

These are graph overlays and filters, not semantic siblings of the preceding
lanes:

- source evidence and confirmation artifacts
- matcher review candidates
- conflicts, negative evidence and exclusions
- unresolved/unclassified records
- maturity, authority, freshness and traceback

The analyst can hide these rails for reading and reveal them for audit. Hiding
them never removes their governance effect.

## Confirmation-image artifacts

JPEG confirmation images from Narrative Agent, object and audio workflows—and
later scene, foley, location and other confirmation workflows—are governed
evidence views. They are not free-floating graph decorations and do not replace
the canonical detection or confirmation record.

Each displayed image requires:

- `artifact_id`, `artifact_kind` and immutable content checksum;
- canonical decision/confirmation id and maturity state;
- source media id, exact source clock/range and source-clock revision;
- BBox/ROI or audio interval/waveform coordinates where applicable;
- producer, creation time, rendering recipe/version and original evidence refs;
- alt text and a non-image textual label;
- source-return action, traceback action and open-confirmation action; and
- stale/superseded state when its underlying decision changes.

The UI may use compact thumbnails at nodes and edges. Selecting one opens an
evidence strip or sheet with the full artifact, neighboring samples, decision
receipt and source return. Multiple images are a montage/stack attached to one
canonical node; they do not manufacture duplicate semantic nodes.

Preferred visual behavior:

- mature analyst confirmations use the shared mature confirmation treatment;
- candidates remain visibly provisional;
- conflicts and superseded artifacts remain inspectable, not silently erased;
- missing images fall back to the typed artifact label and source anchor;
- thumbnails load lazily and are virtualized so graph navigation stays fast;
- image resolution does not control semantic importance or node size.

## Navigation contract

The graph has three synchronized navigators:

1. **Scope navigator:** corpus/project → video → act → sequence → scene → shot.
2. **Lane navigator:** the grouped domains above, with counts by maturity and
   explicit filters for candidates, conflicts and missing evidence.
3. **Constellation navigator:** follow typed edges among agents, actions,
   language, objects, settings, sound and interpretations.

Core gestures:

- single click selects without changing analytical scope;
- source action seeks the exact media coordinate in-panel;
- double click opens the selected node/edge sheet, not a generic overview;
- thumbnail click opens its governed evidence artifact;
- breadcrumb returns through shot, scene, sequence and act without losing the
  selected constellation or filters;
- theory switch changes the projection overlay and native vocabulary, not the
  underlying evidence nodes;
- candidate overlays never obscure mature records;
- save/reopen restores scope, selected record, filters, expansion and scroll.

## Required node and edge distinctions

Every record declares both a domain and an epistemic role:

```text
domain: structure | participant | action | relation | language | voice |
        object | space | visual_form | music | sound_event | ambience |
        interpretation

epistemic_role: source_evidence | observation | governed_entity |
                structural_unit | interpretation | candidate | conflict
```

This prevents an object JPEG, an accepted object family, a matcher candidate,
and an interpretive symbol from being rendered as if they were the same kind of
thing. Typed relations must likewise distinguish containment, temporal order,
participation, speech, perception, material interaction, evidential support,
contradiction and theory projection.

## Migration rule

Do not destructively rename or rewrite existing graph records. Introduce a
versioned lane registry and compatibility aliases from the current lane ids.
Reindex projections from canonical evidence, preserve all analyst decisions and
write an auditable migration receipt. `Other meaning tracks` becomes
`Unresolved / needs classification`; it is not bulk-assigned to a new semantic
category.

## Delivery slices and acceptance

1. **Registry and schema:** add structural/domain/epistemic fields, typed lane
   groups, compatibility aliases and Act/Sequence/Scene/Shot namespaces.
2. **Navigation shell:** grouped lane navigator, scope breadcrumbs, overlay
   controls and state restoration.
3. **Confirmation artifacts:** shared image-artifact component and projection
   adapters for Narrative Agent, object and audio confirmations.
4. **Missing evidence domains:** action/relations, written language,
   visual-form/mise-en-scène, and body/affect.
5. **Remaining confirmation families:** scene/location, foley/sound event,
   music/ambience and later governed families.
6. **Theory projections and reporting:** theory-native overlays, Burke/Campbell
   placement, and report language that names its theoretical register.
7. **Publication qualification:** accessibility, performance, export/reimport,
   stale-artifact behavior and cross-video/corpus graph comparison.

Acceptance requires source return, correction persistence, supersession,
save/reopen, project isolation and portable export. A screenshot can demonstrate
rendering but cannot substitute for durable decision and source-link checks.

### Operational delivery note — 3 November 2026

The first navigation-shell slice is operational in the Meaning / Plot graph:

- category groups collapse independently and review overlays remain separate;
- Act / Sequence / Scene / Shot breadcrumbs expose assigned structural scope;
- navigation state restores per analysis, including group state, review overlay,
  selected node/edge, focused scene and zoom;
- edges have direction markers, relation labels, persistent selection,
  keyboard navigation, source return and their existing Meaning Sheet;
- eligible Narrative Agent and object nodes reuse the existing lightweight,
  source-linked JPEG crop route rather than copying ungoverned image files; and
- Narrative Agent nodes receive stable colors derived from their governed key.

This is an operational first draft, not final rendered acceptance. Manual UI
review must still verify legibility under dense graphs, image loading/fallback,
edge hit targets, group collapsing, saved-state recovery and source return.
