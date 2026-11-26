# USAD release and deployment notes

## Production release · November 26, 2026

The Angular frontend and garden v3 API were successfully released from commit [`dc95f2200dda9b9cc541402b7e596f5ad9382676`](https://github.com/ccadaverr/usad/commit/dc95f2200dda9b9cc541402b7e596f5ad9382676).

| Platform | Deployment |
| --- | --- |
| Railway API | `b7bcf06c-17e3-48fb-b189-cbd8f3827847`. The approved Docker context was uploaded before the frontend cutover. |
| Vercel frontend | `dpl_4BKZVNHomqbjTXFoCEW2cMkhvHkj`. Vercel built the release commit after its fast-forward push to main. |

The release passed 116 Angular tests, 18 API tests, and the production build. A synthetic guest created before the API rollout retained its session and saved task across the cutover. Production browser verification covered creating and editing tasks, Board moves, deadlines, watering, task reversal, receipt replay, streaks, and reload.

**Recovery limitation.** There is currently no independently verified recoverable production guest-volume backup. At release time Railway listed no snapshots, and an attempted volume download stopped at SSH authentication before transferring files. The release proceeded with that recovery risk accepted.

## Hosting configuration

- **Vercel** builds the Angular app. The checked-in rewrite forwards `/api/:path*` to the production Railway API and falls back to `index.html` for SPA routes.
- **Railway** builds [`Dockerfile.railway`](../Dockerfile.railway) at the repo root with Node.js 22 and starts `npm run api` using the platform’s `PORT`. The production service has one writer on the volume mounted at `/data`.
- **Storage and origin** use `USAD_GUEST_DIR=/data/guests`. `USAD_ALLOWED_ORIGINS` is a comma-separated list of exact allowed HTTPS origins, including `https://ccadaverr-usad-blue.vercel.app`. Guest files and their signing key must stay together across restarts and releases.
- **Preview isolation** requires a separate API, volume and signing key, plus an explicitly replaced Vercel API rewrite. Verify the deployed routing before writing any test data through a preview.

## Compatibility and rollout

1. Verify the existing production volume and record the running deployment IDs. Before changing the API or its data format, verify a recoverable backup of the actual guest directory, including its signing key. Use disposable staging fixtures to rehearse migration, persistence, and restoration.
2. Roll out the compatible Railway API first on the same production mount with one writer. Verify an existing authorized smoke session and the v3 garden response through the public frontend origin before allowing Vercel to serve the matching frontend. Confirm automatic Git triggers for both hosts before pushing or promoting.
3. The v3 frontend depends on the API’s revision, active waterings, growth, streak, and confirmed receipt fields. An older frontend can use the overlapping contract during the short API-first interval. The v3 reader supports v1 and v2 on disk and preserves historical receipts.
4. Once the volume has v3 writes, use a v3-capable API for rollback or forward recovery. A code rollback keeps the current data volume. Restoring an earlier copy is a separate recovery decision that can discard later writes.

[Guest API and ledger details](GUEST-EXPERIENCE.md) · [Historical handoffs](archive/README.md)
