# USAD implementation overview

## Frontend

| Area | Responsibility |
| --- | --- |
| [App routes](../src/app/app.routes.ts) and [workspace](../src/app/workspace.component.ts) | Guest entry, onboarding guards, navigation, and workspace-scoped services |
| [Board](../src/app/board/) | Task validation, filters, CDK drag-and-drop, the **Move to** dialog, and the SignalStore shared across workspace views |
| [Pages](../src/app/pages/) | Home and Agenda, open deadline groups, academic progress, and Munting Tanim |
| [Shared controls](../src/app/shared/) | CDK dialogs and focus restoration, task gestures, icons, and accessible appearance controls |

The Board uses three fixed stages: Pending, In Progress, and Completed. Drag-and-drop and the **Move to** picker persist through the same task service. A task move carries its status and fractional rank together. The UI applies the write result after confirmation and reloads authoritative state when a result is uncertain.

Deadline grouping uses local calendar dates. Completed tasks stay in the Board and Progress statistics and are excluded from open deadline groups. Appearance overrides are browser-local, while tasks and the garden come from the guest API.

## API and persistence

[The Node entry point](../data/server.cjs) starts the [guest API](../data/guest-api.cjs). The Angular [development proxy](../proxy.conf.json) and [Vercel rewrites](../vercel.json) expose the same-origin browser paths under `/api` and strip that prefix before forwarding to Node.

[Guest storage](../data/guest-storage.cjs) verifies the browser ticket and reads a single workspace. Task mutations and [garden changes](../data/garden.cjs) are saved together by atomic file replacement. Production uses one writer on the Railway volume.

The garden loads its Three.js specimen when needed. Confirmed watering receipts drive the visual transition, including the SVG fallback. Reduced-motion users see the settled state. A lost response can be retried with the same watering operation ID.

See the [guest API contract](GUEST-EXPERIENCE.md) for endpoint and ledger behavior, the [release record](usad-coordinated-release.md) for deployment and compatibility, and the [archive](archive/README.md) for earlier design decisions.
