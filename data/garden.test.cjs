const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const { promisify } = require('node:util');
const { emptyGarden, gardenView, reconcileGarden, spendWater, upgradeGarden } = require('./garden.cjs');
const { createApp } = require('./server.cjs');

test('completions earn water and confirmed waterings advance partial growth, levels and the cap', () => {
  const tasks = Array.from({ length: 22 }, (_, id) => ({ id: String(id), status: 'completed' }));
  let garden = emptyGarden();
  for (let index = 0; index < tasks.length; index++) {
    const current = tasks.slice(0, index + 1);
    garden = reconcileGarden(garden, current, tasks.slice(0, index));
    assert.deepEqual(gardenView(garden, current), {
      revision: index + 1, lifetime: index + 1, waterings: 0, activeWaterings: 0, growth: 0,
      level: 1, available: index + 1, streak: 0,
    });
    assert.equal(reconcileGarden(garden, current, current), garden);
  }
  for (let count = 1; count <= tasks.length; count++) {
    const id = 'test-watering-' + count;
    const spent = spendWater(garden, tasks, id);
    assert.equal(spent.receipt.wateringNumber, count);
    garden = spent.garden;
    assert.deepEqual(gardenView(garden, tasks), {
      revision: tasks.length + count, lifetime: tasks.length, waterings: count, activeWaterings: count,
      growth: Math.min(18, count), level: Math.min(10, 1 + Math.floor(count / 2)), available: tasks.length - count, streak: 0,
    });
    assert.deepEqual(spendWater(garden, tasks, id), { garden, receipt: spent.receipt });
  }
  assert.equal(spendWater(garden, tasks, 'no-water-left'), null);
});

test('legacy growth includes existing receipts and preserves all credits and capped maturity', () => {
  for (const [lifetime, waterings, growth] of [[5, 0, 5], [6, 2, 6], [20, 1, 18], [22, 21, 18]]) {
    const entries = Array.from({ length: lifetime }, (_, index) => ({
      taskId: 'old-' + index, ...(index < waterings ? { wateringId: 'water-' + index } : {}),
    }));
    const migrated = upgradeGarden({ version: 1, entries });
    assert.equal(upgradeGarden(migrated), migrated);
    assert.deepEqual(migrated.entries, entries);
    const all = entries.map(({ taskId }) => ({ id: taskId, status: 'completed' }));
    assert.deepEqual(gardenView(migrated, all), {
      revision: 0, lifetime, waterings, activeWaterings: waterings, growth, level: 1 + Math.floor(growth / 2),
      available: lifetime - waterings, streak: 0,
    });
  }
});

test('task PATCH and achievement share a durable commit, and watering retries spend at most one credit', async (context) => {
  const directory = mkdtempSync(join(tmpdir(), 'usad-garden-test-'));
  const file = join(directory, 'db.json');
  const start = { tasks: [
    ...Array.from({ length: 3 }, (_, id) => ({ id: String(id), status: 'completed' })),
    { id: 'pending', status: 'pending', order: 'a0' },
  ] };
  const snapshot = () => JSON.parse(readFileSync(file));
  writeFileSync(file, JSON.stringify(start));
  let failWrite = false;
  const app = createApp(file, (target, data) => {
    if (failWrite) throw new Error('Simulated disk failure');
    writeFileSync(target, JSON.stringify(data));
  });
  const server = app.listen(0, '127.0.0.1');
  context.after(() => { server.close(); rmSync(directory, { recursive: true, force: true }); });
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, method = 'GET', body) => fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const read = async () => (await request('/garden')).json();
  assert.deepEqual(await read(), { revision: 0, lifetime: 3, waterings: 0, activeWaterings: 0, growth: 3, level: 2, available: 3, streak: 0 });
  assert.deepEqual(snapshot(), start, 'Migration has no read-side disk write');

  failWrite = true;
  const rejected = await request('/tasks/pending', 'PATCH', { status: 'completed' });
  assert.equal(rejected.status, 500);
  assert.equal(rejected.headers.get('X-USAD-Water-Earned'), null);
  assert.equal(rejected.headers.get('X-USAD-Garden-Level'), null);
  assert.deepEqual(snapshot(), start);
  assert.equal((await (await request('/tasks/pending')).json()).status, 'pending');
  assert.deepEqual(await read(), { revision: 0, lifetime: 3, waterings: 0, activeWaterings: 0, growth: 3, level: 2, available: 3, streak: 0 });

  failWrite = false;
  const completed = await request('/tasks/pending', 'PATCH', { status: 'completed' });
  assert.equal(completed.headers.get('X-USAD-Garden-Level'), null);
  assert.equal(completed.headers.get('X-USAD-Water-Earned'), '1');
  await request('/tasks/pending', 'PATCH', { status: 'pending', order: 'a0' });
  const repeated = await request('/tasks/pending', 'PATCH', { status: 'completed' });
  assert.equal(repeated.headers.get('X-USAD-Garden-Level'), null);
  assert.equal(repeated.headers.get('X-USAD-Water-Earned'), null);
  await request('/tasks/pending', 'DELETE');
  assert.deepEqual(await read(), { revision: 4, lifetime: 4, waterings: 0, activeWaterings: 0, growth: 3, level: 2, available: 3, streak: 0 });

  const id = 'water-operation-0001';
  failWrite = true;
  assert.equal((await request('/garden/water', 'POST', { id })).status, 503);
  assert.equal((await read()).available, 3);
  failWrite = false;
  const attempts = await Promise.all([request('/garden/water', 'POST', { id }), request('/garden/water', 'POST', { id })]);
  for (const attempt of attempts) assert.equal((await attempt.json()).available, 2);
  assert.deepEqual(gardenView(snapshot().garden, snapshot().tasks), {
    revision: 5, lifetime: 4, waterings: 1, activeWaterings: 1, growth: 4, level: 3, available: 2, streak: 0,
  });
});

test('the garden and watering routes restore existing history from disk after restart', async context => {
  const directory = mkdtempSync(join(tmpdir(), 'usad-garden-restart-'));
  const file = join(directory, 'db.json');
  writeFileSync(file, JSON.stringify({
    tasks: [{ id: 'new', status: 'pending' }],
    garden: { version: 1, entries: [{ taskId: 'deleted' }] },
  }));
  async function start() {
    const server = createApp(file).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    return { server, base: `http://127.0.0.1:${server.address().port}` };
  }
  const stop = server => new Promise(resolve => server.close(resolve));
  let runtime = await start();
  context.after(async () => {
    if (runtime.server.listening) await stop(runtime.server);
    rmSync(directory, { recursive: true, force: true });
  });

  const state = async () => {
    const response = await fetch(runtime.base + '/garden');
    assert.equal(response.status, 200);
    return response.json();
  };
  const json = { 'Content-Type': 'application/json' };
  assert.equal((await fetch(runtime.base + '/api/garden')).status, 404, 'Angular owns the public /api prefix');
  assert.deepEqual(await state(), { revision: 0, lifetime: 1, waterings: 0, activeWaterings: 0, growth: 1, available: 0, level: 1, streak: 0 });
  const completed = await fetch(runtime.base + '/tasks/new', {
    method: 'PATCH', headers: json, body: JSON.stringify({ status: 'completed' }),
  });
  assert.equal(completed.headers.get('X-USAD-Water-Earned'), '1');
  assert.equal(completed.headers.get('X-USAD-Garden-Level'), null);
  const water = () => fetch(runtime.base + '/garden/water', {
    method: 'POST', headers: json, body: JSON.stringify({ id: 'water-after-restart-01' }),
  });
  assert.equal((await water()).status, 200);
  await stop(runtime.server);
  runtime = await start();
  assert.deepEqual(await state(), { revision: 2, lifetime: 2, waterings: 1, activeWaterings: 1, growth: 2, available: 0, level: 2, streak: 1 });
  assert.deepEqual(await (await water()).json(), { ...await state(), wateringNumber: 1, wateringRevision: 2 });
});

test('startup seeds a missing configured file and preserves existing database bytes', async context => {
  const directory = mkdtempSync(join(tmpdir(), 'usad-seed-test-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, 'storage', 'db.json');
  const run = promisify(execFile);
  const seed = (...args) => run(process.execPath, [join(__dirname, 'seed.mjs'), ...args], {
    env: { ...process.env, USAD_DATA_FILE: file },
  });

  await Promise.all([seed(), seed()]);
  const initial = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(initial.tasks[0].id, 'field-notes');
  assert.match(initial.tasks[0].dueDate, /^\d{4}-\d{2}-\d{2}$/);

  const existing = '{"tasks":[],"garden":{"version":1,"entries":[{"taskId":"saved"}]}}\n';
  writeFileSync(file, existing);
  await seed();
  await assert.rejects(seed('--reset'), /only available for the default local database/);
  assert.equal(readFileSync(file, 'utf8'), existing);
});

test('the last day of a year and the first of the next are consecutive streak days', () => {
  const tasks = ['a', 'b'].map(id => ({ id, status: 'completed' }));
  const first = Date.parse('2026-12-31T16:00:00Z');
  const second = Date.parse('2027-01-01T16:01:00Z');
  const before = reconcileGarden(emptyGarden(), [tasks[0]], [], first, 'Asia/Manila');
  const after = reconcileGarden(before, tasks, [tasks[0]], second, 'Asia/Manila');
  assert.deepEqual(after.entries.map(entry => entry.completionDay), ['2027-01-01', '2027-01-02']);
  const yearEnd = reconcileGarden(emptyGarden(), [tasks[0]], [], first - 60_000, 'Asia/Manila');
  const newYear = reconcileGarden(yearEnd, tasks, [tasks[0]], first + 60_000, 'Asia/Manila');
  assert.deepEqual(newYear.entries.map(entry => entry.completionDay), ['2026-12-31', '2027-01-01']);
  assert.equal(gardenView(newYear, tasks, first + 60_000, 'Asia/Manila').streak, 2);
});
