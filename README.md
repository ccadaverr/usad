# USAD: A Web-Based Student Task Management and Progress Tracking System

**ᜂᜐᜇ᜔ · usad.**

Munting hakbang. Tunay na pag-usad. _Small steps. Real progress._

The Baybayin wordmark uses locally bundled Noto Sans Tagalog under the [SIL Open Font License](public/fonts/OFL.txt).

USAD is the Group 8 Student Task Tracker. Each guest gets a browser-specific workspace for assignments, deadlines, and completion. The board explores Angular CDK drag and drop across Pending, In Progress, and Completed.

## Run locally

Use Node.js 22.12 or later and Chrome for the headless tests.

```bash
npm ci
npm run api:dev # Terminal 1, guest API listens on 127.0.0.1:3000
npm start       # Terminal 2, open http://localhost:4200
```

Open the welcome page to create a guest workspace or return to an existing one. A new guest starts with an empty board and a seedling. The session lasts 30 days from issue in the same browser and host. Clearing cookies, using a different browser, or letting the session expire requires a new workspace. The display name cannot recover a previous workspace. Use **Guest workspace** in the header to return to Welcome. **Start another guest** clears this browser’s active cookie after confirmation and preserves the saved workspace. The next name creates a separate board and garden.

The API saves workspaces and a signing key under `data/guests/` by default. Set `USAD_GUEST_DIR` to choose a storage directory outside the repository. `USAD_DATA_FILE` determines the parent directory when `USAD_GUEST_DIR` is unset. The API startup leaves the legacy `data/db.json` alone. The old demo seed and reset scripts are separate from the guest API.

`npm run api:dev` restarts Node when an API module changes. If port 3000 already has a USAD listener from `npm run api`, stop that listener before starting watch mode. An older API can return a valid session profile and still return `404 Route not found` when you confirm **Start fresh**. Check the listener with `lsof -nP -iTCP:3000 -sTCP:LISTEN`, restart it, and use **Retry** in the same dialog. A fresh Chrome profile at `http://localhost:4200` should get `200 {"guest":null}` from `/api/session`.

Use **Appearance** in the workspace header to choose Forest, Blue Hour, or Warm Clay. The preference follows the browser across USAD pages on the same host. It is stored on the device and is independent of the guest session.

### Phone on the same Wi-Fi

1. Keep `npm run api:dev` running.
2. Start Angular with `npm run start:lan` in place of `npm start`. To use another port, run `npm run start:lan -- --port 4220`.
3. Find the Mac’s Wi-Fi IPv4 address in System Settings → Wi-Fi → Details → TCP/IP. On most Macs, `ipconfig getifaddr en0` also displays it.
4. Open `http://<mac-wifi-ip>:4200` on the phone, or use the alternate Angular port from step 2.

Use a trusted development network. The local API listens on loopback. For LAN mode or a different Angular port, set `USAD_ALLOWED_ORIGINS` to the exact frontend URLs, such as `http://localhost:4200,http://192.168.1.20:4200`, before starting the API. Browser requests use the same origin under `/api`.

## Host the API on Railway

Use `ccadaverr/usad` with the repository root as the Railway root directory. Use `main` for the approved production release and a separate Railway service and volume for the staging branch. Set these values in the service settings and variables.

| Railway setting | Value |
| --- | --- |
| Builder | Dockerfile, selected by `RAILWAY_DOCKERFILE_PATH=Dockerfile.railway` |
| Custom build command | Leave blank and clear any existing Angular build command |
| Custom start command | Leave blank to use the Dockerfile command `npm run api` |
| Persistent volume mount | `/data` |
| Storage location | `USAD_GUEST_DIR=/data/guests` and `USAD_DATA_FILE=/data/db.json` |
| Allowed frontend origin | `USAD_ALLOWED_ORIGINS=https://ccadaverr-usad-blue.vercel.app` for the documented production domain. In staging use the exact HTTPS Vercel preview origin. Use comma-separated exact origins for additional approved domains. |
| Node.js version | 22, supplied by `Dockerfile.railway` |
| Port | Use Railway's provided `PORT` |
| Replicas | `1`, because the JSON store uses one writer process |

Look for `Using detected Dockerfile!` in the Railway build log. The image installs production dependencies and copies `server.cjs`, `guest-api.cjs`, `guest-storage.cjs`, and `garden.cjs`. Vercel builds and hosts Angular. [Railway Dockerfile settings](https://docs.railway.com/builds/dockerfiles)

Railway supplies `RAILWAY_ENVIRONMENT_ID`, which makes the API bind to `0.0.0.0`. At startup the API opens the guest storage directory after the volume is mounted. The Docker image contains only runtime source and dependencies. [Railway variables](https://docs.railway.com/variables/reference) · [Railway volumes](https://docs.railway.com/volumes) · [Railway networking](https://docs.railway.com/networking/troubleshooting/application-failed-to-respond)

The existing Vercel rewrite preserves the public `/api` URL and strips that prefix before forwarding to Railway. The guest session cookie is host-only, `HttpOnly`, `SameSite=Lax`, scoped to `/api`, and `Secure` in hosted mode. Review the [guest API and release checklist](docs/GUEST-EXPERIENCE.md) before cutting over the live service.

## Demo

1. On **Welcome**, create a guest workspace and take or skip the tour. Open **Home** to review the next task, today’s deadlines, overdue work, and the live completion count.
2. Choose **New task**. Submit the empty form to see validation. Enter a title, subject, due date, and priority, then create the task.
3. Open **Board**, search by title, and filter by priority or subject. Clear the filters to enable dragging. Open the task title to edit it.
4. On a phone, choose **Full board**. Hold the grip and move the card into **In Progress**. Scroll from the card body when browsing. The **Move to…** menu also changes stages. Refresh and select the new stage to verify it saved.
5. Move the task to **Completed** to see USAD Bloom. Check **Progress** for the new academic total and open **Tanim** for lifetime growth and water drops. Use **Undo** in the toast to restore the previous stage and order.
6. Stop the API and try to save a draft or refresh. Restart the API, select **Reload tasks**, and retry the save.

## API and tests

Angular strips `/api` when proxying requests to port 3000. Garden status is at `http://localhost:4200/api/garden` through Angular and `http://127.0.0.1:3000/garden` directly. Angular also proxies `/api/garden/water`, `/api/tasks`, and `/api/tasks/:id`. A verified guest session is required for task and garden routes. Task operations are list and single-record **GET**, **POST**, **PATCH**, and **DELETE**. Browser refresh loads the database again. Task ordering is stored as a case-sensitive rank within each stage.

```bash
npm run build
npm run test:ci
npm run test:api
```

See the [implementation evidence ledger](docs/IMPLEMENTATION.md) for architecture and verification.

## Attribution

USAD is adapted from TaskFlow by tiennd03, whose README declares the MIT license. [TaskFlow source](https://github.com/tiennd03/taskflow) · [MIT license](LICENSE)
