# Guest workspace and API

Browser paths are shown with their `/api` prefix. The development proxy and Vercel remove the prefix before forwarding to Node.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/session` | Returns the current guest’s display name and onboarding state, or `{"guest":null}` for an absent, invalid, or expired session. |
| `POST /api/session/bootstrap` | Issues a signed browser ticket without creating a workspace. |
| `POST /api/session/guest` | Creates a workspace for a valid ticket. Takes `displayName` and accepts an IANA `timeZone`, with UTC as the fallback. A retry on the same ticket returns the existing profile. |
| `POST /api/session/onboarding-complete` | Persists onboarding completion. Repeated calls return the confirmed profile. |
| `POST /api/session/leave` | Expires the active browser cookie and returns 204. The saved workspace remains on disk. |
| `GET /api/tasks`, `GET /api/tasks/:id` | Read the current workspace’s tasks. |
| `POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id` | Create, update, or delete a task in the current workspace. Status and order changes use the same update route. |
| `GET /api/garden` | Returns `revision`, `lifetime`, `waterings`, `activeWaterings`, `growth`, `level`, `available`, and `streak`. Also returns the opaque `X-USAD-Garden-Scope` used for retries. |
| `POST /api/garden/water` | Takes a stable watering operation `id`, consumes one eligible credit, and returns the garden snapshot plus `wateringNumber` and `wateringRevision`. The same ID replays its existing receipt. |
| `GET /api/workspace/export` | Downloads a private, versioned JSON snapshot of the current guest’s tasks and garden. See the [export and recovery contract](recovery/export-contract.md). |

The task, onboarding, garden, and export endpoints require a valid guest workspace. Writes require an exact allowed frontend origin, and responses are private and uncached. The ticket is host-only, HttpOnly, SameSite=Lax, scoped to `/api`, and valid for 30 days from issue. Hosted cookies use the `__Secure-usad_guest` name and Secure flag. A display name is a label and cannot recover the session.

The server hashes the signed ticket to identify the corresponding workspace file. Starting another guest clears the active browser session and creates a separate workspace. The existing workspace remains on disk and the original ticket retains its expiry. Appearance palette and display mode are saved in browser storage independently of the guest’s tasks and garden.

## Garden ledger v3

- First completion records one credit per task. Moving a task out of Completed deactivates its contribution. Recompletion reactivates the same credit or receipt without minting another.
- `available` counts active unspent credits. `waterings` counts all receipts, and `activeWaterings` counts receipts tied to tasks that are currently completed. Two active waterings advance one level, up to level 10. Migrated ledgers can retain a fixed historical growth allowance.
- Streaks use the workspace’s time zone and the server-observed date of each eligible first completion. Multiple tasks on a single date count once. Removed completions can change the streak.
- A newly confirmed receipt can play the watering animation. The client retains the operation ID for an uncertain response and retries within the same guest scope. Refresh loads the settled state. Legacy receipts can have null sequence fields.

The storage reader accepts v1 and v2 ledgers and persists a v3 snapshot on the next successful workspace write. It preserves historical receipts and keeps imported completion dates unset when the original dates were unavailable. See the [release and recovery notes](usad-coordinated-release.md) before deploying against a persistent volume.
