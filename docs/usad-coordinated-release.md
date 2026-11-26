# USAD coordinated frontend and API release

The local candidate includes the guest and garden v3 work and all three UI phases. The baseline is `615019ff2b245df5d8af377cfc6f3a3dca3730d1`. The Vercel production alias reported the same commit in read-only deployment metadata on November 26, 2026. The public Vercel page and its anonymous `/api/session` route returned HTTP 200. The exact Railway deployment revision could not be confirmed with the connected account. [Public frontend](https://ccadaverr-usad-blue.vercel.app/)

## Source manifest

| Owner | Files |
| --- | --- |
| Guest API and atomic storage | `data/guest-api.cjs`, `data/guest-storage.cjs`, `data/server.cjs` |
| Garden ledger, streak, and API verification | `data/garden.cjs`, `data/garden.test.cjs`, `data/guest-api.test.cjs` |
| Board task writes and confirmed garden updates | `src/app/board/board.store.ts`, `src/app/board/board.store.spec.ts`, `src/app/board/task.service.ts` |
| Shared composer and dialog behavior | `src/app/board/card-dialog.component.html`, `src/app/board/card-dialog.component.ts`, `src/app/shared/close-dialog.ts`, `src/app/shared/dialogs.service.ts` |
| Board picker and calendar cases | `src/app/board/board-move-dialog.component.html`, `src/app/board/board-move-dialog.component.ts`, `src/app/board/board.component.html`, `src/app/board/card.component.ts`, `src/app/board/board.logic.spec.ts` |
| Guest setup and tutorial | `src/app/guest/entrance.css`, `src/app/guest/guest-flow.spec.ts`, `src/app/guest/guest-session.service.ts`, `src/app/guest/onboarding.component.html`, `src/app/guest/onboarding.component.ts` |
| Watering interaction and garden state | `src/app/pages/garden.service.ts`, `src/app/pages/plant.component.ts`, `src/app/pages/plant.component.html`, `src/app/pages/plant.component.spec.ts` |
| Botanical renderer and motion | `src/app/pages/botanical-growth.ts`, `src/app/pages/botanical-growth.spec.ts`, `src/app/pages/specimen.ts`, `src/app/pages/streak-fruit.ts`, `src/app/pages/watering-can.ts`, `src/app/pages/watering-motion.ts` |
| Workspace, Home, Deadlines, and integration tests | `src/app/app.spec.ts`, `src/app/pages/home.component.html`, `src/app/pages/home.component.ts`, `src/app/pages/deadlines.component.ts`, `src/app/pages/task-list.component.ts`, `src/app/shared/deadline.component.ts`, `src/app/shared/icon.component.ts`, `src/app/workspace.component.html`, `src/app/workspace.component.ts`, `src/styles.css` |
| Phase and release handoffs | `docs/usad-phase-1-handoff.md`, `docs/usad-phase-2-handoff.md`, `docs/usad-phase-3-handoff.md`, `docs/usad-coordinated-release.md` |

## Data contract and rollout

- Release the frontend and API together. The Angular candidate consumes the API's `revision`, `growth`, `activeWaterings`, `streak`, and confirmed watering receipt fields. It refreshes from the authenticated API after a confirmed reward or status correction. A local browser invalidation signal lets other tabs refresh their own authenticated state. A frontend-only release against the baseline v1 contract cannot guarantee streak, growth, or receipt animations.
- Version 3 preserves historical entitlements and watering IDs. An entitlement is active when its task is currently Completed. Deleting a task removes the active contribution. Reusing the ID retains the original entitlement and receipt.
- Version 1 derives the same fixed growth allowance as the prior version-2 migration. Version 2 carries its existing allowance forward. Historical receipts qualify for current growth only while their associated task is Completed. An old guest can therefore see a lower level or fewer available drops if previously counted tasks are now inactive. Their receipts remain in the ledger.
- Legacy workspaces without a calendar timezone use UTC. New guest setup records a validated IANA timezone once. Only first completions accepted by the server after the migration can enter streak history.
- Normal authenticated reads calculate migrated state in memory. The next successful workspace mutation persists it through the existing atomic JSON replacement. Signing keys and cookie configuration require no changes.
- Version 1 and version 2 readers cannot open version-3 ledgers. Any rollback build must retain the version-3 reader and preserve the saved history. Verify the packaged API and frontend together with disposable fixtures before the release window.

## Proposed rollout

1. Review the manifest and build both services from the same reviewed revision. Confirm the Railway production service and Git revision with the project owner. Exercise the pair on a separate staging volume with disposable v1, v2, and v3 guest fixtures. Verify session continuity, same-ID replay, reversal, and restart.
2. Take and verify a recoverable backup of the production guest volume, including the existing session signing key. Keep that key, the mounted guest path, the public frontend hostname, cookie scope, and single-writer setup. Prepare a rollback API artifact that can read and preserve v3.
3. Switch the one Railway writer to the v3 API first. Avoid concurrent v1/v2 and v3 writers on the same volume. Check the forwarded session route and v3 Garden contract using an authorized release smoke workspace. Then promote the matching Vercel frontend in the same window. During the brief API-first interval, old tabs can read the overlapping fields but may still describe growth in terms of completed tasks. Ask affected users to refresh once the paired frontend is live.
4. Verify the paired endpoints and monitor session, migration, and watering errors. If the frontend needs a rollback, use a UI that understands the v3 response. Keep a v3-capable API on any volume that has accepted v3 writes. Treat restoration of a pre-release volume snapshot as separate recovery because it can discard writes accepted after the snapshot.

## Local verification

The [Phase 3 handoff](usad-phase-3-handoff.md) records the final test results and inspected browser evidence. Build prerequisites and production hosting configuration use the existing repository setup.
