# Independent export-verification contract — 6 November 2026

## Outcome

Datascene publications now have a standalone verifier at
`scripts/independent_export_verifier.py`. It uses only the Python standard
library and imports no Datascene exporter, importer, restore routine, schema
helper or canonicalization function. It can therefore reject a package even
when the producing and restoring application code share the same assumption.

The verifier runs directly from a shell:

```text
python scripts/independent_export_verifier.py "Publication.zip"
```

It emits a JSON receipt and exits non-zero on rejection. The managed endpoint
`POST /api/publication/verify-independent` launches the same file in a separate
process for an archive under Datascene's results or publication roots.

## Independent checks

- ZIP path traversal, duplicate paths, encryption, file-count and expanded-size
  limits;
- recognized root manifest, package type and schema version;
- exact manifest coverage of every payload file;
- independently calculated SHA-256, byte length and canonical content identity;
- package, project, edition and video identity consistency;
- Data Book chapter ordering and record counts;
- source-clock identity and declared time unit;
- explicit record units, including declared null/not-applicable units;
- source coordinates, maturity, authority and provenance on every record;
- associated-file and report-to-chapter references;
- governed explanations for empty/missing chapters;
- publication/decision history; and
- every nested video edition in a corpus publication.

The receipt contains a human-oriented reader summary: project and edition,
video identities, chapter and record counts, explained empty chapters, history
events and verified integrity entries. Datascene does not need to be running to
understand this account.

## Acceptance evidence and boundary

Fresh video and two-video corpus publications pass the standalone process.
Changing a report payload without updating its integrity evidence is rejected.
This establishes structural, integrity and traceability independence; it does
not constitute independent scientific review of the analytical findings.
