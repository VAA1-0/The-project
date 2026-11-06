# Interrupted-write and backup-restore contract

Date: 6 November 2026
Release boundary: `#0.1`

## Critical state covered

The canonical `analysis_record.json` is the restart boundary for an analysis.
It contains project ownership, workflow state, output references, event history,
runtime metadata and recovery information. This slice makes its previous
committed generation recoverable and makes restoration an exercised startup
path.

## Write protocol

Every analysis-record save now runs under the record transaction lock and:

1. reads and validates the existing primary object;
2. atomically copies its exact bytes to `analysis_record.json.bak`;
3. writes the new primary through a unique temporary file;
4. flushes and `fsync`s the temporary file;
5. atomically replaces the primary;
6. reads and validates the committed object; and
7. writes a recovery receipt containing primary and backup SHA-256 checksums.

If the existing primary is already malformed, a normal save fails closed. It
does not turn corrupt bytes into the recovery generation or silently erase
evidence of the fault.

## Restore protocol

Both direct analysis reload and saved-work catalogue collection use the same
recovery loader:

- a valid primary is returned without restoration;
- an invalid primary with a valid object backup is moved to a uniquely named
  `.corrupt-*` quarantine file;
- the exact backup bytes are atomically restored as the primary;
- a restore receipt records the checksum, source, quarantine path and reason;
- the restored status receives an `analysis_record_restored_from_backup` event;
- a backup whose embedded analysis identity conflicts with its directory is
  rejected; and
- if both generations are invalid or absent, loading fails closed and neither
  is overwritten.

Existing in-flight recovery remains active: a successfully restored record
whose state was `processing` becomes resumable from its latest valid analysis
checkpoint rather than being presented as completed.

## Verification

- Previous committed bytes were retained exactly and checksummed.
- A deliberately truncated primary was quarantined and restored from backup.
- A simultaneously invalid primary and backup failed closed without modifying
  the primary.
- Existing checkpoint, transaction-lock, correction-lock, project-format and
  capability-register contracts remained green: 30 focused tests passed.
- Python compilation and `git diff --check` passed.

## Explicit remaining boundary

This contract covers the canonical analysis record and its restart path. It
does not yet make all analysis artifacts one indivisible multi-file commit.
Large media, derived JSON, CSV and publication packages retain their existing
individual atomicity and validation rules. Cross-artifact commit journals and
retention policy remain separate release qualifications.
