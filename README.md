# USAD
### The Art of Making Progress

**ᜂᜐᜇ᜔ · Munting hakbang. Tunay na pag-usad.**

*Small steps. Real progress.*

USAD is a Filipino-inspired productivity app for students. Keep assignments, deadlines, and academic progress in one workspace, then water a small interactive garden with drops earned by finishing tasks.

**Developed and maintained by Jaztin**

**[Open the live application](https://ccadaverr-usad-blue.vercel.app)**

## Mobile showcase

<table align="center">
  <tr>
    <td align="center">
      <a href="docs/screenshots/welcome.webp"><img src="docs/screenshots/welcome.webp" width="98" height="212" alt="USAD welcome screen with Baybayin branding, a botanical illustration, and guest entry"></a>
      <br><sub><strong>Welcome</strong></sub>
    </td>
    <td align="center">
      <a href="docs/screenshots/home.webp"><img src="docs/screenshots/home.webp" width="98" height="212" alt="Mobile Home showing the next priority and agenda for a sample guest"></a>
      <br><sub><strong>Home</strong></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <a href="docs/screenshots/board.webp"><img src="docs/screenshots/board.webp" width="98" height="212" alt="Mobile Board in Focused View with the In Progress stage selected"></a>
      <br><sub><strong>Board</strong></sub>
    </td>
    <td align="center">
      <a href="docs/screenshots/deadlines.webp"><img src="docs/screenshots/deadlines.webp" width="98" height="212" alt="Mobile Deadlines with assignments grouped by urgency"></a>
      <br><sub><strong>Deadlines</strong></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <a href="docs/screenshots/progress.webp"><img src="docs/screenshots/progress.webp" width="98" height="212" alt="Mobile Progress showing the completion ring and counts by stage"></a>
      <br><sub><strong>Progress</strong></sub>
    </td>
    <td align="center">
      <a href="docs/screenshots/munting-tanim.webp"><img src="docs/screenshots/munting-tanim.webp" width="98" height="212" alt="Mobile Munting Tanim showing the potted plant, watering can, and water balance"></a>
      <br><sub><strong>Munting Tanim</strong></sub>
    </td>
  </tr>
</table>

Open any preview to see the full 390 × 844 capture. The screenshots use fictional coursework in a disposable local workspace.

## About USAD

USAD brings a Filipino perspective to student task management. Baybayin appears in the wordmark. Munting Tanim gives completed work a visible effect as students earn water and care for a plant over time.

- **Home** highlights the next priority and upcoming work in a daily agenda.
- **Board** lets students create and edit assignments and move them through Pending, In Progress, and Completed using drag-and-drop or the **Move to** picker.
- **Deadlines and Progress** group open assignments by urgency and summarize completion across the workspace.
- **Munting Tanim** turns first completions into water drops. Confirmed watering grows the specimen, and daily completion streaks appear as fruit.
- **Guest workspace** keeps tasks and garden state on the server, scoped to a signed browser session. Appearance preferences stay in the browser.
- **Appearance** offers Forest, Blue Hour, and Warm Clay in light, dark, or system mode. The interface adapts to desktop and mobile.

## Technology

| Area | Tools |
| --- | --- |
| Frontend | Angular 20, TypeScript, Angular CDK, NgRx SignalStore, Tailwind CSS 4, daisyUI 5 |
| Interactive graphics | Three.js with an SVG fallback |
| Backend | Node.js, JSON Server, persistent JSON files scoped to each guest |
| Hosting | Vercel frontend, Railway API and persistent volume |

## Getting started

Use Node.js 22 and npm. Clone the repository and install its locked dependencies.

```bash
git clone https://github.com/ccadaverr/usad.git
cd usad
npm ci
```

Start the API in one terminal and Angular in a second.

```bash
npm run api   # terminal 1 · 127.0.0.1:3000
npm start     # terminal 2 · localhost:4200
```

Open [localhost:4200](http://localhost:4200) and choose **Continue as Guest**. The Angular development proxy forwards `/api` to the loopback API and strips the prefix. Local guest files are stored under `data/guests/` by default. Set `USAD_GUEST_DIR` to a disposable directory when collecting screenshots or doing manual mutation tests. A hosted preview uses the checked-in production API rewrite unless its deployment configuration explicitly replaces it.

## Architecture

The Angular views share a SignalStore for tasks and Board state. The browser calls the same-origin `/api` routes. The Node API checks the signed guest cookie and owns each workspace’s task and garden state. Task and garden changes are saved together by atomically replacing that guest’s JSON file.

[Implementation overview](docs/IMPLEMENTATION.md) · [Guest API and garden contract](docs/GUEST-EXPERIENCE.md) · [Deployment and release record](docs/usad-coordinated-release.md) · [Historical notes](docs/archive/README.md)

## Testing

Install Chrome to run the Angular suite. If it is outside the default search path, point `CHROME_BIN` to the executable.

```bash
npm run test:ci
npm run test:api
npm run build
```

The API test suite uses temporary local workspaces. [GitHub Actions workflow](.github/workflows/ci.yml)

## Developer and maintainer

Hi, I’m **Jaztin**, the developer and maintainer of USAD and a third-year Information Technology student at **Dr. Yanga's Colleges, Inc.**

USAD started as an academic requirement for our Professional Elective subject. I kept working on it beyond the course requirement because I wanted to make something other students could genuinely use. Building USAD gave me a way to explore how managing assignments, seeing progress, and caring for Munting Tanim could make everyday academic work feel more meaningful.

The application is deployed and usable. It’s an independent student project that I improve from time to time as I keep learning.

## Credits and license

USAD incorporates MIT-licensed work. See the [MIT license](LICENSE) and [acknowledgements](docs/ACKNOWLEDGEMENTS.md) for upstream and font attribution.
