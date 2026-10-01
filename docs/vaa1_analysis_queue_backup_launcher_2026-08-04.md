# Datascene/VAA1 Analysis Queue Backup Launcher

The backup launcher is an operating-system-independent companion to the Datascene analysis queue. It is intentionally separate from the browser so closing or refreshing the panel cannot strand a resting queue.

## Operation

The launcher reads a persisted queue manifest, checks the bounded analysis-status endpoint, and performs one governed action at a time:

- monitors an active analysis;
- advances past a completed analysis;
- starts an uploaded, resting, or interrupted analysis from its governed checkpoint;
- waits through the configured cooling period;
- retries while the backend is temporarily unavailable;
- stops on `partial`, `error`, or `failed` rather than silently advancing;
- writes an atomic machine-readable heartbeat and queue-state record.

The launcher never creates a second heavyweight worker. Backend admission remains authoritative and HTTP `409` causes the launcher to wait and re-evaluate.

## Start

Copy the example manifest and replace its analysis IDs with the intended queue order:

```text
docs/schemas/vaa1.analysis_queue_backup_manifest.v1.example.json
```

Run with the Python available on either macOS or Windows:

```text
python scripts/vaa1_queue_backup_launcher.py PATH_TO_QUEUE_MANIFEST.json
```

For unattended operation, register this command with macOS `launchd` or Windows Task Scheduler. The queue manifest and `state_path` must be stored in a location available to that operating-system service. On macOS, `~/Library/Application Support/Datascene/` avoids Desktop privacy restrictions for a LaunchAgent.

## Governed state record

The configured state file reports:

- current and completed analysis IDs;
- current backend status and measured progress;
- launcher state (`monitoring`, `cooling`, `waiting_for_backend`, `stopped_on_terminal_failure`, or `completed`);
- backend failure count;
- cooling deadline;
- last operational message and update timestamp.


This state is the recovery proof that distinguishes an intentionally cooling queue from an abandoned one.
