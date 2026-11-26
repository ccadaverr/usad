# USAD Phase 2 handoff

Phase 2 covers Board workflow and Deadlines. Continue from this local working tree for Phase 3.

## Source baseline

The starting branch was `feature/usad-development`, tracking `usad/staging/guest-v1`, at `615019ff2b245df5d8af377cfc6f3a3dca3730d1`. The original tree contained 33 modified tracked files and six untracked files, with an empty index and no deletions. The inventory below includes Phase 1, guest-specific persistence and onboarding, and the reversible garden ledger, streaks, growth, watering, and rotation. Six of those files received targeted Phase 2 changes. The other 33 matched the baseline byte for byte.

## Audit and implementation

| Finding | Change |
| --- | --- |
| The Board card opened a native select popup, with limited context about the task and destination. | A workspace CDK dialog shows the exact task title, live stage names and counts, the current stage, and explicit destinations. The three lanes are horizontal from 600px and stack on smaller sheets. |
| Board cards led with the subject and used three competing priority treatments. | The title leads, followed by the subject, deadline, and quieter priority text. Move to and Complete have their own action space. The stage heading and count align across columns while drag handles remain available. |
| Deadlines repeated dates in multiple rows and used a blank date tile for undated tasks. The page heading was visually hidden on mobile. | The page has a visible title and compact highest-urgency summary. Overdue rows pair the local date with days overdue. Today, Tomorrow, and Upcoming carry dates in headings, and undated rows have no date tile. |
| The empty Deadlines view had two task-creation actions. | The summary uses one action into the existing composer while the workspace is empty. Populated Deadlines retains the shared New task action. |

## Contracts to preserve

- `DialogsService.openTask` and `openMove` share one workspace dialog lock. `BoardMoveDialogComponent` receives a task ID and title fallback, reads the workspace's existing `BoardStore`, and calls `BoardStore.move(taskId, destination)` without an index. It reads full counts from `columns()`, independent of search and filters. Drag/drop still uses the indexed move path and honors filtering restrictions.
- The current stage is a disabled control. A requested destination shows **Moving…** while the write is pending. The existing store announces confirmed success and reconciles a lost or rejected response through Reload tasks before enabling a retry. The picker reads changing status and deletion from the shared store. Cancel, Escape, and backdrop dismissal are available while idle. Focus starts on the heading and returns to the opener on cancel or the visible moved card on success, with the active stage switcher, search, and main content as fallbacks.
- The picker shares the Phase 1 `.task-dialog-panel`, `.task-dialog`, `.dialog-heading`, `.dialog-body`, `.dialog-footer`, and backdrop. It uses the same 600px positioning breakpoint, paper surface, focus trap, safe-area padding, and 220ms entry / 180ms exit. It adds a 40rem desktop width and preserves the 44px minimum target and 8px control corner tokens. CDK card settling uses the existing 220ms motion token. The reduced-motion preference still takes precedence.
- `groupDeadlines()`, date-only ISO values, and stored order are unchanged. Deadlines derives chronological headings from `store.deadlines().upcoming`. `TaskListComponent.deadlineGroup` activates a compact Deadline row. Default task-list layout, dates, and actions are still used by Home and Progress. `DeadlineComponent.dateFormat` defaults to `MMM d`. Overdue Deadline rows pass `MMM d, y`.
- Deadlines keeps swipe and Complete. Edit → Status gives keyboard and mouse users the same non-swipe route into In Progress. The summary action focuses and scrolls to the target section without changing the route. Board and Deadlines continue to use the same Add/Edit Task composer.

## Phase 3 integration

- Keep the existing workspace themes and tokens on the document root so Angular CDK overlays, navigation, the Garden, and native controls inherit them. Use `--paper`, `--canvas`, `--ink`, `--muted`, `--line`, `--focus`, `--control-size`, and `--radius-control` for shared UI. Retain the shared motion timings for UI chrome while preserving the Garden’s existing animation timing.
- Use the server-authoritative balance for the watering-can counter. Keep `GardenService` retry IDs and request reconciliation, `BoardStore` completion and garden invalidation events, and the v3 ledger's reversible reward entitlements. A task leaving Completed may revoke an unspent drop, spent growth, or streak entitlement. Returning to Completed must reuse the existing entitlement.
- Keep keyboard and touch access to the Garden and preserve the existing rotation control independent of watering. Verify both the fallback rendering and the Three.js specimen when making visual changes.

## Verification

- The focused Angular run passed 50 tests. The full suite passed 109 tests, up from the Phase 1 baseline of 99. The API suite passed 18 tests, matching Phase 1. The production build, Node syntax checks, and `git diff --check` passed.
- Installed Chrome 150.0.7871.125 passed at 320×420, 375×568, 390×844, 430×650, 768×650, 1024×768, 1280×720, and 1440×900. The picker fits all three stages and Cancel at 320×420 for the reference task. Forest, Blue Hour, and Warm Clay passed the measured contrast and layout checks in Light, Dark, and System. System mode was checked against both color schemes.
- Mouse, keyboard, and emulated touch runs covered each stage transition, a server rejection, a committed write with a lost response, duplicate action, cross-tab deletion, drag/drop and reordering, filters, focus restoration, and reduced motion. Completion, undo, watering, and reversing a spent reward were checked against the disposable API. Guest switching preserved the first guest’s data.
- Deadline checks covered editing dates and statuses, completion, local date grouping at DST and year boundaries, and long titles and empty lanes. Home Agenda’s before and after PNGs are byte-identical. The shared composer still opens from Board and Deadlines.
- Visual review caught a clipped lane border at 320×420, a redundant create action on empty Deadlines, and an edit affordance hidden by a shared narrow-width rule. The final rendered states resolve all three. Touch was exercised through Chrome device emulation. Physical handsets were outside this run.

The [Chrome evidence archive](../.playwright-mcp/usad-phase2/usad-phase2-chrome.zip) contains five baseline views and 11 inspected final screenshots, including the two dark-mode views.

## Files changed

- `src/app/app.spec.ts`
- `src/app/board/board-move-dialog.component.html`
- `src/app/board/board-move-dialog.component.ts`
- `src/app/board/board.component.html`
- `src/app/board/board.logic.spec.ts`
- `src/app/board/card.component.ts`
- `src/app/pages/deadlines.component.ts`
- `src/app/pages/task-list.component.ts`
- `src/app/shared/deadline.component.ts`
- `src/app/shared/dialogs.service.ts`
- `src/app/workspace.component.html`
- `src/styles.css`
- `docs/usad-phase-2-handoff.md`

## Original working tree inventory

```text
## feature/usad-development...usad/staging/guest-v1
 M data/garden.cjs
 M data/garden.test.cjs
 M data/guest-api.cjs
 M data/guest-api.test.cjs
 M data/guest-storage.cjs
 M data/server.cjs
 M src/app/app.spec.ts
 M src/app/board/board.store.spec.ts
 M src/app/board/board.store.ts
 M src/app/board/card-dialog.component.html
 M src/app/board/card-dialog.component.ts
 M src/app/board/task.service.ts
 M src/app/guest/entrance.css
 M src/app/guest/guest-flow.spec.ts
 M src/app/guest/guest-session.service.ts
 M src/app/guest/onboarding.component.html
 M src/app/guest/onboarding.component.ts
 M src/app/pages/botanical-growth.spec.ts
 M src/app/pages/botanical-growth.ts
 M src/app/pages/deadlines.component.ts
 M src/app/pages/garden.service.ts
 M src/app/pages/home.component.html
 M src/app/pages/home.component.ts
 M src/app/pages/plant.component.html
 M src/app/pages/plant.component.ts
 M src/app/pages/specimen.ts
 M src/app/pages/task-list.component.ts
 M src/app/shared/close-dialog.ts
 M src/app/shared/dialogs.service.ts
 M src/app/shared/icon.component.ts
 M src/app/workspace.component.html
 M src/app/workspace.component.ts
 M src/styles.css
?? docs/usad-coordinated-release.md
?? docs/usad-phase-1-handoff.md
?? src/app/pages/plant.component.spec.ts
?? src/app/pages/streak-fruit.ts
?? src/app/pages/watering-can.ts
?? src/app/pages/watering-motion.ts
```
