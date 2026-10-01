# Relational lenses: offline contract cleanup

Delivery date: 2026-09-16. Package status: draft, not registered or enabled in Datascene.

The three version 1.1.0 schemas implement the bounded contract corrections that can be
verified without manual UI testing. They preserve automated candidate visibility as a
first-class design requirement. Passing these validators does not grant analyst authority,
validate a theoretical construct, or authorize publication.

The original Desktop schemas remain untouched. Exact copies and hashes are retained in
`1.0.0/`. Revised, standalone schemas are in `1.1.0/`; their common definitions are generated
from `common-definitions.v1.1.0.json` with the versioned original schemas as inputs. There
are no remote schema references to resolve. Do not edit generated files independently.

## Delivered and automatically checked

- Stable anchor IDs, source revision IDs, and project/analysis envelope identity.
- Candidate record provenance without a mandatory analyst decision; automated producer
  metadata and consistent declarations for confirmed/corrected states.
- Evidence-backed alternatives, required concept provenance, and theoretical rationale for
  the principal event/relation records.
- Required Latourian participants and support for assessed stabilization.
- Required Morenoan ethics, exclusive `not_applicable` controls, scope-dependent role versus
  sociometric content, and criterion-round/population/epistemic metadata. A supplied relation
  strength requires a scale reference.
- Structural validation, explicit date-time checks, local evidence/participant/relation
  reference checks, duplicate IDs, interval ordering, normalized geometry bounds, and
  detection of confirmed assertions inside unconfirmed readings.
- Three explicitly synthetic candidate examples with no analyst ledger references.
- Deterministic generation and original-file integrity checks.

`counterrole_ids` in this draft refers to `role_relation_id` values in the same reading.
The synthetic examples represent no real persons, events, consent or theoretical findings.

## Reproduce validation

Use a Python environment with `requirements-validation.txt` installed. This delivery used
the already available base Conda jsonschema 4.23.0; it did not install packages or change the
application's `vaa1_core` / `vaa1_face` startup environments.

From the repository root:

```sh
python scripts/build_relational_lens_schemas.py --check
python -m unittest discover -s tests -p test_relational_lens_draft_contracts.py -v
python scripts/validate_relational_lens_record.py docs/schemas/relational_lenses/examples/goffmanian_situated_conduct.candidate.json
```

To regenerate after an intentional source-contract edit:

```sh
python scripts/build_relational_lens_schemas.py
```

## Explicitly deferred

This is not a runtime semantic-validation or authorization service. The offline validator
checks only structure and references resolvable within a reading. It cannot attest source
ownership, source dimensions for pixel boxes, media duration, real ledger events, external
entity/team/round/population/scale references, input snapshot hashes, actual consent, disclosure
permissions or scientific warrant. Those require registered service adapters and evidence.

Independent assertion decisions, mixed review states, source-localized before/after translation,
typed document/web locators, family coverage states, dependency invalidation, candidate review
surfaces, runtime hydration, StatsKit variable registration and publication eligibility remain
deferred. No new authority, migration or producer was connected to the existing application.
The root governance declaration remains a draft record-level contract; separate records and
explicit runtime decision bindings are required before independently reviewing mixed assertions.

The schemas and validator are intentionally not an automatic migration for 1.0.0 records.
Missing identities, citations, policy decisions or interpretive warrants must not be invented
to make an old record pass. The consumer and candidate-visibility design is maintained in
`docs/datascene_relational_lenses_design_reader_2026-09-16.md` at the project root.

Validation result: all 24 automated contract tests passed on 2026-09-16. No manual test was required for this offline delivery.
