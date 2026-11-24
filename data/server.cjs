const { readFileSync, renameSync, rmSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const jsonServer = require('json-server');
const { gardenView, levelFor, reconcileGarden, spendWater } = require('./garden.cjs');

function writeSnapshot(file, snapshot) {
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(snapshot, null, 2) + '\n', { flush: true, mode: 0o600 });
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function createApp(file, persist = writeSnapshot) {
  const { garden: savedGarden, ...data } = JSON.parse(readFileSync(file, 'utf8'));
  let committed = structuredClone(data);
  let garden = reconcileGarden(savedGarden, data.tasks);

  const app = jsonServer.create();
  const router = jsonServer.router(data);
  app.use(jsonServer.defaults());
  app.use(jsonServer.bodyParser);

  // JSON Server 0.17 calls db.write synchronously before sending a CRUD response.
  // Commit task status and reward in one file replacement so no partial award is observable.
  router.db.write = () => {
    const pending = router.db.getState();
    const nextGarden = reconcileGarden(garden, pending.tasks);
    try {
      persist(file, { ...pending, garden: nextGarden });
    } catch (error) {
      router.db.setState(structuredClone(committed));
      throw error;
    }
    committed = structuredClone(pending);
    garden = nextGarden;
  };

  app.get('/garden', (_request, response) => response.json(gardenView(garden)));
  app.post('/garden/water', (request, response) => {
    const id = request.body?.id;
    if (typeof id !== 'string' || !/^[a-z\d-]{16,80}$/i.test(id)) {
      return response.status(400).json({ message: 'Invalid watering identifier.' });
    }
    const next = spendWater(garden, id);
    if (!next) return response.status(409).json({ message: 'No water drops available.' });
    if (next !== garden) {
      try {
        persist(file, { ...committed, garden: next });
      } catch {
        return response.status(503).json({ message: 'Could not save watering.' });
      }
      garden = next;
    }
    return response.json(gardenView(garden));
  });

  app.use((request, response, next) => {
    response.locals.previousGardenCount = garden.entries.length;
    next();
  });
  router.render = (request, response) => {
    const previousCount = response.locals.previousGardenCount;
    const count = garden.entries.length;
    if (request.method !== 'GET' && count > previousCount) {
      // These receipts describe an award only after the shared snapshot committed.
      response.set('X-USAD-Water-Earned', '1');
      const level = levelFor(count);
      if (level > levelFor(previousCount)) response.set('X-USAD-Garden-Level', String(level));
    }
    response.jsonp(response.locals.data);
  };
  app.use(router);
  return app;
}

if (require.main === module) {
  const file = resolve(process.argv[2] ?? (process.env.USAD_DATA_FILE || join(__dirname, 'db.json')));
  const port = Number(process.argv[3] ?? (process.env.PORT || 3000));
  const host = process.env.RAILWAY_ENVIRONMENT_ID ? '0.0.0.0' : '127.0.0.1';
  const server = createApp(file).listen(port, host, () => {
    console.log(`USAD API listening on ${host}:${server.address().port}`);
  });
}
module.exports = { createApp };
