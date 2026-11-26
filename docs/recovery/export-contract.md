# Workspace export and recovery contract

## Download

**Guest workspace → Export my data** downloads `usad-workspace-YYYY-MM-DD.json`. The filename uses the UTC export date. The file is UTF-8 JSON and can contain private coursework, dates, and activity history. Store it somewhere private.

`GET /api/workspace/export` uses the existing signed, unexpired guest cookie and returns only that guest’s workspace. A missing or expired ticket or a ticket without a workspace gets `401`. A storage or encoding failure gets a generic `503`. The attachment is private and uncached, and carries no cookie, session key, workspace filename, display name, appearance settings, or onboarding state.

Tasks and garden come from one read of the atomically replaced workspace file. The API serializes workspace changes in one Node process, with one production writer. Export has no writes. Storage reads cap the on-disk file at 2 MiB, and the attachment cap adds 1 KiB for export metadata (2,098,176 bytes total). The normal write limits are 300 current tasks and 3,000 ledger entries.

## Schema 1

The tables give the canonical field order at each object level. All fields are required unless marked optional. Array order is significant. The JSON check uses `format` plus `schemaVersion`. New versions require their own parser and proof encoding. `appVersion` is informational.

| Root field | Value |
| --- | --- |
| `format` | Literal `usad-workspace`. |
| `schemaVersion` | Integer `1`. |
| `exportedAt` | Server-clock UTC ISO timestamp with milliseconds. |
| `appVersion` | Version from `package.json`. |
| `timeZone` | Workspace calendar time zone for garden activity. Older workspaces without one use UTC. |
| `tasks` | Array of current task records. |
| `garden` | Ledger as described below. |
| `provenance` | Object with one field, `sourceId`. Stable opaque workspace identifier under the issuing key. |
| `integrity` | Object with `algorithm` (literal `HMAC-SHA-256`) and `digest` (unpadded base64url). |

Task fields in order are `id`, `title`, `subject`, `description`, `priority`, `status`, `dueDate`, `order`, `createdAt`, and `updatedAt`.

- Preserve the case-sensitive task ID and fractional order key. IDs match `[a-zA-Z0-9_-]{1,80}`. Order keys match `[a-zA-Z0-9]{1,512}`. Multiple tasks can share an order key.
- Titles and subjects are nonblank, with JavaScript string-length limits of 120 and 60. Descriptions allow up to 1,000 code units and can be empty.
- Priority is `high`, `medium`, or `low`. Status is `pending`, `in-progress`, or `completed`. A due date is a valid calendar date `YYYY-MM-DD` or `null`. The creation and update fields are UTC ISO timestamps with optional milliseconds. They are coursework metadata supplied by the client.

| Garden field | Value |
| --- | --- |
| `version` | Integer `3`, including v1 and v2 ledgers upgraded in memory. |
| `revision` | Nonnegative safe integer, advanced on reward-relevant task changes and new watering receipts. It is independent of other task edits. |
| `legacyWaterings` | Fixed migrated growth allowance, integer 0–18. The v1 reader computes it from historical entries and receipts. The v2 reader preserves it. Both start v3 revision at zero. |
| `entries` | Chronological ledger array, including entries for deleted and inactive tasks. Array order determines which eligible credit is watered first. |

Ledger entry fields in order are `taskId`, `firstCompletedAt`, `completionDay`, `wateringId`, `wateringNumber`, and `wateringRevision`.

- `taskId` uses the task ID format. It marks a single lifetime credit even after undo, deletion, or recreation of the task.
- Optional `firstCompletedAt` (server UTC timestamp) and `completionDay` (calendar date in `timeZone`) come as a pair. Historical entries without a trustworthy date omit both.
- Optional `wateringId` is a stable operation ID matching `[a-zA-Z0-9-]{16,80}`. Its presence marks a spent credit. Optional `wateringNumber` is the sequence among all receipts, and optional `wateringRevision` is the ledger revision that committed it. Older receipts can lack one or both sequence fields (or have a null sequence value). Preserve recorded values and absences.
- Active rewards are derived from tasks currently in Completed. Streak also depends on the calendar date when viewed. Export includes the ledger and inputs needed to derive those values.

## Authenticity decision

The issuing server authenticates the whole snapshot, including task status, calendar zone, deleted-task entries, and provenance. A bare checksum would allow edited credits to carry a newly computed checksum. V1 derives two independent HMAC keys from the persistent 32-byte session-signing key. Key material stays server-side.

1. Compute `proofKey = HMAC-SHA-256(sessionKey, "usad:workspace-export:proof:v1")` and `sourceKey = HMAC-SHA-256(sessionKey, "usad:workspace-export:source:v1")`. The labels are UTF-8 and the derived keys are raw bytes.
2. `sourceId` is the base64url HMAC under `sourceKey` over the internal workspace key (the lowercase hex string of the SHA-256 hash of the ticket). It supports replay tracking. It carries no session authority.
3. Rebuild the payload in the documented order without the root `integrity` member. Use JavaScript `JSON.stringify` without indentation, preserving array order and omitting absent optional fields. Encode as UTF-8 with no trailing newline. `digest` is the 32-byte HMAC under `proofKey`, encoded as 43 base64url characters. Verify using a constant-time comparison of decoded bytes.

The proof authenticates data from a server with the matching key. The file contains no proof of the holder’s identity and no encryption. Anyone with a copy can read the coursework, and a future restore must treat possession as sensitive. Losing the issuer key makes garden authenticity unverifiable. Tasks remain readable and can be validated independently.

## Phase 00B restore requirements

- Bound UTF-8 input before parsing. Reject malformed JSON, duplicate object keys, unexpected fields, unsupported versions, and records outside the task or ledger bounds. Validate dates, time zones, integer ranges, canonical encodings, and receipt field dependencies. Reject duplicate task IDs, duplicate ledger task IDs, duplicate watering IDs, and duplicate non-null receipt sequence numbers or revisions. Receipt numbers cannot exceed the total receipt count. Receipt revisions must be positive and at most the ledger revision. Compare dated credit timestamps to their recorded local calendar dates. A ledger entry can outlive its task.
- Require an explicit target guest workspace and confirmation before applying an import. Preserve stable IDs and array order. Never reuse tickets or trust imported timestamps as evidence of a new completion. Use a complete, validated snapshot and commit it atomically.
- Permit task-only recovery with an untrusted or unverifiable proof only through an explicit task-only flow. Discard garden claims in this mode. Record durable reward ineligibility for imported IDs, including after delete, undo, or recompletion. The existing reconciler can create undated credits for completed records missing from the ledger, so 00B must enforce ineligibility before enabling this import path.
- Enable authenticated garden restore only when the issuer can verify the whole snapshot and enforce durable replay protection keyed by `sourceId`, across different files from the same source and across target workspaces. Bind the accepted digest to the destination. Retrying that import returns its original outcome without rolling back later changes or issuing rewards again. The restore and the replay record must commit together or be safely recoverable together. Where the source still exists, refuse stale reward history and require the source to be expired or atomically retired so two active workspaces cannot spend the same credits. Where the source is gone, require intact issuer replay state. Independent servers sharing a key still need the same replay authority.
- Recompute garden views from trusted inputs. Keep spent receipts and deleted-task entries. Any completed task that lacks a trusted ledger entry must yield zero imported rewards. Preserve v1/v2 history through normalized v3, including missing legacy dates and receipt sequences.

Phase 00A provides download only. A file contains portable task data and signed garden history under the limits above. It cannot reopen the old browser session, recover changes made after export, or replace a server-side disaster recovery backup. Deploy a compatible API before enabling the UI. The current frontend can continue using the new API, and the new frontend presents a retryable download error if an older API is still running.

## Operational backup research

Railway documents a 0.5 GB Free-plan volume and authenticated volume downloads through its CLI or SSH transports. An independent backup would need a consistent copy of the private guest directory, including its signing key, encrypted off-platform and restore-tested on disposable infrastructure. Usage and egress can incur charges. Railway-managed backups are billed for incremental storage and are scoped to the original project and environment. [Free plan](https://docs.railway.com/pricing/free-plan) · [Volume transfers](https://docs.railway.com/volumes/reference) · [Managed backups](https://docs.railway.com/volumes/backups)

These options were verified against Railway’s documentation. Availability and restore success for USAD remain unverified. The prior release recorded that SSH authentication stopped its transfer attempt. [USAD release notes](../usad-coordinated-release.md)
