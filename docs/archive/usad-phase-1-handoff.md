# USAD Phase 1 handoff

> Historical record. For current setup, behavior, and hosting, see the [USAD README](../../README.md).

Phase 1 establishes the shared task composer and workspace navigation for the Board and Deadlines work in Phase 2. Use the current local working tree as the starting point.

## Source baseline

The starting branch was `feature/usad-development`, tracking `usad/staging/guest-v1`, at `615019ff2b245df5d8af377cfc6f3a3dca3730d1`. There were 27 modified tracked files and five untracked files. The index had no staged changes and there were no deleted files. The baseline included guest persistence and onboarding, the personalized Home greeting and existing Deadlines changes, version-3 reward accounting, reversible entitlements, streaks, watering, growth, and rotation.

Phase 1 changed the following files. Five already contained local work. Their Phase 1 changes are limited to composer tests, Home start controls, task-list configuration, the workspace navigation map, and the shared styling covered here.

- `src/styles.css`
- `src/app/app.spec.ts`
- `src/app/board/card-dialog.component.ts`
- `src/app/board/card-dialog.component.html`
- `src/app/pages/home.component.ts`
- `src/app/pages/home.component.html`
- `src/app/pages/task-list.component.ts`
- `src/app/shared/close-dialog.ts`
- `src/app/shared/dialogs.service.ts`
- `src/app/shared/icon.component.ts`
- `src/app/workspace.component.ts`
- `docs/usad-phase-1-handoff.md`

## Design audit and tokens

The existing Georgia display type, system body type, paper surfaces, and theme-aware controls already set the visual direction. The main inconsistencies were the density of separate date and priority controls, the always-visible date input, differing Add and Edit behavior, and navigation feedback tied to a moving background. The composer now groups choice controls, uses the primary task name field to lead the form, and gives header, scrollable body, and footer distinct boundaries. Home allocates more width to the assignment text. Navigation uses consistent icon alignment and a small route marker.

| Role | Contract |
| --- | --- |
| Typography | Use `--display` for editorial headings, `--font-sans` for controls and metadata, and `--ink` / `--muted` for text hierarchy. Keep control labels in sentence case. |
| Surfaces | Use `--canvas` for the workspace and segmented-control tracks, `--paper` for panels and navigation, and `--white` for fields and secondary buttons. The token names reference roles in all three palettes and modes. |
| Controls | Use `.button`, `.button-primary`, `.button-secondary`, `.button-plain`, `.icon-button`, and `.field`. `--control-size` is 44px and `--radius-control` is 8px. The existing `--radius` remains 10px for surfaces. Use `--line` for dividers and `--line-control` for input boundaries. |
| Interaction | Use `--forest` with `--action-ink` for primary actions, `--hover` and `--selected` for quiet states, and `--focus` for focus indicators. Keep validation on `--error`. Apply `aria-current`, `aria-pressed`, or native checked state as appropriate. |
| Motion | `--motion-quick` is 140ms, `--motion-settle` is 220ms, and `--motion-dismiss` is 180ms. Use `--motion-ease` for arrivals and keep routine selections to short color transitions. Global reduced-motion rules shorten CSS motion, and `closeDialog` closes immediately when reduced motion is requested. |
| Theme and library | Keep theme roles on `:root` in `src/app/shared/appearance.css` so CDK overlays inherit them. Tailwind 4 and daisyUI 5 are already configured with `themes: false` and selected components. Pair `.btn` or `.input` with the existing USAD classes where applicable. |
| Navigation | `WorkspaceComponent.links` owns the five route destinations. `IconComponent` renders the nav family with a 24×24 viewBox, 1.65px round strokes, and `currentColor`. Display the glyphs at 22px. Keep visible text and RouterLinkActive's `aria-current="page"`. The bottom bar switches to the sidebar at 960px. |

## Composer and task contracts

- Call the workspace-provided `DialogsService.openTask(task?)` from Board and Deadlines. It opens the shared CDK composer with the workspace `BoardStore`, a labelled modal, a focus trap, and focus restoration. If a saved status change removes the opening row, focus moves to `#content`. The delete alert dialog opens above the composer so canceling preserves the draft.
- The sheet uses `.task-dialog-panel`, `.task-dialog`, `.dialog-heading`, `.dialog-body`, and `.dialog-footer`. It anchors to the bottom below 600px and centers at up to 32rem on larger screens. Keep the body as the scroll container and keep the header/footer outside it. Mobile adapts to `visualViewport` resize and scroll, honors the safe area, and opens on the heading for coarse pointers. Desktop focuses the task name.
- `closeDialog` holds the CDK trap through the 180ms dismissal. Open motion uses 220ms opacity and 20px upward travel on the sheet, or 10px on desktop. The task backdrop follows the same timing. Explicit Cancel, close, and Escape prompt before discarding meaningful changes. A backdrop click closes a clean form and leaves an edited form open.
- Required fields are task name (120 characters) and subject (60 characters). The saved subject list is a native datalist. Priority is a native Low/Medium/High radio group with Medium as the default. Edit includes a native Status control. `More details` keeps description (1,000 characters) in the form while collapsed.
- Task dates use local calendar math through `todayISO` and `localDate`. Pass a date as `YYYY-MM-DD` and an empty due date as API `null`. Today and Tomorrow select quick dates without exposing the input. Choose date reveals the native labelled field and keeps any selected value. Saved custom dates reopen there. Clear date returns focus to Choose date.
- `BoardStore.save` submits the persisted task and returns a confirmation boolean. Keep the draft ID stable through reload and retry. Save guards and disabled controls prevent duplicate submissions. On a failed write, leave the dialog open and retain the form. Reload tasks re-enables the retry path. Existing confirmed notices and reward receipts stay owned by the store and server.
- `TaskListComponent` accepts `showStart` and defaults it to `true`. Home Agenda passes `false`, while Deadlines keeps its current fallback. Both Home task titles open Edit, where Status → In Progress → Save changes is available from keyboard or mouse. Agenda preserves the swipe start and completion controls.

## Phase 2 integration

- Build the three-stage Board picker around `STATUSES`, `STATUS_LABELS`, and `BoardStore.move(id, status, index?)`. Keep drag/drop and the picker on the same write path so ordering, confirmation, undo, and reward accounting stay aligned. Keep `BoardStore.canWrite()` and the filtering restrictions for ranked drops.
- Reuse the composer for add/edit everywhere. Keep the Status control as the non-swipe Home fallback if the Board adds its own status picker.
- Reuse `DeadlineComponent`, local date helpers, and the existing `deadlineGroup` input for consistent deadline language. Keep the shared task edit row and completion action keyboard reachable.
- Continue using the shared surface and focus roles in Board and Deadlines. Keep the garden ledger, streak time zone, reward receipts, and Three.js interactions in their existing modules for Phase 3.

## Verification and evidence

Chrome 150.0.7871.125 ran against an isolated local API. Device settings covered 320×420, 375×568, 390×844, 430×650, 768×650, 1024×768, 1280×720, and 1440×900. At the two shortest widths, the form body scrolls and the footer remains within the visible viewport. Forest, Blue Hour, and Warm Clay passed layout checks and contrast measurements for the tested text, input borders, focus indicators, and action pairs. System mode was exercised in both light and dark.

The browser confirmed Home and Board creation, reopening a saved custom date, clearing it from Deadlines, retrying a failed write, focus containment and restoration, and Board drag/drop persistence. Touch checks confirmed Agenda swipe start and completion, Garden streak and watering, switching guests while preserving the original workspace, and swiping from the final tour slide into Home. Verification caught and resolved an invalid coarse-pointer focus target and a wrapped Edit footer at 320px.

The local Chrome evidence captured during this phase contains seven before/after comparisons and additional short-height and keyboard-inset views. Keyboard inset verification injected a smaller VisualViewport height and a nonzero offset into Chrome and exercised the real sheet and footer layout. Physical iOS and Android keyboard behavior remains unverified.

The focused Angular view suite passed with 23 tests. The final full Angular suite passed with 99 tests, and the API suite passed with 18 tests. The production build, `git diff --check`, and Node syntax checks for the local API modules passed. The package has no lint script.

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
 M src/app/pages/plant.component.html
 M src/app/pages/plant.component.ts
 M src/app/pages/specimen.ts
 M src/app/pages/task-list.component.ts
 M src/app/workspace.component.html
 M src/app/workspace.component.ts
 M src/styles.css
?? docs/usad-coordinated-release.md
?? src/app/pages/plant.component.spec.ts
?? src/app/pages/streak-fruit.ts
?? src/app/pages/watering-can.ts
?? src/app/pages/watering-motion.ts
```
