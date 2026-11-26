# USAD Phase 3 and final acceptance

## Baseline and scope

Phase 3 began on `feature/usad-development` at `615019ff2b245df5d8af377cfc6f3a3dca3730d1`. The starting tree had 37 modified tracked files, nine untracked files, an empty index, and no deletions. All 46 starting files remain present. Thirty-five match the starting snapshot byte for byte. The other eleven contain targeted Phase 3 edits. The actual pre-edit suites passed with 109 Angular tests and 18 API tests.

The original Chrome view devoted space to Back to Progress, repeated reward instructions, lifetime completion text, and a progress meter. Watering and rotation shared one plant hit area. Phase 3 removes those controls and copy, keeps the existing Garden ledger and rendering assets, and separates rotation from watering. The paper stage centers the larger specimen and can. Compact level, botanical name, and streak typography sit below the scene. The final onboarding slide directs users to tap the can.

## Garden contracts

- The native watering button overlays the resting can and its adjacent `×N` count. It has a 164×58px target, visible keyboard focus, and an accessible name reporting available drops. `N` comes from the last confirmed `GardenState.available`. Saving, animation, and definitive empty states guard writes, while an uncertain operation can be replayed at zero available drops.
- One procedural Three.js group stays visible at rest and during the pour. The renderer maps the DOM control center into the current orthographic camera. After confirmation, the group rises to the right, tilts, emits spout-aligned droplets, and returns upright to the same screen anchor. Soil impacts initiate the stem, leaf, branch, bud, and flower transitions. The existing sequence lasts 2,480ms. The SVG fallback uses one persistent can group and the same timing.
- Plant rotation has its own focusable slider with horizontal drag and arrow keys. Vertical touch movement can scroll the page. The can sits outside the plant pivot and has the native button click path for mouse, touch, Enter, and Space. Watering leaves the rotation angle intact.
- The Three.js scene draws on demand. It caps DPR at 1.5, pauses draws offscreen or in a hidden tab, and disposes meshes, materials, textures, watchers, and listeners. The SVG stays visible until the first successful WebGL frame. Reduced motion presents the confirmed final illustration immediately.
- Streaks and full counts stay server-authoritative. Fruit positions use the existing attachment logic and four-fruit render cap. A streak-only revision reconciles the fruit without replaying the watering sequence. The release keeps the v3 reader, v1/v2 migration, existing signed guest sessions, same-ID watering receipts, and reversible entitlements. See the [release manifest and coordinated rollout](usad-coordinated-release.md).

## Final verification

| Check | Result |
| --- | --- |
| Production build | Passed |
| Angular baseline and final | 109 baseline, 112 final. All passed. |
| API baseline and final | 18 baseline, 18 final. All passed against disposable storage. |
| Node syntax and `git diff --check` | Passed |
| Lint | No lint script is configured. |

Installed Chrome 150.0.7871.125 checked WebGL and the can at 320×420, 375×568, 390×844, 430×650, 768×650, 1024×768, 1280×720, and 1440×900. Forest, Blue Hour, and Warm Clay passed the tested text and focus contrast checks in Light, Dark, and System, including both System color schemes. Touch ran in Chrome device emulation, and headless WebGL used software rendering. Physical handset and hardware-GPU performance remain unverified.

- Garden browser checks confirmed `×2 → ×1 → ×0`, no empty spend, pointer and keyboard isolation, wraparound rotation, stable orientation through watering, the upright return anchor, fallback droplets and ripples, and reduced-motion final state. The tests exercised 503 rejection, a committed write with a lost response, same-ID replay, and navigation and refresh during animation. A local historical fixture verified four rendered fruits, a mature specimen at 320px, and spent-growth and streak reversal. Visual inspection caught and resolved the low-height tablet fit issue and the pot occluding the can during its return. An automated regression covers the second click after a fast reduced-motion confirmation.
- Cross-screen Chrome acceptance covered guest setup and switching, all three onboarding slides, the last-slide swipe, Home and its first task and Agenda swipe, composer date and priority handling, cancellation, failure recovery, and simulated visual-viewport keyboard insets. It also covered all six Board moves, cross-tab deletion, filtering, reordering, drag/drop, Deadlines edits and date boundaries, Progress percentages, Appearance, and guest confirmation. The onboarding copy now points to the can.
- The [Chrome evidence archive](../.playwright-mcp/usad-phase3/usad-phase3-chrome.zip) contains inspected baseline, mobile, desktop, short viewport, lift, pour, impact, return, level transition, mature fruit, fallback, palette, error, and cross-screen images.

## Release assessment

The local candidate passes acceptance and is ready for a coordinated staging rehearsal and project-manager review. Production promotion depends on confirmation of the running Railway revision, a recoverable volume and signing-key backup, and a paired staging rehearsal. The [coordinated release manifest](usad-coordinated-release.md) enumerates all 47 accumulated paths. The working tree and index remain local.

## Phase 3 files

- `src/app/app.spec.ts`
- `src/app/guest/onboarding.component.html`
- `src/app/guest/onboarding.component.ts`
- `src/app/pages/plant.component.html`
- `src/app/pages/plant.component.ts`
- `src/app/pages/plant.component.spec.ts`
- `src/app/pages/specimen.ts`
- `src/app/pages/watering-can.ts`
- `src/app/pages/watering-motion.ts`
- `src/styles.css`
- `docs/usad-coordinated-release.md`
- `docs/usad-phase-3-handoff.md`

## Original working-tree inventory

```text
## feature/usad-development...usad/staging/guest-v1
 M data/garden.cjs
 M data/garden.test.cjs
 M data/guest-api.cjs
 M data/guest-api.test.cjs
 M data/guest-storage.cjs
 M data/server.cjs
 M src/app/app.spec.ts
 M src/app/board/board.component.html
 M src/app/board/board.logic.spec.ts
 M src/app/board/board.store.spec.ts
 M src/app/board/board.store.ts
 M src/app/board/card-dialog.component.html
 M src/app/board/card-dialog.component.ts
 M src/app/board/card.component.ts
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
 M src/app/shared/deadline.component.ts
 M src/app/shared/dialogs.service.ts
 M src/app/shared/icon.component.ts
 M src/app/workspace.component.html
 M src/app/workspace.component.ts
 M src/styles.css
?? docs/usad-coordinated-release.md
?? docs/usad-phase-1-handoff.md
?? docs/usad-phase-2-handoff.md
?? src/app/board/board-move-dialog.component.html
?? src/app/board/board-move-dialog.component.ts
?? src/app/pages/plant.component.spec.ts
?? src/app/pages/streak-fruit.ts
?? src/app/pages/watering-can.ts
?? src/app/pages/watering-motion.ts
```
