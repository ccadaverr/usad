# USAD: A Web-Based Student Task Management and Progress Tracking System

**ᜂᜐᜇ᜔ · usad.**

Munting hakbang. Tunay na pag-usad. _Small steps. Real progress._

The Baybayin wordmark uses locally bundled Noto Sans Tagalog under the [SIL Open Font License](public/fonts/OFL.txt).

USAD is the Group 8 Student Task Tracker. It is a single-student workspace for assignments, deadlines, and completion. The board explores Angular CDK drag and drop across Pending, In Progress, and Completed.

## Run locally

Use Node.js 22.12 or later and Chrome for the headless tests.

```bash
npm ci
npm run api     # Terminal 1, JSON Server listens on 127.0.0.1:3000
npm start       # Terminal 2, open http://localhost:4200
```

On first run, the API creates `data/db.json` from `data/seed.json` with due dates relative to that day. Later runs keep the same records. Set `USAD_DATA_FILE` to use a different file for both seeding and serving. Back up `data/db.json` to keep a copy of your work. To replace the default local database with fresh examples, stop the API, run `npm run db:reset` with `USAD_DATA_FILE` unset, and restart the API.

Use `npm run api` to launch `data/server.cjs`, which provides the task and garden routes. If a legacy JSON Server process is already using port 3000, stop that process before starting the command. The garden ledger starts by counting currently completed records and is saved with the next successful write. Later Undo and deletion keep earned growth. Run the server regression checks with `npm run test:api`.

### Phone on the same Wi-Fi

1. Keep `npm run api` running.
2. Start Angular with `npm run start:lan` in place of `npm start`. To use another port, run `npm run start:lan -- --port 4220`.
3. Find the Mac’s Wi-Fi IPv4 address in System Settings → Wi-Fi → Details → TCP/IP. On most Macs, `ipconfig getifaddr en0` also displays it.
4. Open `http://<mac-wifi-ip>:4200` on the phone, or use the alternate Angular port from step 2.

Use a trusted development network. Anyone who can reach the Angular LAN server can write through its proxy. The local API listens only on loopback. Browser requests use the same origin under `/api`.

## Host the API on Railway

Use the existing Railway service from `ccadaverr/usad` on branch `feature/usad-development` with the repository root as its root directory. Set these values in the service settings and variables.

| Railway setting | Value |
| --- | --- |
| Builder | Dockerfile, selected by `RAILWAY_DOCKERFILE_PATH=Dockerfile.railway` |
| Custom build command | Leave blank and clear any existing Angular build command |
| Custom start command | Leave blank to use the Dockerfile command `npm run api` |
| Persistent volume mount | `/data` |
| Service variable | `USAD_DATA_FILE=/data/db.json` |
| Node.js version | 22, supplied by `Dockerfile.railway` |
| Port | Use Railway's provided `PORT` |
| Replicas | `1`, because the JSON store uses one writer process |

Look for `Using detected Dockerfile!` in the Railway build log. The image installs production dependencies and copies the task and garden API files. Vercel builds and hosts Angular. [Railway Dockerfile settings](https://docs.railway.com/builds/dockerfiles)

Railway supplies `RAILWAY_ENVIRONMENT_ID`, which makes the API bind to `0.0.0.0`. `npm run api` seeds at startup, after the volume is mounted, and only creates the database if it is missing. Verify the service with `GET /tasks` and `GET /garden` on its Railway domain. [Railway variables](https://docs.railway.com/variables/reference) · [Railway volumes](https://docs.railway.com/volumes) · [Railway networking](https://docs.railway.com/networking/troubleshooting/application-failed-to-respond)

The browser still uses same-origin `/api` URLs. Configure the Vercel rewrite after Railway assigns the API domain. This is a shared demo API without authentication. Anyone who can reach a public API domain can read and modify tasks, so use demo data there.

## Demo

1. Open **Home** to review the next task, today’s deadlines, overdue work, and the live completion count.
2. Choose **New task**. Submit the empty form to see validation. Enter a title, subject, due date, and priority, then create the task.
3. Open **Board**, search by title, and filter by priority or subject. Clear the filters to enable dragging. Open the task title to edit it.
4. On a phone, choose **Full board**. Hold the grip and move the card into **In Progress**. Scroll from the card body when browsing. The **Move to…** menu also changes stages. Refresh and select the new stage to verify it saved.
5. Move the task to **Completed** to see USAD Bloom. Check **Progress** for the new academic total and open **Tanim** for lifetime growth and water drops. Use **Undo** in the toast to restore the previous stage and order.
6. Stop the API and try to save a draft or refresh. Restart the API, select **Reload tasks**, and retry the save.

## API and tests

Angular strips `/api` when proxying requests to port 3000. Garden status is at `http://localhost:4200/api/garden` through Angular and `http://127.0.0.1:3000/garden` directly. Angular also proxies `/api/garden/water`, `/api/tasks`, and `/api/tasks/:id`. Supported operations are list and single-record **GET**, **POST**, **PATCH**, and **DELETE**. Browser refresh loads the database again. Task ordering is stored as a case-sensitive rank within each stage.

```bash
npm run build
npm run test:ci
npm run test:api
```

See the [implementation evidence ledger](docs/IMPLEMENTATION.md) for architecture and verification.

## Attribution

USAD is adapted from TaskFlow by tiennd03, whose README declares the MIT license. [TaskFlow source](https://github.com/tiennd03/taskflow) · [MIT license](LICENSE)
