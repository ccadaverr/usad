# USAD implementation evidence

> Historical record. For current setup, behavior, and hosting, see the [USAD README](../../README.md).

## Audit and changes

| Area | Files and decisions |
| --- | --- |
| Baseline | TaskFlow stored normalized cards and mutable columns in localStorage. The last column defined completion. The board content measured 1,536 px inside a 375 px viewport. The original form validated a title before trimming it. |
| App shell and routes | `src/app/app.ts`, `app.html`, `app.routes.ts`, and `app.config.ts` add a sticky contextual header, mobile bottom navigation, desktop sidebar, Angular Router, and HttpClient. |
| Board and task lifecycle | `src/app/board/board.*`, `column.component.*`, `card.component.ts`, `card-dialog.component.*`, and `task.service.ts` provide fixed stages, filters, persisted CRUD, status transitions, and a validated task form. The obsolete browser storage module was removed. |
| Routed components | `src/app/pages/` adds Home, Deadlines, Progress, and their shared task list. Home and Progress derive all counts from API records. Completed work is excluded from open deadline groups. |
| Shared UI and tokens | `src/app/shared/` contains the CDK dialog service, confirmation, and shared line icons. The former autofocus and color helpers were retired. `src/styles.css`, `src/index.html`, and `public/favicon.svg` carry the USAD identity. |
| Runtime and documentation | `data/seed.json`, `data/seed.mjs`, `proxy.conf.json`, `angular.json`, `package.json`, `package-lock.json`, `.gitignore`, `README.md`, and `LICENSE` define the API, commands, attribution, and local-only database. |
| Tests | `src/app/board/board.logic.spec.ts`, `board.store.spec.ts`, and `src/app/app.spec.ts` cover the revised model, HTTP, forms, routing, and CDK event handling. |

## API and workflow

| Request | Contract |
| --- | --- |
| `GET /api/tasks` | Read all tasks on load or retry. |
| `GET /api/tasks/:id` | Read one task by stable string ID. |
| `POST /api/tasks` | Create with a stable client-generated ID, append rank, and timestamps. |
| `PATCH /api/tasks/:id` | Update editable fields, status and rank as needed, plus `updatedAt`. |
| `DELETE /api/tasks/:id` | Delete the task after user confirmation. |

The development proxy removes `/api` and forwards to JSON Server on `127.0.0.1:3000`. The first launch creates the writable `data/db.json` with eight assignments and relative dates. Later launches use the existing file. Each record has `id`, `title`, `description`, `subject`, `priority`, `status`, `dueDate`, `order`, `createdAt`, and `updatedAt`. Dates use local calendar format and can be null. Timestamps are ISO strings.

SignalStore keeps one record per ID and derives each ordered column from status. Each move writes one case-sensitive fractional rank with its status, so a failed request cannot leave a multi-record reorder half applied. IDs break sort ties and each new rank has an independent suffix for concurrent writes into the same gap. Writes are serialized in the app. A failed write keeps the last confirmed state and requires an authoritative reload. A retried create reuses the draft ID after an ambiguous response. Previous TaskFlow localStorage is ignored.

A single `cdkDropListGroup` connects three status lists. Desktop lays them out horizontally. Mobile opens on a focused stage and can reveal all three as vertical drop targets. The drag uses a dedicated handle, a 160 ms touch delay, and a viewport boundary. Both native **Move to…** and CDK send status changes through the same store and API. Dragging pauses during filtering to keep drop indexes aligned with the stored order.

Angular coverage includes standalone components, interpolation, property and event bindings, two-way `ngModel` search, `@if`, `@for`, and `@switch`, injected services, HttpClient, RxJS Observables and `subscribe()`, typed Reactive Forms, and accessible CDK dialogs. Hick’s Law guided the focused stage view, Miller’s Law and Gestalt grouping guided the compact summaries and form fields, and Fitts’s Law guided the 44 px controls and mobile footer.

The Unslop, interface polish, and UX and backend laws skills informed the review. Impeccable was reviewed as a reference. The existing Tailwind 4 and CDK stack was sufficient after evaluating daisyUI 5. [Impeccable](https://github.com/pbakaus/impeccable) · [daisyUI Angular guide](https://daisyui.com/docs/install/angular/)

## Verification

- `npm ci` passed with 18 moderate audit findings. Existing dependency versions were retained.
- `npm run build` passed. `npm run test:ci` passed **32/32** in Chrome Headless. The 19-case baseline coverage was adapted where behavior changed. HTTP replaced localStorage assertions, subjects replaced free-form labels, and fixed stages replaced column deletion.
- `npm start -- --port 4230` and `npm run start:lan -- --port 4220` both served the eight API records through the development proxy.
- Rendered Chromium checks covered **320, 360, 375, 390, 430, 768, 1024, and 1440 px**. All four routes fit without horizontal page overflow. Checked active navigation, focused and full board layouts, modal viewport bounds, Escape and focus restoration, short-dialog scrolling, and mobile dock clearance. Captured and inspected representative routes and dialogs.
- Live HTTP and Chromium flows covered create, view, edit, delete, required fields, long title wrapping, search, priority and subject filters, Move to while filtered, desktop mouse reorder and cross-stage drag, and status and ordering after refresh. Checked live progress and completed-task deadline exclusion.
- Chromium touch emulation at **390 px** covered content swipe, the touch delay on the handle, a real cross-stage drag, viewport preview bounds, and refresh after the PATCH.
- Stopped and restarted JSON Server during an open form. The app kept the draft, surfaced the failure, and saved once after reload. Initial load with the API stopped also displayed a retry state. Verified the proxy on the Mac’s Wi-Fi IPv4 address and confirmed the API port rejected a direct LAN connection.
- JSON Server 1.0 beta accepted the host flag without binding to it. Switched to 0.17.4 and verified the actual listener at `127.0.0.1:3000`. Fresh initialization and repeat initialization were checked separately from the live workspace.
- Physical phone and Safari testing remain unverified. The workspace assumes one student and has no live synchronization between tabs or devices. LAN access uses Angular’s proxy and requires enabling LAN mode.

The upstream TaskFlow repository declares MIT in its README. USAD credits tiennd03 and includes the license text. [TaskFlow source](https://github.com/tiennd03/taskflow) · [License](../../LICENSE)


## Interaction and Munting Tanim pass

- Home now shows open counts, one next action and three agenda entries ordered by overdue, today and upcoming. Changes span Home, the shared task list, board card, app shell and CSS. Separate native buttons keep completion and opening details independent.
- The new TaskActionsComponent uses the existing SignalStore PATCH path. Confirmed transitions capture the previous status and rank for Undo. Milestone feedback is computed on confirmed upward completion transitions at 25%, 50%, 75% and 100%. Whole percentages use completed thresholds. Initial loads and decorative watering produce no milestone.
- Progress defers PlantComponent and dynamically imports the procedural Three.js specimen. Three.js and its development typings are pinned to 0.180.0. DPR is capped at 1.5. The scene draws on demand and disposes GPU resources on route exit. The SVG alternative uses the same five stages. Both reduced motion and WebGL unavailability were exercised.
- Interaction files include board.store.ts, board.store.spec.ts, app.spec.ts, task-actions.component.ts, close-dialog.ts, the task and confirmation dialogs, plant.component.ts, specimen.ts, progress.component.ts and the package manifests. Existing MIT attribution and Noto font licensing are documented above. Codex assisted with implementation and verification.
- The baseline build and 36 tests passed. Browser verification used a disposable JSON Server copy on port 3042 through Angular on port 4220. Checked all four routes at 320, 360, 375, 390, 430, 768, 1024 and 1440 px, dialog fit and focus, keyboard completion, error recovery, Undo, CRUD, filters, mouse reorder, emulated touch and refresh. Pointer rotation changed rendered pixels, tap watering made zero writes, and route exit triggered WebGL context loss. Physical-device GPU performance and Safari remain unmeasured.
- Final production build passed. Initial JavaScript and CSS grew from 527.06 kB to 544.57 kB across the whole refinement. The separate specimen chunk is 492.80 kB raw and 103.09 kB estimated transfer. The deferred Angular plant component adds 3.93 kB raw.
- Final Karma result was 39/39 passing. Chrome additionally verified all five fallback growth stages plus the empty collection using controlled GET responses. The live database changed during the session. All verification mutations targeted the disposable copy, and the live records were left as found.

## Editorial Home, directional gestures, and lifetime garden

- Home now leads with a linked live completion summary, one priority task, and a three-entry Agenda. The Baybayin identity remains in the shared shell. Agenda and Deadlines have separate completion targets and editing buttons. A reusable pointer directive locks the horizontal axis after intent is clear, then uses a width-based threshold and snaps back on cancellation. It applies outside the CDK Board.
- The shared floating action opens a responsive CDK composer. Pending and Medium are creation defaults. The composer adds saved-subject suggestions, Today and Tomorrow buttons, a native date picker, progressive disclosure for description, and visual viewport sizing. Existing edits and deletions use the same reactive form and task service. Board search reserves a stable filter-clear position.
- Progress presents live distribution and overdue work with a link to `/progress/garden`. The primary navigation marks Progress for that route. Munting Tanim uses an HTTP service, Angular signals, a lazy route, and a separately imported Three.js renderer with a ten-level procedural specimen and illustrated fallback.
- The JSON Server entry point adds `GET /api/garden` and `POST /api/garden/water`. Every first completion records the task ID in a versioned ledger. An optional watering operation ID marks a spent credit and makes retries idempotent. Task mutation and ledger changes share one synchronous, atomic JSON file replacement. A failed replacement rolls the in-memory database back. The migration imports only currently completed records, and the first successful write persists it. A lost response can be reconciled through existing reads and, for watering, by retrying the same operation ID. The local API expects one writer process per JSON database.
- The procedural artist code uses custom curved leaf blades, tapered stem segments, attached branches, lathed terracotta, and an adaptive orthographic camera. DPR is capped at 1.5. The renderer draws on demand, skips hidden or offscreen frames, and releases GPU resources and listeners on route exit. Both 2D alternatives retain server-backed progress and watering.
- Fitts’s law informed the floating action and completion hit areas. Hick’s law informed the one-priority Home. Jakob’s law informed the retained editing button, bottom navigation and native form controls. Status, failures and recovery stay visible through completion feedback, Undo and retries. Reduced motion preserves the same controls and removes decorative motion.
- Source changes cover the app shell and routes, Home, Progress, Deadlines, the shared task-list and deadline components, swipe and task actions, Board and dialog source, Garden service and specimen, API entry and regression checks, styles, test files, package scripts and README. The existing upstream MIT attribution and Baybayin font licensing remain documented. Codex assisted with implementation and verification.
- Baseline was 39/39 Angular tests with a 544.57 kB initial bundle. Final build passed at 572.64 kB initial and 147.12 kB estimated transfer. The lazy garden component is 9.32 kB raw. The lazy Three.js specimen is 510.62 kB raw and 107.60 kB estimated transfer. Final checks passed 43/43 Angular tests and 2/2 Node API tests.
- Chromium checked all five routes at 320, 360, 375, 390, 430, 768, 1024 and 1440 px. Interaction checks covered composer validation and dates, create/edit/delete, keyboard completion and Undo, swipe both directions and cancellation, vertical touch scroll, filter layout, desktop and touch CDK persistence, API disconnection and retry, watering failure and retry, and persistence after refresh. At 390 px all ten specimen levels produced distinct renders. Mouse and touch rotation, keyboard inspection, WebGL context release, no-WebGL fallback and reduced motion were exercised. The composer scrolled at a constrained height. Physical phones, native keyboards, Safari and device GPU timing remain unverified.
- All mutation tests used the disposable database and proxy on ports 3043 and 4220. The existing API process on port 3000 still returns 404 for the garden endpoint and requires a restart with the updated `npm run api` command. The live file was read for the baseline copy, and test fixtures were absent from it after verification.

## Garden navigation and USAD Bloom

- The garden 404 came from a legacy JSON Server CLI process. Replacing that process with `npm run api` restored the existing contract. Angular removes the `/api` prefix and sends `/garden` and `/garden/water` to `data/server.cjs`. The live process returned six available water drops, and its database checksum matched across restarts and read-only checks. All browser mutation checks used a disposable copy.
- `/garden` is the fifth primary destination. The old `/progress/garden` address redirects. Progress keeps academic figures and a garden link. Navigation, completion feedback and row reflow share small, time-limited motion and keep usable touch targets at 320 px.
- Task write receipts expose `X-USAD-Water-Earned: 1` when the same successful snapshot commits a new credit. SignalStore emits one confirmed transition event. The shell uses it to draw a check, reveal botanical accents and reflow rows. Anchored feedback identifies the outgoing task. The toast handles completion when a source has scrolled out of view or the featured task is immediately replaced. Reduced motion preserves the static confirmation and Undo.
- Files changed for this pass include the API entry point and garden tests, app shell and routing, Progress, completion SVG and motion, task service and store, task rows, shared icons, global styles, Angular tests and README. Renderer geometry and persisted garden rules continue to use the existing implementation.
- Baseline reverified at 43/43 Angular and 2/2 API tests. The final build passed at 580.18 kB initial and 149.15 kB estimated transfer. Final suites passed 47/47 Angular and 3/3 API tests. The restart regression reopens a persisted disposable ledger and repeats the same watering operation without spending twice.
- Chromium verified dock labels, active states and feedback at 320, 375, 390, 430, 768 and 1440 px. Browser checks exercised direct Garden refresh, the old-route redirect, water persistence, one-tap and swipe completion, swipe editing, completion via CDK and task editing, keyboard Undo, failed writes with authoritative retry, reduced motion, WebGL-unavailable fallback and context release on navigation. Physical-device and Safari checks remain open.
