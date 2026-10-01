# Datascene usage audit — 25 September 2026

Scope: the implementation thread and its associated automatic approval-review thread on 22–23 September 2026. These dates are interpreted as the user's two previous working rounds. Source: local Codex JSONL usage events; per-response usage records deduplicated by response_id. This is logged token traffic, not an invoice or authoritative conversion into subscription allowance.

| Measure | 22 September | 23 September |
|---|---:|---:|
| Main thread start–finish, Helsinki | 15:00:10–16:09:29 | 15:21:20–18:24:41 |
| Elapsed span | 1h 9m 19s | 3h 3m 21s |
| Sum of task-start/task-complete intervals | 46m 21s | 55m 24s |
| Main-thread task intervals | 8 | 11 |
| Main-thread model responses | 120 | 124 |
| Input tokens | 15,399,987 | 14,453,236 |
| Cached input (subset of input) | 15,038,592 | 13,916,288 |
| Uncached input | 361,395 | 536,948 |
| Output tokens (includes reasoning) | 62,836 | 84,527 |
| Reasoning output (subset of output) | 12,325 | 19,489 |
| Main-thread total input + output | 15,462,823 | 14,537,763 |
| Separate auto-review input + output | 3,527,733 | 4,406,834 |
| Last non-null five-hour used-percent reading | 99% | 99% |

Both main-thread days report gpt-6-astra, low effort. Auto-review reports codex-auto-review. Its logged usage is not proof of its billing treatment. Task duration includes tools and waits within a turn, excludes user gaps, and is not model-only compute time. Reset timestamps vary within the records; no simple per-token quota conversion or uninterrupted quota-window assumption is justified. No account-wide usage audit or older-model comparison was performed.

Delivered work on 22 September: service/startup checks, dependency-ordered sprint/manual gates, source-clock validation and ownership isolation, explicit time-unit/format migration and scoped navigation. On 23 September: source fingerprint/revision validation, correction guards, cross-process locks and canonical read/export fixes, dashboard bound snapshots, transcript draft safeguards, undo-history safeguards and correction generations. These are related implementation increments within the clock workstream, not completed independent sprint features. Manual M1–M6 remained pending.

The last word-undo operation is implemented in the worktree and its temporary-file route tests pass. The current focused results are 63 frontend tests and 73 backend tests plus 25 subtests; TypeScript passed. Final runtime acceptance for this increment had not been completed when the usage question arrived. Test totals are regression-suite sizes, not counts of newly delivered features. No git publication is claimed.

Metrics: [session_metrics.json](session_metrics.json). Official context: https://learn.chatgpt.com/docs/pricing .
