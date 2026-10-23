# Bug Report — Confirmed Nomi roles missing from Constellational Snapshot

Date: 2026-10-21

Status: resolved in code and verified against the live project payload.

Stage: 7 — Reviewable interpretation

Representative artifact: *No Time to Die* trailer, analysis
`81920e95-a0b2-4173-bc23-86db7909a0a9`

## Summary

The Narrative Agent panel correctly hydrated Nomi's confirmed presence and
speaker occurrence, but the `narrative_roles` layer of the Constellational
Snapshot remained `missing`. The analyst had already confirmed a role-bearing
Nomi record, so the panel contradicted Datascene's confirm-once, mature-everywhere
and saloon-doors principles.

## User-visible symptom

- Nomi was the selected canonical Narrative Agent.
- Confirmed visual and audio occurrences appeared in the active-video path.
- `narrative_roles` reported no confirmed roles.
- No mature `has_narrative_role` edges were available to associated graph
  consumers.

## Root cause

An earlier UI persistence path stored identity and role data together in the
confirmed BBox label:

`Nomi (Lashana Lynch): secret agent, intelligence role; MI6 agent assigned the 007 number`

It did not populate the contemporary Source Media arrays
`character_roles`, `character_definitions`, or `narrative_agent_profiles`.
The continuity inventory read roles only from those arrays and treated the
complete legacy string as a second Narrative Agent identity. Consequently,
canonical `Nomi` had no role claims to project.

This was a persistence-shape compatibility defect, not missing analyst data.
The confirmed source record and its traceback were present throughout.

## Delivered correction

- Recognize explicitly confirmed legacy labels of the form
  `Agent (performer): role; role`.
- Reconcile the subject to the canonical individual identity (`Nomi`) instead
  of creating a compound duplicate identity.
- Parse the confirmed role clauses into mature role assertions.
- Preserve the original annotation ID and source record as traceback; no
  analyst evidence is rewritten or discarded.
- Project the roles to the Constellational Snapshot at probability `1.0` with
  `explicit_analyst_role_confirmation` authority.
- Emit one mature `has_narrative_role` graph edge per role for both Narrative
  Agent and Meaning Knowledge projections.
- Keep future machine-inferred role hypotheses separate and reviewable.

## Verified result

The live Nomi projection now reports:

- `narrative_roles.state`: `confirmed`
- `narrative_roles.probability`: `1.0`
- `narrative_roles.authority`: `explicit_analyst_role_confirmation`
- confirmed roles:
  - `secret agent`
  - `intelligence role`
  - `MI6 agent assigned the 007 number`
- three mature `has_narrative_role` edges with the same authority

The backend returned HTTP 200 after restart and the live project payload was
inspected directly.

## Regression coverage

- A backend contract now proves that a confirmed compound legacy label becomes
  one canonical Nomi identity with three mature roles.
- The complete focused backend continuity/projection suite passes: 26 tests.
- The Narrative Agent workbench contract suite passes: 17 tests.
- `git diff --check` passes.

## Governing invariant

`explicit analyst role confirmation → canonical Narrative Agent role → mature Master Schema/graph projection → automatic hydration in every associated consumer`

A legacy storage shape may not hide, demote, duplicate, or request
reconfirmation of an explicit analyst decision. Later correction may supersede
the role through the governed append-only decision path.

## Residual migration note

The runtime compatibility reader repairs existing saved work without mutation.
A future bounded migration may populate the contemporary Source Media role
arrays from legacy compound labels, but it must preserve the original record,
authority and traceback and must not be required for correct runtime hydration.
