# Datascene handover: decision layer and Meaning Network projection

Date: 2026-11-04  
Branch: `petteri`

## Delivered in this thread

- Persistent parsimonious decision runtime with content-addressed artifacts, compatibility keys, capsule registry, cost-aware routing, explicit score semantics, runtime traces, invalidation and correction-to-learning quarantine.
- Quick Sweep / Science Sweep workflow planning for Narrative Agents, actions and movements, and episodic scene continuums.
- Runtime API and Tools inspection surface.
- Parsimonious Decision Engine 1.0 schema and 2.0 design document.
- Datascene software architecture map with delivered and `to be made` capabilities.
- Meaning Network projection for non-person detector objects and governed manual `OBJ` corrections.
- First deterministic visual speaker rule: exactly one named, temporally overlapping, analyst-governed visual annotation with explicit speaking activity can replace an unknown transcript speaker and create a `spoken_by` edge.
- Scene-card clock adapter for nested `time_interval.start_ms/end_ms` intervals.
- Boundary guard preventing a tiny overlap with the following speaker from defeating the current speaker resolution.

## Verified result on the saved analysis

Analysis directory:

`outputs/imported_work/233bce22-d82b-4aeb-8af5-c3182c61612f`

The regenerated `datascene_meaning_network.json` contains:

- 277 nodes.
- 266 edges.
- 37 `object` nodes.
- Transcript `Why would I betray you?` labelled `Dr. Madeleine Swann`.
- Speaker authority `analyst_constellation_rule`.
- A Madeleine `spoken_by` edge targeting that transcript node.

Focused verification: 28 tests passed in the project virtual environment.

## Persisting visible defect

The dashboard screenshot taken at 15:51 still reports **341 nodes / 124 edges**, shows the line as `UNKNOWN`, and leaves Objects/Props empty. Those values do not match the regenerated disk artifact above.

This demonstrates that the running API/dashboard is serving a stale graph retained in analysis status or process memory. Browser refresh does not reload the regenerated artifact from disk. The immediate defect is no longer the graph builder output; it is runtime artifact publication and hydration.

## First task for the next thread

Trace the active request used by `MeaningPlotPanel` and remove the stale in-memory authority path:

1. Identify the API response supplying `datascene_meaning_network` to the panel.
2. Compare its artifact revision, node/edge counts and file path with the disk artifact.
3. On Meaning/Plot refresh, reload the current artifact or rebuild it from current governed sources.
4. Atomically replace `status["datascene_meaning_network"]`, not only the JSON file.
5. Emit an artifact revision/hash and make the frontend reject an older cached revision.
6. Invalidate browser/local-library cached graph data after correction proliferation or graph rebuild.
7. Add an end-to-end test: correction → rebuild → API refresh → panel receives Madeleine plus object nodes without restarting the service.

## Acceptance gate

At source clock 06.280:

- Graph and Meaning Sheet show `Dr. Madeleine Swann: Why would I betray you?`.
- The node exposes `source_speaker_label: UNKNOWN` only as provenance.
- Objects/Props contains the scene's governed and detector object nodes.
- API counts and displayed counts equal the current artifact counts.
- Restarting the browser or API does not change the result.

## Important limitation of the first rule

The delivered rule is deliberately narrow. It uses explicit analyst-governed speaking activity and does not yet infer speakers from unconfirmed lip movement, gender, semantic addressivity or probabilistic constellations. Those belong to the next validated capsule expansion after the publication/hydration path is reliable.

