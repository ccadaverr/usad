# Guest Experience V1

## Session and storage

The display name personalizes the workspace. Access is tied to the browser’s host-only guest cookie. A guest cannot recover a workspace by entering the same name. Guest cookies expire 30 days after issue. Taking the tour again leaves the original onboarding confirmation and workspace intact.

| Backend route | Behavior |
| --- | --- |
| `GET /session` | Returns `{ "guest": null }` for an absent, invalid, or expired session. A valid response includes only `displayName` and `onboardingComplete`. Storage failures return an error. |
| `POST /session/bootstrap` | Sets or reissues a signed browser ticket. This step creates no workspace. |
| `POST /session/guest` | Requires the ticket, validates the name, and creates an empty workspace. A retry with the same ticket returns the existing profile. |
| `POST /session/leave` | Requires an exact allowed Origin and sends an empty `204` with an expired cookie at its original scope. Safe to repeat with or without a cookie. |
| `POST /session/onboarding-complete` | Saves the marker for the verified workspace. Repeated calls return the same confirmed state. |
| `/tasks`, `/tasks/:id`, `/garden`, `/garden/water` | Require a valid session and operate on its workspace only. |

The server derives the file name from a SHA-256 hash of the signed browser ticket. Task and garden writes share an atomic file replacement. The guest directory also contains the private signing key and must be backed up as a unit. A missing key with existing guest files prevents startup. Local and hosted startup use the guest API, which does not open or serve the legacy database. The original demo app factory remains available only for the existing in-process regression tests.

Starting another guest clears the active browser cookie. Angular waits for the leave response, then requires `GET /api/session` to return `200 {"guest":null}` before clearing the profile and showing the name form. The workspace route disposes its board, garden, and completion state. The old snapshot and signing key remain intact. Other open USAD tabs on that origin return to Welcome. A previously copied valid ticket remains subject to its original expiry. Display names cannot recover a ticket.

Garden levels are computed on read from the existing version 1 ledger as `min(10, 1 + floor(lifetime / 2))`. Existing guests can immediately see a more mature plant. Lifetime entries and watering IDs retain their bytes and available balances. No storage migration is required. A newly committed first completion returns a water receipt plus the confirmed lifetime. Only a matched, unconsumed receipt animates growth. Opening an old garden shows its settled stage. A pending watering ID is retained while the workspace is open, including navigation away from and back to the garden.


The server checks an exact `Origin` allowlist for writes independently of forwarded host headers. Hosted writes require `USAD_ALLOWED_ORIGINS` to list the confirmed HTTPS frontend origins. Preview deployments use their own explicitly allowlisted origins and separate guest volumes. The API emits no CORS permission and marks responses as private and non-cacheable. Validate the production browser’s cookie path against the Vercel URL, because the upstream API receives the path after prefix rewriting.

Payloads are limited to 16 KiB for JSON writes. Each workspace can hold 300 tasks, 3,000 distinct completion credits, and a 2 MiB snapshot. Guest names are limited to 32 Unicode code points and task field lengths match the composer, with a separate 512-character order rank limit. Workspace creation has a 60-per-10-minute service-wide limit and ticket issuance has a 240-per-minute limit. The volume holds up to 1,500 workspace snapshots, including expired ones. Plan to review capacity and back up the directory before removing expired guest files. Run one writer replica per volume.

## Appearance

Forest is the default. Blue Hour uses muted academic blues, and Warm Clay uses terracotta and cream. The palette roles live in `src/app/shared/appearance.css` and apply to the document root, including CDK overlays. Errors, priorities, and workflow statuses share semantic colors across palettes. The WebGL plant and the illustrated fallback share a flowering schedule, with the first buds at level 3 and the first open flower at level 4.

The browser stores the allowlisted theme ID under `usad.appearance` and the mode under `usad.appearance-mode`. The bootstrap script reads both before Angular renders. Defaults are Forest and System. If writing is unavailable, the selection still previews for the current visit. Appearance preferences are device-local.

## Manual release and rollback

1. Record the known-good Vercel deployment and Railway revision and variables. Verify a private Railway volume backup containing `/data/db.json` and all of `/data/guests`, including `.session-key`.
2. Use the [Railway settings](../README.md#host-the-api-on-railway) for a separate staging service with a disposable volume. Set `RAILWAY_DOCKERFILE_PATH=Dockerfile.railway`, `USAD_GUEST_DIR=/data/guests`, `USAD_DATA_FILE=/data/db.json`, and `USAD_ALLOWED_ORIGINS` to the exact staging Vercel HTTPS origin. Use one replica and Railway’s supplied `PORT`. Leave build and start overrides blank. For the isolated Vercel preview, change the `/api/:path*` destination in its deployment configuration to `https://<staging-railway-host>/:path*`. Keep the SPA fallback. Confirm this target before using the preview. The checked-in production rewrite points to Railway production. [Vercel rewrite documentation](https://vercel.com/docs/routing/rewrites)
3. On that HTTPS preview in Chrome, create a disposable guest and task and refresh. Confirm the same-origin request sets and sends a host-only `__Secure-usad_guest` cookie with `Secure`, `HttpOnly`, `SameSite=Lax`, and `Path=/api`. Verify leave gives `204` and expires the cookie at the same scope. The next session GET must give `200 {"guest":null}` without the old cookie, and a second leave must give `204`. Confirm that a mismatched Origin gives `403` without changing the cookie and that session responses are private and uncached.
4. Create a second guest and verify zero tasks and water and that the first guest’s files still match. Restart staging Railway with the same volume and verify the active session and both snapshots persist. Run the same preview flow on a touch viewport. Compare the garden credits and water history against a disposable copy of a pre-existing ledger.
5. After staging passes, release the approved frontend and backend together. Verify the actual production HTTPS origin against `USAD_ALLOWED_ORIGINS`, including any approved custom domain. Run a disposable smoke check after cutover.
6. If cutover fails, restore the paired known-good Vercel deployment and Railway image where they are compatible. Railway rollback also restores that deployment’s variables, so check the allowlist and storage paths. Keep the same mounted volume and preserve `/data/guests`, its signing key, and `/data/db.json`. If the only rollback API is the legacy shared unauthenticated API, use a maintenance response until a compatible pair is available. Do not replace live volume data during a code rollback. [Railway deployment rollback](https://docs.railway.com/deployments/deployment-actions#rollback)

## Staging commands

The allowlist below is the complete release manifest from baseline `588e755`. It includes deletion of `src/app/app.html` because the root component now uses an inline router outlet and `workspace.component.html` holds the workspace shell. Run the block from the repository root.

```bash
(
set -e
test "$(git branch --show-current)" = feature/usad-development
test "$(git rev-parse --short=7 HEAD)" = 588e755
git diff --cached --quiet
git switch -c staging/usad-guest-release
git add -- \
  .gitignore Dockerfile.railway Dockerfile.railway.dockerignore README.md data/garden.cjs \
  data/garden.test.cjs data/guest-api.cjs data/guest-api.test.cjs data/guest-storage.cjs data/server.cjs \
  docs/GUEST-EXPERIENCE.md package-lock.json package.json src/app/app.config.ts src/app/app.html \
  src/app/app.routes.ts src/app/app.spec.ts src/app/app.ts src/app/board/board.component.html \
  src/app/board/board.component.ts src/app/board/board.logic.spec.ts src/app/board/board.logic.ts \
  src/app/board/board.store.spec.ts src/app/board/board.store.ts src/app/board/card.component.ts \
  src/app/board/column.component.html src/app/board/column.component.ts src/app/board/task.service.ts \
  src/app/guest/entrance.css src/app/guest/entry-brand.component.ts \
  src/app/guest/guest-actions.component.ts src/app/guest/guest-flow.spec.ts \
  src/app/guest/guest-session.service.ts src/app/guest/guest.guards.ts \
  src/app/guest/onboarding.component.html src/app/guest/onboarding.component.ts \
  src/app/guest/welcome.component.html src/app/guest/welcome.component.ts \
  src/app/pages/botanical-growth.spec.ts src/app/pages/botanical-growth.ts \
  src/app/pages/deadlines.component.ts src/app/pages/garden.service.ts src/app/pages/home.component.html \
  src/app/pages/home.component.ts src/app/pages/plant.component.html src/app/pages/plant.component.ts \
  src/app/pages/progress.component.ts src/app/pages/specimen.ts src/app/pages/task-list.component.ts \
  src/app/shared/appearance-control.component.ts src/app/shared/appearance.css \
  src/app/shared/appearance.service.ts src/app/shared/appearance.spec.ts \
  src/app/shared/completion-motion.ts src/app/shared/dialogs.service.ts src/app/shared/icon.component.ts \
  src/app/shared/swipe-actions.component.ts src/app/shared/swipe-row.directive.ts \
  src/app/shared/task-actions.component.ts src/app/workspace.component.html \
  src/app/workspace.component.ts src/app/workspace.routes.ts src/index.html src/styles.css
git diff --cached --check
git diff --cached --name-status --no-renames
)
```

Review the staged list above before committing. It should contain 64 source, configuration, test, and documentation paths. Confirm the production deployment branches are `main` and pair the staging preview with its separate API and volume before testing it.

```bash
git commit -m "Stabilize USAD guest workspaces and session switching"
git push -u usad HEAD:refs/heads/staging/usad-guest-release
```
